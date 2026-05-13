import supabase from "../config/supabaseClient.js";

// ─── GET /api/planner/tasks ───────────────────────────────────────────────────

export const getTasks = async (req, res) => {
  try {
    const { filter } = req.query;

    let query = supabase
      .from("tasks")
      .select("*")
      .eq("user_id", req.user.id)
      .order("due_date", { ascending: true });

    if (filter === "today") {
      const today = new Date().toISOString().split("T")[0];
      query = query.eq("due_date", today);
    } else if (filter === "done") {
      query = query.eq("is_done", true);
    } else {
      query = query.eq("is_done", false);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/planner/tasks ──────────────────────────────────────────────────

export const createTask = async (req, res) => {
  try {
    const { title, due_date, type, linked_course_id, notes } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: req.user.id,
        title: title.trim(),
        due_date: due_date || null,
        type: type || "general",
        linked_course_id: linked_course_id || null,
        notes: notes || null,
        is_done: false,
      })
      .select()
      .maybeSingle();

    if (error) throw error;

    await supabase.from("activity_logs").insert({
      user_id: req.user.id,
      type: "task_created",
      description: `New task: ${title}`,
    });

    return res.status(201).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── PATCH /api/planner/tasks/:id/done ───────────────────────────────────────

export const completeTask = async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from("tasks")
      .update({ is_done: true, completed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, message: "Task not found" });

    await supabase.from("activity_logs").insert({
      user_id: req.user.id,
      type: "task_completed",
      description: `Completed task: ${data.title} ✅`,
    });

    return res.status(200).json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── DELETE /api/planner/tasks/:id ───────────────────────────────────────────

export const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user.id);

    if (error) throw error;

    return res.status(200).json({ success: true, message: "Task deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
