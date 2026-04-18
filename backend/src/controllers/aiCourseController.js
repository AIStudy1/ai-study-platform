import supabase from "../config/supabaseClient.js";
import { getAuthedSupabaseClient } from "../utils/supabaseAuthedClient.js";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

async function chat(messages) {
  const response = await groq.chat.completions.create({ model: MODEL, messages, temperature: 0.7 });
  return response.choices[0].message.content;
}

export const getUserCourses = async (req, res) => {
  try {
    const db = getAuthedSupabaseClient(req.accessToken);
    const { data, error } = await db
      .from("ai_courses")
      .select(`*, chapters(id, title, order_index, is_completed, quizzes(id, title, score, passed))`)
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

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
    }));
    const { data: createdChapters, error: chaptersError } = await db.from("chapters").insert(chaptersToInsert).select();
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
    return res.status(200).json({ success: true, message: "Chapter marked as complete", data: { completed_chapters: completedCount } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PATCH /api/ai-courses/:courseId/quizzes/:quizId/submit ──────────────────
// Passing grade: 80%. Generates AI report after submission.
export const submitQuiz = async (req, res) => {
  try {
    const { courseId, quizId } = req.params;
    const { score, chapterTitle, questions = [], userAnswers = [] } = req.body;

    if (score === undefined || score < 0 || score > 100) {
      return res.status(400).json({ success: false, message: "Score must be between 0 and 100" });
    }

    const PASSING_GRADE = 80;
    const passed = score >= PASSING_GRADE;

    const db = getAuthedSupabaseClient(req.accessToken);
    const { error } = await db
      .from("quizzes")
      .update({ score, passed, completed_at: new Date().toISOString() })
      .eq("id", quizId)
      .eq("course_id", courseId);
    if (error) throw error;

    // Generate AI report
    let report = null;
    try {
      const wrongAnswers = questions
        .map((q, i) => ({ question: q.question, correct: q.answer, given: userAnswers[i] }))
        .filter((q) => q.given !== q.correct);

      const correctAnswers = questions
        .map((q, i) => ({ question: q.question }))
        .filter((_, i) => userAnswers[i] === questions[i]?.answer);

      const reportMessages = [
        {
          role: "system",
          content: `You are an academic performance analyst. Always respond with valid JSON only, no extra text.`,
        },
        {
          role: "user",
          content: `A student just completed a quiz on "${chapterTitle || "a chapter"}".
Score: ${score}% (${passed ? "PASSED" : "FAILED"} — passing grade is ${PASSING_GRADE}%)

Questions answered correctly (${correctAnswers.length}):
${correctAnswers.map((q) => `- ${q.question}`).join("\n") || "None"}

Questions answered incorrectly (${wrongAnswers.length}):
${wrongAnswers.map((q) => `- ${q.question} (correct: ${q.correct}, given: ${q.given})`).join("\n") || "None"}

Generate a personalized report with this exact JSON:
{
  "summary": "2 sentence overall performance summary",
  "strengths": ["specific strength based on correct answers"],
  "improvements": ["specific topic to review based on wrong answers"],
  "recommendation": "one concrete next step for the student",
  "passed": ${passed}
}`,
        },
      ];

      const raw = await chat(reportMessages);
      const clean = raw.replace(/```json|```/g, "").trim();
      report = JSON.parse(clean);
    } catch (e) {
      report = {
        summary: passed ? "Good work! You passed the quiz." : "Keep studying and try again.",
        strengths: ["Keep it up!"],
        improvements: ["Review the chapter material"],
        recommendation: passed ? "Move on to the next chapter." : "Re-read the chapter and retry.",
        passed,
      };
    }

    await logActivity(req.user.id, passed ? "quiz_passed" : "quiz_failed", `Quiz score: ${score}% — ${passed ? "Passed ✅" : "Failed ❌"}`);
    if (passed) await awardXP(req.user.id, 50);

    return res.status(200).json({
      success: true,
      message: passed ? `Quiz passed! +50 XP 🎉` : `Score: ${score}% — Need ${PASSING_GRADE}% to pass.`,
      data: { score, passed, report },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

async function logActivity(userId, type, description) {
  await supabase.from("activity_logs").insert({ user_id: userId, type, description });
}

async function awardXP(userId, amount) {
  const { data: user } = await supabase.from("users").select("xp, level").eq("id", userId).single();
  if (!user) return;
  const newXP = (user.xp || 0) + amount;
  const newLevel = Math.floor(newXP / 1000) + 1;
  await supabase.from("users").update({ xp: newXP, level: newLevel }).eq("id", userId);
}