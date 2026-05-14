import supabase from "../config/supabaseClient.js";
import { getAuthedSupabaseClient } from "../utils/supabaseAuthedClient.js";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

// ─── Shared Groq helper ───────────────────────────────────────────────────────
async function chat(messages, temperature = 0.7) {
  const response = await groq.chat.completions.create({ model: MODEL, messages, temperature });
  return response.choices[0].message.content;
}

function parseJSON(raw) {
  const clean = String(raw).replace(/```json|```/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  const jsonStr = match ? match[0] : clean;
  const sanitized = jsonStr.replace(
    /"((?:[^"\\]|\\.)*)"/g,
    (_, inner) => `"${inner.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")}"`
  );
  return JSON.parse(sanitized);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function logActivity(userId, type, description) {
  await supabase.from("activity_logs").insert({ user_id: userId, type, description });
}

async function awardXP(userId, amount) {
  const { data: user } = await supabase
    .from("users").select("xp, level").eq("id", userId).single();
  if (!user) return;
  const newXP = (user.xp || 0) + amount;
  const newLevel = Math.floor(newXP / 1000) + 1;
  await supabase.from("users").update({ xp: newXP, level: newLevel }).eq("id", userId);
}

function scoreToDifficulty(score) {
  if (score >= 85) return "advanced";
  if (score >= 60) return "intermediate";
  return "beginner";
}

/**
 * Dynamic passing grade based on chapter/course difficulty.
 * beginner  → 60%
 * intermediate → 70%
 * advanced  → 80%
 */
function getPassingGrade(difficulty) {
  if (difficulty === "advanced")     return 80;
  if (difficulty === "intermediate") return 70;
  return 60; // beginner default
}

function entryQuizSizeHint(topic) {
  const broad = ["programming", "mathematics", "history", "science", "engineering",
                 "economics", "medicine", "law", "philosophy", "chemistry", "physics"];
  const t = (topic || "").toLowerCase();
  const isBroad = broad.some((w) => t.includes(w));
  return isBroad ? "between 10 and 15" : "between 5 and 10";
}

// ─── Adaptive engine — bonus questions on next chapter ────────────────────────
async function adaptNextChapter(db, courseId, currentChapterOrderIndex, topic, recentScores) {
  try {
    const { data: nextChapter } = await db
      .from("chapters")
      .select("id, title, difficulty")
      .eq("course_id", courseId)
      .eq("order_index", currentChapterOrderIndex + 1)
      .single();
    if (!nextChapter) return;

    const { data: nextQuiz } = await db
      .from("quizzes")
      .select("id, title, questions")
      .eq("course_id", courseId)
      .eq("chapter_id", nextChapter.id)
      .single();
    if (!nextQuiz) return;

    const avg = recentScores.length > 0
      ? Math.round(recentScores.reduce((a, b) => a + b, 0) / recentScores.length)
      : 50;

    const newDifficulty = scoreToDifficulty(avg);

    let bonusStyle, bonusCount;
    if (avg >= 85)      { bonusStyle = "challenging, advanced-level";    bonusCount = 3; }
    else if (avg >= 60) { bonusStyle = "medium difficulty, reinforcement"; bonusCount = 2; }
    else                { bonusStyle = "easy, foundational recap";        bonusCount = 3; }

    const raw = await chat([
      {
        role: "system",
        content: "You are a quiz designer. Respond with valid JSON only — an array of question objects.",
      },
      {
        role: "user",
        content:
          `Course topic: "${topic}"\n` +
          `Next chapter: "${nextChapter.title}"\n` +
          `Student recent avg score: ${avg}%\n` +
          `Generate exactly ${bonusCount} ${bonusStyle} bonus questions for the next chapter quiz.\n\n` +
          `JSON format (array only, no wrapper):\n` +
          `[{ "question": "...", "options": ["A","B","C","D"], "answer": "A", "difficulty": "${newDifficulty}", "isBonus": true }]`,
      },
    ], 0.4);

    const bonusQuestions = parseJSON(raw);

    await db.from("quizzes").update({
      bonus_questions: bonusQuestions,
      difficulty_before: nextChapter.difficulty,
      difficulty_after: newDifficulty,
    }).eq("id", nextQuiz.id);

    await db.from("chapters").update({
      difficulty: newDifficulty,
      difficulty_adjusted: true,
    }).eq("id", nextChapter.id);

  } catch (e) {
    console.error("Adaptive engine error:", e.message);
  }
}

