import supabase from "../config/supabaseClient.js";
import { getAuthedSupabaseClient } from "../utils/supabaseAuthedClient.js";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";
const PASSING_GRADE = 80;

// ─── Shared Groq helper ───────────────────────────────────────────────────────
async function chat(messages, temperature = 0.7) {
  const response = await groq.chat.completions.create({ model: MODEL, messages, temperature });
  return response.choices[0].message.content;
}

function parseJSON(raw) {
  const clean = String(raw).replace(/```json|```/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return JSON.parse(match ? match[0] : clean);
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

/**
 * Determine difficulty label from a score (0-100).
 */
function scoreToDifficulty(score) {
  if (score >= 85) return "advanced";
  if (score >= 60) return "intermediate";
  return "beginner";
}

/**
 * Decide how many entry quiz questions to generate.
 * The AI will honor the range 5–15; we ask it to pick based on topic breadth.
 * This function returns a number hint we embed in the prompt.
 */
function entryQuizSizeHint(topic) {
  const broad = ["programming", "mathematics", "history", "science", "engineering",
                 "economics", "medicine", "law", "philosophy", "chemistry", "physics"];
  const t = (topic || "").toLowerCase();
  const isBroad = broad.some((w) => t.includes(w));
  return isBroad ? "between 10 and 15" : "between 5 and 10";
}

// ─── Adaptive engine ──────────────────────────────────────────────────────────
/**
 * After a chapter quiz is submitted, look at the last 1-3 quiz scores for this
 * course and inject bonus questions into the NEXT chapter's quiz.
 *
 * Logic:
 *   - avg score >= 85  → inject 2-3 harder bonus questions
 *   - avg score 60-84  → inject 1-2 medium questions (reinforce)
 *   - avg score < 60   → inject 2-3 easier recap questions
 *
 * Bonus questions are stored in quizzes.bonus_questions for the next chapter.
 */
async function adaptNextChapter(db, courseId, currentChapterOrderIndex, topic, recentScores) {
  try {
    // Find the next chapter
    const { data: nextChapter } = await db
      .from("chapters")
      .select("id, title, difficulty")
      .eq("course_id", courseId)
      .eq("order_index", currentChapterOrderIndex + 1)
      .single();

    if (!nextChapter) return; // no next chapter (last chapter)

    // Find the quiz for that next chapter
    const { data: nextQuiz } = await db
      .from("quizzes")
      .select("id, title, questions")
      .eq("course_id", courseId)
      .eq("chapter_id", nextChapter.id)
      .single();

    if (!nextQuiz) return; // next chapter has no quiz

    const avg = recentScores.length > 0
      ? Math.round(recentScores.reduce((a, b) => a + b, 0) / recentScores.length)
      : 50;

    const newDifficulty = scoreToDifficulty(avg);

    let bonusStyle, bonusCount;
    if (avg >= 85) {
      bonusStyle = "challenging, advanced-level";
      bonusCount = 3;
    } else if (avg >= 60) {
      bonusStyle = "medium difficulty, reinforcement";
      bonusCount = 2;
    } else {
      bonusStyle = "easy, foundational recap";
      bonusCount = 3;
    }

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
          `[\n` +
          `  {\n` +
          `    "question": "question text",\n` +
          `    "options": ["A", "B", "C", "D"],\n` +
          `    "answer": "A",\n` +
          `    "difficulty": "${newDifficulty}",\n` +
          `    "isBonus": true\n` +
          `  }\n` +
          `]`,
      },
    ], 0.4);

    const bonusQuestions = parseJSON(raw);

    // Store bonus questions + mark difficulty adapted
    await db
      .from("quizzes")
      .update({
        bonus_questions: bonusQuestions,
        difficulty_before: nextChapter.difficulty,
        difficulty_after: newDifficulty,
      })
      .eq("id", nextQuiz.id);

    // Update next chapter difficulty label
    await db
      .from("chapters")
      .update({ difficulty: newDifficulty, difficulty_adjusted: true })
      .eq("id", nextChapter.id);

  } catch (e) {
    // Adaptation is best-effort — never crash the main request
    console.error("Adaptive engine error:", e.message);
  }
}

