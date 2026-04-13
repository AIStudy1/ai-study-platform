import supabase from "../config/supabaseClient.js";
import { getAuthedSupabaseClient } from "../utils/supabaseAuthedClient.js";

/**
 * GET /api/ai-courses
 * Get all AI courses for the logged in user
 */
export const getUserCourses = async (req, res) => {
  try {
    const db = getAuthedSupabaseClient(req.accessToken);
    const { data, error } = await db
      .from("ai_courses")
      .select(`
        *,
        chapters (
          id,
          title,
          order_index,
          is_completed,
          quizzes (
            id,
            title,
            score,
            passed
          )
        )
      `)
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/ai-courses
 * Create a new AI course with chapters
 */
export const createCourse = async (req, res) => {
  try {
    const { title, subject, description, chapters } = req.body;

    if (!title || !chapters || chapters.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Title and chapters are required",
      });
    }

    const db = getAuthedSupabaseClient(req.accessToken);

    // Create the course
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

    // Create chapters
    const chaptersToInsert = chapters.map((chapter, index) => ({
      course_id: course.id,
      title: chapter.title,
      content: chapter.content || "",
      order_index: index + 1,
      is_completed: false,
    }));

    const { data: createdChapters, error: chaptersError } = await db
      .from("chapters")
      .insert(chaptersToInsert)
      .select();

    if (chaptersError) throw chaptersError;

    // Create quizzes for each chapter if provided
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

    if (quizzesToInsert.length > 0) {
      await db.from("quizzes").insert(quizzesToInsert);
    }

    // Log activity
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

/**
 * GET /api/ai-courses/:id
 * Get a single course with all chapters and quizzes
 */
export const getCourseById = async (req, res) => {
  try {
    const { id } = req.params;

    const db = getAuthedSupabaseClient(req.accessToken);
    const { data, error } = await db
      .from("ai_courses")
      .select(`
        *,
        chapters (
          *,
          quizzes (*)
        )
      `)
      .eq("id", id)
      .eq("user_id", req.user.id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    // Sort chapters by order
    data.chapters = data.chapters.sort((a, b) => a.order_index - b.order_index);

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/ai-courses/:id
 * Delete a course
 */
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

/**
 * PATCH /api/ai-courses/:courseId/chapters/:chapterId/complete
 * Mark a chapter as complete
 */
export const completeChapter = async (req, res) => {
  try {
    const { courseId, chapterId } = req.params;
    const db = getAuthedSupabaseClient(req.accessToken);

    // Mark chapter complete
    const { error: chapterError } = await db
      .from("chapters")
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq("id", chapterId)
      .eq("course_id", courseId);

    if (chapterError) throw chapterError;

    // Count completed chapters
    const { count: completedCount } = await db
      .from("chapters")
      .select("*", { count: "exact", head: true })
      .eq("course_id", courseId)
      .eq("is_completed", true);

    // Update course completed_chapters count
    const { error: courseError } = await db
      .from("ai_courses")
      .update({ completed_chapters: completedCount || 0 })
      .eq("id", courseId)
      .eq("user_id", req.user.id);

    if (courseError) throw courseError;

    // Log activity
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

/**
 * PATCH /api/ai-courses/:courseId/quizzes/:quizId/submit
 * Submit quiz result
 */
export const submitQuiz = async (req, res) => {
  try {
    const { courseId, quizId } = req.params;
    const { score } = req.body;

    if (score === undefined || score < 0 || score > 100) {
      return res.status(400).json({
        success: false,
        message: "Score must be between 0 and 100",
      });
    }

    const passed = score >= 60;

    const db = getAuthedSupabaseClient(req.accessToken);
    const { error } = await db
      .from("quizzes")
      .update({
        score,
        passed,
        completed_at: new Date().toISOString(),
      })
      .eq("id", quizId)
      .eq("course_id", courseId);

    if (error) throw error;

    // Log activity
    await logActivity(
      req.user.id,
      passed ? "quiz_passed" : "quiz_failed",
      `Quiz score: ${score}% — ${passed ? "Passed ✅" : "Failed ❌"}`
    );

    // Award XP if passed
    if (passed) {
      await awardXP(req.user.id, 50);
    }

    return res.status(200).json({
      success: true,
      message: passed ? "Quiz passed! +50 XP" : "Quiz failed. Try again!",
      data: { score, passed },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function logActivity(userId, type, description) {
  await supabase.from("activity_logs").insert({
    user_id: userId,
    type,
    description,
  });
}

async function awardXP(userId, amount) {
  const { data: user } = await supabase
    .from("users")
    .select("xp, level")
    .eq("id", userId)
    .single();

  if (!user) return;

  const newXP = (user.xp || 0) + amount;
  const newLevel = Math.floor(newXP / 1000) + 1;

  await supabase
    .from("users")
    .update({ xp: newXP, level: newLevel })
    .eq("id", userId);
}