/**
 * On quiz fail: generate a fresh set of questions tailored to what the student
 * got wrong and how many attempts they've had.
 *
 * - attempt 1 fail  → same difficulty, different questions, focus on weak topics
 * - attempt 2+ fail → easier questions + simpler wording, more foundational
 */
async function regenerateQuizQuestions(db, quizId, chapterTitle, chapterDifficulty, wrongTopics, attempts) {
  try {
    const isRepeatedFail = attempts >= 2;
    const targetDifficulty = isRepeatedFail
      ? (chapterDifficulty === "advanced" ? "intermediate" : "beginner")
      : chapterDifficulty;

    const focusNote = wrongTopics.length > 0
      ? `Focus especially on these weak areas: ${wrongTopics.slice(0, 5).join(", ")}.`
      : "Cover the chapter topic thoroughly.";

    const raw = await chat([
      {
        role: "system",
        content: "You are a quiz designer. Respond with valid JSON only — an array of question objects.",
      },
      {
        role: "user",
        content:
          `Chapter: "${chapterTitle}"\n` +
          `Difficulty: ${targetDifficulty}\n` +
          `Attempt number: ${attempts}\n` +
          `${isRepeatedFail ? "The student has failed multiple times. Make questions clearer and more foundational." : "The student failed once. Generate fresh questions at the same difficulty."}\n` +
          `${focusNote}\n\n` +
          `Generate exactly 4 NEW multiple-choice questions. Do NOT reuse the same questions.\n\n` +
          `JSON format (array only):\n` +
          `[\n` +
          `  {\n` +
          `    "question": "question text",\n` +
          `    "options": ["full option A", "full option B", "full option C", "full option D"],\n` +
          `    "answer": "full option A",\n` +
          `    "difficulty": "${targetDifficulty}"\n` +
          `  }\n` +
          `]`,
      },
    ], 0.5);

    const newQuestions = parseJSON(raw);

    await db.from("quizzes").update({
      questions: newQuestions,
      bonus_questions: [],
    }).eq("id", quizId);

    return newQuestions;
  } catch (e) {
    console.error("Quiz regeneration error:", e.message);
    return null;
  }
}

/**
 * After 2+ failed attempts, rewrite the current chapter content to be
 * simpler and clearer so the student actually learns before retrying.
 */
async function rewriteChapterContent(db, chapterId, chapterTitle, chapterDifficulty, topic, wrongTopics) {
  try {
    const simplifiedDifficulty = chapterDifficulty === "advanced" ? "intermediate" : "beginner";
    const focusNote = wrongTopics.length > 0
      ? `The student struggled with: ${wrongTopics.slice(0, 5).join(", ")}. Make sure to explain these clearly.`
      : "";

    const raw = await chat([
      {
        role: "system",
        content: "You are a curriculum writer. Respond with valid JSON only — no markdown, no extra text.",
      },
      {
        role: "user",
        content:
          `Rewrite the content for this chapter: "${chapterTitle}"\n` +
          `Course topic: "${topic}"\n` +
          `Target difficulty: ${simplifiedDifficulty} (simpler than before)\n` +
          `${focusNote}\n\n` +
          `Requirements:\n` +
          `- Use simpler language and more analogies\n` +
          `- Add step-by-step explanations\n` +
          `- Include concrete examples\n` +
          `- Minimum 4 paragraphs\n` +
          `- Do NOT include quiz questions in the content\n\n` +
          `Return ONLY this JSON:\n` +
          `{ "content": "full rewritten chapter content here" }`,
      },
    ], 0.4);

    const result = parseJSON(raw);
    if (!result.content) return;

    await db.from("chapters").update({
      content: result.content,
      content_adjusted: true,
      difficulty: simplifiedDifficulty,
    }).eq("id", chapterId);

  } catch (e) {
    console.error("Chapter rewrite error:", e.message);
  }
}

