import { getAuthedSupabaseClient } from "../utils/supabaseAuthedClient.js";

// GET /api/ai/course-suggestions?status=pending
export const listCourseSuggestions = async (req, res) => {
  try {
    const db = getAuthedSupabaseClient(req.accessToken);
    const status = req.query.status ?? null;

    let q = db
      .from("course_suggestions")
      .select("id, conversation_id, agent_id, topic, level, status, course_id, created_at, updated_at")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (status) q = q.eq("status", status);

    const { data, error } = await q;
    if (error) throw error;
    return res.status(200).json({ success: true, data: data ?? [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/ai/course-suggestions/:id  body: { status?, courseId? }
export const patchCourseSuggestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, courseId } = req.body ?? {};

    if (!status && courseId === undefined) {
      return res.status(400).json({ success: false, message: "Provide status and/or courseId" });
    }

    const db = getAuthedSupabaseClient(req.accessToken);
    const updates = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (courseId !== undefined) {
      updates.course_id = courseId;
      if (!status) updates.status = "created";
    }

    const { data, error } = await db
      .from("course_suggestions")
      .update(updates)
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select("id, status, course_id, topic, level, agent_id, created_at, updated_at")
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ success: false, message: "Suggestion not found" });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
