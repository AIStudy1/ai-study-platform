import supabase from "../config/supabaseClient.js";
import { getAuthedSupabaseClient } from "../utils/supabaseAuthedClient.js";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

async function chat(messages) {
  const response = await groq.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.7,
  });
  return response.choices[0].message.content;
}

function parseJSON(raw) {
  const clean = String(raw).replace(/```json|```/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  return JSON.parse(match ? match[0] : clean);
}

// ─── GET /api/planner/tasks ───────────────────────────────────────────────────

export const getTasks = async (req, res) => {
  try {
    const db = getAuthedSupabaseClient(req.accessToken);
    const { filter } = req.query;

    let query = db
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
    const db = getAuthedSupabaseClient(req.accessToken);
    const { title, due_date, type, linked_course_id, notes } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    const { data, error } = await db
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
      .single();

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
    const db = getAuthedSupabaseClient(req.accessToken);
    const { id } = req.params;

    const { data, error } = await db
      .from("tasks")
      .update({ is_done: true, completed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error) throw error;

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
    const db = getAuthedSupabaseClient(req.accessToken);
    const { id } = req.params;

    const { error } = await db
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

// ─── POST /api/planner/ai-generate ───────────────────────────────────────────

export const generateTasksWithAI = async (req, res) => {
  try {
    const db = getAuthedSupabaseClient(req.accessToken);
    const { goal, days = 7 } = req.body;

    if (!goal) {
      return res.status(400).json({ success: false, message: "Goal is required" });
    }

    const { data: courses } = await db
      .from("ai_courses")
      .select("title, subject, total_chapters, completed_chapters")
      .eq("user_id", req.user.id)
      .limit(5);

    const courseContext = courses && courses.length > 0
      ? courses.map((c) => `- ${c.title} (${c.completed_chapters}/${c.total_chapters} chapters done)`).join("\n")
      : "No active courses";

    const raw = await chat([
      {
        role: "system",
        content: "You are a study planner assistant. Respond with valid JSON only, no extra text.",
      },
      {
        role: "user",
        content:
          `Generate a ${days}-day study task list for a student.\n` +
          `Goal: ${goal}\n` +
          `Active courses:\n${courseContext}\n\n` +
          `Return this exact JSON structure:\n` +
          `{\n` +
          `  "tasks": [\n` +
          `    {\n` +
          `      "title": "task title",\n` +
          `      "due_date": "YYYY-MM-DD",\n` +
          `      "type": "study|revision|quiz|reading|practice",\n` +
          `      "notes": "short tip or context"\n` +
          `    }\n` +
          `  ]\n` +
          `}\n` +
          `Generate ${days * 2} tasks spread over ${days} days starting from today (${new Date().toISOString().split("T")[0]}).`,
      },
    ]);

    const parsed = parseJSON(raw);
    const tasks = parsed.tasks || [];

    const toInsert = tasks.map((t) => ({
      user_id: req.user.id,
      title: t.title,
      due_date: t.due_date || null,
      type: t.type || "study",
      notes: t.notes || null,
      is_done: false,
    }));

    const { data, error } = await db
      .from("tasks")
      .insert(toInsert)
      .select();

    if (error) throw error;

    await supabase.from("activity_logs").insert({
      user_id: req.user.id,
      type: "ai_plan_generated",
      description: `AI generated ${tasks.length} tasks for: ${goal}`,
    });

    return res.status(201).json({
      success: true,
      message: `${tasks.length} tasks generated!`,
      data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};