// ─── GET /api/ai-courses ──────────────────────────────────────────────────────
export const getUserCourses = async (req, res) => {
  try {
    const db = getAuthedSupabaseClient(req.accessToken);
    const { data, error } = await db
      .from("ai_courses")
      .select(`*, chapters(id, title, order_index, is_completed, difficulty, difficulty_adjusted, content_adjusted, quizzes(id, title, score, passed, attempts, passing_grade))`)
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/ai-courses ─────────────────────────────────────────────────────
export const createCourse = async (req, res) => {
  try {
    const { title, subject, description, chapters } = req.body;
    if (!title || !chapters || chapters.length === 0) {
      return res.status(400).json({ success: false, message: "Title and chapters are required" });
    }
    const db = getAuthedSupabaseClient(req.accessToken);
    const { data: course, error: courseError } = await db
      .from("ai_courses")
      .insert({ user_id: req.user.id, title, subject, description, total_chapters: chapters.length, completed_chapters: 0 })
      .select().single();
    if (courseError) throw courseError;

    const chaptersToInsert = chapters.map((chapter, index) => ({
      course_id: course.id,
      title: chapter.title,
      content: chapter.content || "",
      order_index: index + 1,
      is_completed: false,
      difficulty: "beginner",
    }));
    const { data: createdChapters, error: chaptersError } = await db.from("chapters").insert(chaptersToInsert).select();
    if (chaptersError) throw chaptersError;

    const quizzesToInsert = [];
    chapters.forEach((chapter, index) => {
      if (chapter.quiz) {
        const difficulty = chapter.difficulty || "beginner";
        quizzesToInsert.push({
          course_id: course.id,
          chapter_id: createdChapters[index].id,
          title: chapter.quiz.title || `Quiz: ${chapter.title}`,
          questions: chapter.quiz.questions || [],
          passed: false,
          attempts: 0,
          passing_grade: getPassingGrade(difficulty),
        });
      }
    });
    if (quizzesToInsert.length > 0) await db.from("quizzes").insert(quizzesToInsert);

    await logActivity(req.user.id, "course_created", `Started course: ${title}`);
    return res.status(201).json({ success: true, message: "Course created successfully", data: { ...course, chapters: createdChapters } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET /api/ai-courses/:id ──────────────────────────────────────────────────
export const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;
    const db = getAuthedSupabaseClient(req.accessToken);
    const { data, error } = await db
      .from("ai_courses")
      .select(`*, chapters(*, quizzes(*))`)
      .eq("id", id)
      .eq("user_id", req.user.id)
      .single();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: "Course not found" });
    data.chapters = data.chapters.sort((a, b) => a.order_index - b.order_index);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DELETE /api/ai-courses/:id ───────────────────────────────────────────────
export const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const db = getAuthedSupabaseClient(req.accessToken);
    const { error } = await db.from("ai_courses").delete().eq("id", id).eq("user_id", req.user.id);
    if (error) throw error;
    return res.status(200).json({ success: true, message: "Course deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PATCH /api/ai-courses/:courseId/chapters/:chapterId/complete ─────────────
export const completeChapter = async (req, res) => {
  try {
    const { courseId, chapterId } = req.params;
    const db = getAuthedSupabaseClient(req.accessToken);

    const { error: chapterError } = await db
      .from("chapters")
      .update({ is_completed: true, completed_at: new Date().toISOString() })
      .eq("id", chapterId).eq("course_id", courseId);
    if (chapterError) throw chapterError;

    const { count: completedCount } = await db
      .from("chapters")
      .select("*", { count: "exact", head: true })
      .eq("course_id", courseId).eq("is_completed", true);

    const { error: courseError } = await db
      .from("ai_courses")
      .update({ completed_chapters: completedCount || 0 })
      .eq("id", courseId).eq("user_id", req.user.id);
    if (courseError) throw courseError;

    await logActivity(req.user.id, "chapter_completed", `Completed a chapter`);
    return res.status(200).json({ success: true, message: "Chapter marked as complete", data: { completed_chapters: completedCount } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/ai-courses/:courseId/entry-quiz/generate ───────────────────────
export const generateEntryQuiz = async (req, res) => {
  try {
    const { courseId } = req.params;
    const db = getAuthedSupabaseClient(req.accessToken);

    const { data: course, error: courseErr } = await db
      .from("ai_courses")
      .select("id, title, subject, description, entry_quiz, entry_quiz_passed")
      .eq("id", courseId).eq("user_id", req.user.id).single();
    if (courseErr) throw courseErr;
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });

    const sizeHint = entryQuizSizeHint(course.subject || course.title);

    const raw = await chat([
      { role: "system", content: "You are an academic assessment expert. Respond with valid JSON only — no markdown, no extra text." },
      {
        role: "user",
        content:
          `Create an entry-level diagnostic quiz for a course on "${course.title}".\n` +
          `Subject area: ${course.subject || "General"}\n` +
          `Course description: ${course.description || ""}\n\n` +
          `Choose ${sizeHint} questions — pick the exact count that best covers the topic breadth.\n` +
          `Mix difficulties: ~40% easy, ~40% medium, ~20% hard.\n` +
          `Questions must test prerequisite knowledge, not course content itself.\n\n` +
          `Return this exact JSON structure:\n` +
          `{\n` +
          `  "title": "Entry Quiz: <course title>",\n` +
          `  "description": "one sentence explaining what this quiz tests",\n` +
          `  "questions": [\n` +
          `    { "question": "...", "options": ["A","B","C","D"], "answer": "A", "difficulty": "easy|medium|hard", "topic": "specific topic" }\n` +
          `  ]\n` +
          `}`,
      },
    ], 0.3);

    const quiz = parseJSON(raw);
    await db.from("ai_courses").update({ entry_quiz: quiz }).eq("id", courseId).eq("user_id", req.user.id);
    return res.status(200).json({ success: true, data: quiz });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/ai-courses/:courseId/entry-quiz/submit ─────────────────────────
export const submitEntryQuiz = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { userAnswers = [] } = req.body;
    const db = getAuthedSupabaseClient(req.accessToken);

    const { data: course, error: courseErr } = await db
      .from("ai_courses")
      .select("id, title, subject, entry_quiz, chapters(id, title, order_index, difficulty)")
      .eq("id", courseId).eq("user_id", req.user.id).single();
    if (courseErr) throw courseErr;
    if (!course?.entry_quiz) return res.status(400).json({ success: false, message: "No entry quiz found. Generate it first." });

    const questions = course.entry_quiz.questions || [];
    const correct = questions.filter((q, i) => userAnswers[i] === q.answer).length;
    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    const passingGrade = 70; // entry quiz fixed at 70%
    const passed = score >= passingGrade;
    const startingLevel = scoreToDifficulty(score);

    const feedback = questions.map((q, i) => ({
      question: q.question, correct: q.answer, given: userAnswers[i] || null,
      isCorrect: userAnswers[i] === q.answer, topic: q.topic || "", difficulty: q.difficulty || "medium",
    }));

    const chapters = (course.chapters || []).sort((a, b) => a.order_index - b.order_index);
    let chaptersToSkip = [];

    if (score >= 90) {
      chaptersToSkip = chapters.filter((c) => c.difficulty === "beginner").map((c) => c.id);
    } else if (score >= 70) {
      chaptersToSkip = chapters.filter((c) => c.difficulty === "beginner").slice(0, 2).map((c) => c.id);
    }

    if (chaptersToSkip.length > 0) {
      await db.from("chapters").update({ is_completed: true, completed_at: new Date().toISOString() }).in("id", chaptersToSkip).eq("course_id", courseId);
      await db.from("ai_courses").update({ completed_chapters: chaptersToSkip.length }).eq("id", courseId).eq("user_id", req.user.id);
    }

    const recommendedChapter = chapters.find((c) => !chaptersToSkip.includes(c.id)) || chapters[0];

    await db.from("ai_courses").update({ entry_quiz_score: score, entry_quiz_passed: passed, course_level: startingLevel }).eq("id", courseId).eq("user_id", req.user.id);

    if (chapters.length > 0) {
      for (let i = 0; i < chapters.length; i++) {
        const ratio = i / chapters.length;
        let chapterDifficulty;
        if (ratio < 0.33)      chapterDifficulty = startingLevel;
        else if (ratio < 0.66) chapterDifficulty = startingLevel === "beginner" ? "intermediate" : startingLevel;
        else                   chapterDifficulty = startingLevel === "beginner" ? "intermediate" : "advanced";
        await db.from("chapters").update({ difficulty: chapterDifficulty }).eq("id", chapters[i].id);
      }
    }

    await logActivity(req.user.id, "entry_quiz_completed", `Entry quiz: ${score}% — Level: ${startingLevel}`);
    if (passed) await awardXP(req.user.id, 30);

    return res.status(200).json({
      success: true,
      data: {
        score, passed, startingLevel, feedback,
        chaptersSkipped: chaptersToSkip.length,
        recommendedChapter: recommendedChapter
          ? { id: recommendedChapter.id, title: recommendedChapter.title, order_index: recommendedChapter.order_index }
          : null,
        message: passed
          ? `Great foundation! You scored ${score}%. Starting at ${startingLevel} level.${chaptersToSkip.length > 0 ? ` ${chaptersToSkip.length} chapters unlocked.` : ""}`
          : `Score: ${score}%. We'll start from the beginning to build a solid foundation.`,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PATCH /api/ai-courses/:courseId/quizzes/:quizId/submit ──────────────────
export const submitQuiz = async (req, res) => {
  try {
    const { courseId, quizId } = req.params;
    const { score, chapterTitle, questions = [], userAnswers = [] } = req.body;

    if (score === undefined || score < 0 || score > 100) {
      return res.status(400).json({ success: false, message: "Score must be 0-100" });
    }

    const db = getAuthedSupabaseClient(req.accessToken);

    // ── Fetch quiz + chapter info ─────────────────────────────────────────────
    const { data: quiz, error: quizFetchErr } = await db
      .from("quizzes")
      .select("id, chapter_id, attempts, passing_grade")
      .eq("id", quizId).eq("course_id", courseId).single();
    if (quizFetchErr) throw quizFetchErr;

    const { data: chapter } = await db
      .from("chapters")
      .select("id, order_index, difficulty, title, content_adjusted")
      .eq("id", quiz.chapter_id).single();

    const { data: course } = await db
      .from("ai_courses")
      .select("subject, title, course_level")
      .eq("id", courseId).single();

    // ── Dynamic passing grade ─────────────────────────────────────────────────
    // Use stored passing_grade if set, otherwise derive from chapter difficulty
    const chapterDifficulty = chapter?.difficulty || "beginner";
    const passingGrade = quiz.passing_grade || getPassingGrade(chapterDifficulty);
    const passed = score >= passingGrade;
    const newAttempts = (quiz?.attempts || 0) + 1;

    // ── Save quiz result ──────────────────────────────────────────────────────
    await db.from("quizzes").update({
      score,
      passed,
      completed_at: new Date().toISOString(),
      attempts: newAttempts,
      passing_grade: passingGrade, // persist so it stays consistent across retakes
    }).eq("id", quizId).eq("course_id", courseId);

    // ── Identify weak topics from wrong answers ───────────────────────────────
    const wrongAnswers = questions
      .map((q, i) => ({ question: q.question, correct: q.answer, given: userAnswers[i], topic: q.topic || q.question }))
      .filter((q) => q.given !== q.correct);
    const wrongTopics = wrongAnswers.map((q) => q.topic);

    // ── On FAIL: regenerate questions + possibly rewrite chapter ──────────────
    let contentRewritten = false;
    let newQuestions = null;

    if (!passed) {
      // Always regenerate questions on fail (different questions each attempt)
      newQuestions = await regenerateQuizQuestions(
        db, quizId,
        chapter?.title || chapterTitle,
        chapterDifficulty,
        wrongTopics,
        newAttempts
      );

      // After 2+ fails: also rewrite the chapter content to be simpler
      if (newAttempts >= 2 && !chapter?.content_adjusted) {
        const topic = course?.subject || course?.title || chapterTitle;
        await rewriteChapterContent(
          db,
          quiz.chapter_id,
          chapter?.title || chapterTitle,
          chapterDifficulty,
          topic,
          wrongTopics
        );
        contentRewritten = true;
      }
    }

    // ── On PASS: run adaptive engine for next chapter ─────────────────────────
    if (passed && chapter?.order_index) {
      const { data: recentQuizzes } = await db
        .from("quizzes")
        .select("score")
        .eq("course_id", courseId)
        .not("score", "is", null)
        .order("completed_at", { ascending: false })
        .limit(3);

      const recentScores = (recentQuizzes || []).map((q) => q.score);

      adaptNextChapter(
        db, courseId, chapter.order_index,
        course?.subject || course?.title || "the course topic",
        recentScores
      ).catch(() => {});
    }

    // ── Generate AI report ────────────────────────────────────────────────────
    let report = null;
    try {
      const correctList = questions
        .filter((_, i) => userAnswers[i] === questions[i]?.answer)
        .map((q) => q.question);

      const raw = await chat([
        { role: "system", content: "You are an academic performance analyst. Respond with valid JSON only." },
        {
          role: "user",
          content:
            `Student quiz result on "${chapterTitle || chapter?.title || "a chapter"}".\n` +
            `Score: ${score}% (${passed ? "PASSED" : "FAILED"} — passing: ${passingGrade}%)\n` +
            `Chapter difficulty: ${chapterDifficulty}\n` +
            `Attempt: #${newAttempts}\n\n` +
            `Correct (${correctList.length}): ${correctList.join("; ") || "none"}\n` +
            `Wrong (${wrongAnswers.length}): ${wrongAnswers.map((q) => `"${q.question}" (correct: ${q.correct}, given: ${q.given})`).join("; ") || "none"}\n\n` +
            `Return JSON:\n` +
            `{\n` +
            `  "summary": "2 sentence performance summary",\n` +
            `  "strengths": ["strength based on correct answers"],\n` +
            `  "improvements": ["specific topic to review"],\n` +
            `  "recommendation": "one concrete next step",\n` +
            `  "passed": ${passed}\n` +
            `}`,
        },
      ], 0.3);

      report = parseJSON(raw);
    } catch {
      report = {
        summary: passed ? "Good work! You passed the quiz." : "Keep studying and try again.",
        strengths: ["Keep it up!"],
        improvements: wrongTopics.length > 0 ? wrongTopics.slice(0, 3) : ["Review the chapter material"],
        recommendation: passed
          ? "Move on to the next chapter."
          : newAttempts >= 2
            ? "The chapter content has been simplified for you. Re-read it before retrying."
            : "Review the chapter and try again with the new questions.",
        passed,
      };
    }

    await logActivity(
      req.user.id,
      passed ? "quiz_passed" : "quiz_failed",
      `Quiz score: ${score}% — ${passed ? "Passed ✅" : "Failed ❌"} (attempt #${newAttempts}, passing: ${passingGrade}%)`
    );
    if (passed) await awardXP(req.user.id, 50);

    return res.status(200).json({
      success: true,
      message: passed
        ? `Quiz passed! +50 XP 🎉`
        : `Score: ${score}% — Need ${passingGrade}% to pass.`,
      data: {
        score,
        passed,
        passingGrade,
        report,
        attempts: newAttempts,
        contentRewritten,       // frontend can show "Chapter updated" notice
        newQuestionsReady: !passed && !!newQuestions, // frontend can tell user new questions are ready
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};