// ─── GET /api/ai-courses ──────────────────────────────────────────────────────
export const getUserCourses = async (req, res) => {
  try {
    const db = getAuthedSupabaseClient(req.accessToken);
    const { data, error } = await db
      .from("ai_courses")
      .select(`*, chapters(id, title, order_index, is_completed, difficulty, difficulty_adjusted, quizzes(id, title, score, passed, attempts))`)
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
      .insert({
        user_id: req.user.id,
        title,
        subject,
        description,
        total_chapters: chapters.length,
        completed_chapters: 0,
      })
      .select()
      .single();
    if (courseError) throw courseError;

    const chaptersToInsert = chapters.map((chapter, index) => ({
      course_id: course.id,
      title: chapter.title,
      content: chapter.content || "",
      order_index: index + 1,
      is_completed: false,
      difficulty: "beginner",
    }));
    const { data: createdChapters, error: chaptersError } = await db
      .from("chapters")
      .insert(chaptersToInsert)
      .select();
    if (chaptersError) throw chaptersError;

    const quizzesToInsert = [];
    chapters.forEach((chapter, index) => {
      if (chapter.quiz) {
        quizzesToInsert.push({
          course_id: course.id,
          chapter_id: createdChapters[index].id,
          title: chapter.quiz.title || `Quiz: ${chapter.title}`,
          questions: chapter.quiz.questions || [],
          passed: false,
          attempts: 0,
        });
      }
    });
    if (quizzesToInsert.length > 0) {
      await db.from("quizzes").insert(quizzesToInsert);
    }

    await logActivity(req.user.id, "course_created", `Started course: ${title}`);
    return res.status(201).json({
      success: true,
      message: "Course created successfully",
      data: { ...course, chapters: createdChapters },
    });
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
    const { error } = await db
      .from("ai_courses")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user.id);
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
      .eq("id", chapterId)
      .eq("course_id", courseId);
    if (chapterError) throw chapterError;

    const { count: completedCount } = await db
      .from("chapters")
      .select("*", { count: "exact", head: true })
      .eq("course_id", courseId)
      .eq("is_completed", true);

    const { error: courseError } = await db
      .from("ai_courses")
      .update({ completed_chapters: completedCount || 0 })
      .eq("id", courseId)
      .eq("user_id", req.user.id);
    if (courseError) throw courseError;

    await logActivity(req.user.id, "chapter_completed", `Completed a chapter`);
    return res.status(200).json({
      success: true,
      message: "Chapter marked as complete",
      data: { completed_chapters: completedCount },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/ai-courses/:courseId/entry-quiz/generate ───────────────────────
/**
 * Generates an entry quiz for a course.
 * - AI picks the number of questions (5-15) based on topic breadth.
 * - Result is stored in ai_courses.entry_quiz (jsonb).
 * - Safe to call multiple times — regenerates each time.
 */
export const generateEntryQuiz = async (req, res) => {
  try {
    const { courseId } = req.params;
    const db = getAuthedSupabaseClient(req.accessToken);

    // Fetch course info
    const { data: course, error: courseErr } = await db
      .from("ai_courses")
      .select("id, title, subject, description, entry_quiz, entry_quiz_passed")
      .eq("id", courseId)
      .eq("user_id", req.user.id)
      .single();
    if (courseErr) throw courseErr;
    if (!course) return res.status(404).json({ success: false, message: "Course not found" });

    const sizeHint = entryQuizSizeHint(course.subject || course.title);

    const raw = await chat([
      {
        role: "system",
        content:
          "You are an academic assessment expert. " +
          "Respond with valid JSON only — no markdown, no extra text.",
      },
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
          `    {\n` +
          `      "question": "question text",\n` +
          `      "options": ["A text", "B text", "C text", "D text"],\n` +
          `      "answer": "A text",\n` +
          `      "difficulty": "easy|medium|hard",\n` +
          `      "topic": "specific topic this question tests"\n` +
          `    }\n` +
          `  ]\n` +
          `}`,
      },
    ], 0.3);

    const quiz = parseJSON(raw);

    // Save to course
    await db
      .from("ai_courses")
      .update({ entry_quiz: quiz })
      .eq("id", courseId)
      .eq("user_id", req.user.id);

    return res.status(200).json({ success: true, data: quiz });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/ai-courses/:courseId/entry-quiz/submit ─────────────────────────
/**
 * Submits the entry quiz answers.
 * - Saves score, passed flag, and starting level to ai_courses.
 * - If score >= 80, marks beginner chapters as skippable.
 * - If score >= 90, marks beginner + some intermediate chapters as skippable.
 * - Returns per-question feedback + recommended starting chapter.
 */
export const submitEntryQuiz = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { userAnswers = [] } = req.body;
    // userAnswers: string[] matching question order

    const db = getAuthedSupabaseClient(req.accessToken);

    const { data: course, error: courseErr } = await db
      .from("ai_courses")
      .select("id, title, subject, entry_quiz, chapters(id, title, order_index, difficulty)")
      .eq("id", courseId)
      .eq("user_id", req.user.id)
      .single();
    if (courseErr) throw courseErr;
    if (!course?.entry_quiz) {
      return res.status(400).json({ success: false, message: "No entry quiz found. Generate it first." });
    }

    const questions = course.entry_quiz.questions || [];
    const correct = questions.filter((q, i) => userAnswers[i] === q.answer).length;
    const score = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    const passed = score >= PASSING_GRADE;
    const startingLevel = scoreToDifficulty(score);

    // Per-question feedback
    const feedback = questions.map((q, i) => ({
      question: q.question,
      correct: q.answer,
      given: userAnswers[i] || null,
      isCorrect: userAnswers[i] === q.answer,
      topic: q.topic || "",
      difficulty: q.difficulty || "medium",
    }));

    // Determine which chapters to skip based on score
    const chapters = (course.chapters || []).sort((a, b) => a.order_index - b.order_index);
    let chaptersToSkip = [];

    if (score >= 90) {
      // Skip all beginner chapters + first half of intermediate
      chaptersToSkip = chapters
        .filter((c) => c.difficulty === "beginner")
        .map((c) => c.id);
    } else if (score >= PASSING_GRADE) {
      // Skip first 2 beginner chapters
      chaptersToSkip = chapters
        .filter((c) => c.difficulty === "beginner")
        .slice(0, 2)
        .map((c) => c.id);
    }

    // Mark skippable chapters as completed (so user can still access them)
    if (chaptersToSkip.length > 0) {
      await db
        .from("chapters")
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .in("id", chaptersToSkip)
        .eq("course_id", courseId);

      // Update completed_chapters count
      await db
        .from("ai_courses")
        .update({ completed_chapters: chaptersToSkip.length })
        .eq("id", courseId)
        .eq("user_id", req.user.id);
    }

    // Find recommended starting chapter (first non-skipped)
    const recommendedChapter = chapters.find((c) => !chaptersToSkip.includes(c.id)) || chapters[0];

    // Save entry quiz result
    await db
      .from("ai_courses")
      .update({
        entry_quiz_score: score,
        entry_quiz_passed: passed,
        course_level: startingLevel,
      })
      .eq("id", courseId)
      .eq("user_id", req.user.id);

    // Set initial difficulty on all chapters based on level
    if (chapters.length > 0) {
      // First third = starting level, rest escalate
      for (let i = 0; i < chapters.length; i++) {
        let chapterDifficulty;
        const ratio = i / chapters.length;
        if (ratio < 0.33) chapterDifficulty = startingLevel;
        else if (ratio < 0.66) chapterDifficulty = startingLevel === "beginner" ? "intermediate" : startingLevel;
        else chapterDifficulty = startingLevel === "beginner" ? "intermediate" : "advanced";

        await db
          .from("chapters")
          .update({ difficulty: chapterDifficulty })
          .eq("id", chapters[i].id);
      }
    }

    await logActivity(
      req.user.id,
      "entry_quiz_completed",
      `Entry quiz: ${score}% — Level: ${startingLevel}`
    );
    if (passed) await awardXP(req.user.id, 30);

    return res.status(200).json({
      success: true,
      data: {
        score,
        passed,
        startingLevel,
        feedback,
        chaptersSkipped: chaptersToSkip.length,
        recommendedChapter: recommendedChapter
          ? { id: recommendedChapter.id, title: recommendedChapter.title, order_index: recommendedChapter.order_index }
          : null,
        message: passed
          ? `Great foundation! You scored ${score}%. Starting at ${startingLevel} level. ${chaptersToSkip.length > 0 ? `${chaptersToSkip.length} chapters unlocked based on your knowledge.` : ""}`
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

    const passed = score >= PASSING_GRADE;
    const db = getAuthedSupabaseClient(req.accessToken);

    // Get quiz + chapter info for adaptive engine
    const { data: quiz, error: quizFetchErr } = await db
      .from("quizzes")
      .select("id, chapter_id, attempts, difficulty_before")
      .eq("id", quizId)
      .eq("course_id", courseId)
      .single();
    if (quizFetchErr) throw quizFetchErr;

    const newAttempts = (quiz?.attempts || 0) + 1;

    // Save quiz result
    const { error: updateErr } = await db
      .from("quizzes")
      .update({
        score,
        passed,
        completed_at: new Date().toISOString(),
        attempts: newAttempts,
      })
      .eq("id", quizId)
      .eq("course_id", courseId);
    if (updateErr) throw updateErr;

    // Get chapter order_index for adaptive engine
    const { data: chapter } = await db
      .from("chapters")
      .select("order_index, difficulty")
      .eq("id", quiz.chapter_id)
      .single();

    // Get last 3 quiz scores for this course (rolling average)
    const { data: recentQuizzes } = await db
      .from("quizzes")
      .select("score")
      .eq("course_id", courseId)
      .not("score", "is", null)
      .order("completed_at", { ascending: false })
      .limit(3);

    const recentScores = (recentQuizzes || []).map((q) => q.score);

    // Fetch course subject for adaptive engine
    const { data: course } = await db
      .from("ai_courses")
      .select("subject, title")
      .eq("id", courseId)
      .single();

    // Run adaptive engine (best-effort, non-blocking to response)
    if (chapter?.order_index) {
      adaptNextChapter(
        db,
        courseId,
        chapter.order_index,
        course?.subject || course?.title || "the course topic",
        recentScores
      ).catch(() => {}); // swallow — never crash main response
    }

    // Generate AI report
    let report = null;
    try {
      const wrongAnswers = questions
        .map((q, i) => ({ question: q.question, correct: q.answer, given: userAnswers[i] }))
        .filter((q) => q.given !== q.correct);

      const correctList = questions
        .filter((_, i) => userAnswers[i] === questions[i]?.answer)
        .map((q) => q.question);

      const raw = await chat([
        {
          role: "system",
          content: "You are an academic performance analyst. Respond with valid JSON only.",
        },
        {
          role: "user",
          content:
            `Student quiz result on "${chapterTitle || "a chapter"}".\n` +
            `Score: ${score}% (${passed ? "PASSED" : "FAILED"} — passing: ${PASSING_GRADE}%)\n` +
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
        improvements: ["Review the chapter material"],
        recommendation: passed ? "Move on to the next chapter." : "Re-read the chapter and retry.",
        passed,
      };
    }

    await logActivity(
      req.user.id,
      passed ? "quiz_passed" : "quiz_failed",
      `Quiz score: ${score}% — ${passed ? "Passed ✅" : "Failed ❌"} (attempt #${newAttempts})`
    );
    if (passed) await awardXP(req.user.id, 50);

    return res.status(200).json({
      success: true,
      message: passed
        ? `Quiz passed! +50 XP 🎉`
        : `Score: ${score}% — Need ${PASSING_GRADE}% to pass.`,
      data: { score, passed, report, attempts: newAttempts },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};