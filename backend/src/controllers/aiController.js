import supabase from "../config/supabaseClient.js";
import Groq from "groq-sdk";
import { getAuthedSupabaseClient } from "../utils/supabaseAuthedClient.js";

const MODEL = "llama-3.3-70b-versatile";

let groqClient = null;

function getGroq() {
  if (groqClient) return groqClient;
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is missing. Add it to backend/.env (create a key at https://console.groq.com/keys)"
    );
  }
  groqClient = new Groq({ apiKey });
  return groqClient;
}

// ─── Helper ───────────────────────────────────────────────────────────────────
async function chat(messages) {
  const groq = getGroq();
  const response = await groq.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.7,
  });
  return response.choices[0].message.content;
}

// ─── POST /api/ai/chat ────────────────────────────────────────────────────────
export const chatWithAI = async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ success: false, message: "Message is required" });

    const messages = [
      {
        role: "system",
        content: `You are a smart, friendly study assistant for university students. 
        Help them understand concepts, answer questions, and guide their learning.
        Be concise, clear, and encouraging.`,
      },
      ...history,
      { role: "user", content: message },
    ];

    const reply = await chat(messages);
    return res.status(200).json({ success: true, data: { reply } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/ai/generate-course ─────────────────────────────────────────────
export const generateCourse = async (req, res) => {
  try {
    const { topic, level = "beginner" } = req.body;
    if (!topic) return res.status(400).json({ success: false, message: "Topic is required" });

    const messages = [
      {
        role: "system",
        content: `You are a curriculum designer. Always respond with valid JSON only, no extra text.`,
      },
      {
        role: "user",
        content: `Create a complete course on "${topic}" for a ${level} level student.
        Respond with this exact JSON structure:
        {
          "title": "course title",
          "subject": "subject area",
          "description": "short description",
          "entry_quiz": {
            "title": "short placement quiz title",
            "questions": [
              {
                "question": "question text",
                "options": ["A", "B", "C", "D"],
                "answer": "A"
              }
            ]
          },
          "chapters": [
            {
              "title": "chapter title",
              "content": "detailed chapter content (at least 3 paragraphs)",
              "quiz": {
                "title": "quiz title",
                "questions": [
                  {
                    "question": "question text",
                    "options": ["A", "B", "C", "D"],
                    "answer": "A"
                  }
                ]
              }
            }
          ]
        }
        Generate exactly 5 questions in entry_quiz to assess the student's starting level on this topic (mix easy/medium).
        Generate 4 chapters. Each chapter must have 3 quiz questions.`,
      },
    ];

    const raw = await chat(messages);
    const clean = raw.replace(/```json|```/g, "").trim();
    const course = JSON.parse(clean);

    return res.status(200).json({ success: true, data: course });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/ai/diagnostic ──────────────────────────────────────────────────
export const generateDiagnostic = async (req, res) => {
  try {
    const { subject } = req.body;
    if (!subject) return res.status(400).json({ success: false, message: "Subject is required" });

    const messages = [
      {
        role: "system",
        content: `You are an academic assessment expert. Always respond with valid JSON only, no extra text.`,
      },
      {
        role: "user",
        content: `Generate a diagnostic quiz for a university student on "${subject}".
        Respond with this exact JSON structure:
        {
          "subject": "${subject}",
          "questions": [
            {
              "question": "question text",
              "options": ["A", "B", "C", "D"],
              "answer": "A",
              "difficulty": "easy|medium|hard"
            }
          ]
        }
        Generate exactly 5 questions, mix of easy, medium and hard.`,
      },
    ];

    const raw = await chat(messages);
    const clean = raw.replace(/```json|```/g, "").trim();
    const quiz = JSON.parse(clean);

    return res.status(200).json({ success: true, data: quiz });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/ai/study-plan ──────────────────────────────────────────────────
export const generateStudyPlan = async (req, res) => {
  try {
    const { subjects, dailyHours = 2, diagnosticResults = [] } = req.body;
    if (!subjects || subjects.length === 0)
      return res.status(400).json({ success: false, message: "Subjects are required" });

    const messages = [
      {
        role: "system",
        content: `You are a study coach. Always respond with valid JSON only, no extra text.`,
      },
      {
        role: "user",
        content: `Create a 1-week study plan for a student.
        Subjects: ${subjects.join(", ")}
        Daily study hours available: ${dailyHours}
        Diagnostic results: ${JSON.stringify(diagnosticResults)}
        
        Respond with this exact JSON structure:
        {
          "days": [
            {
              "day": "Monday",
              "tasks": [
                {
                  "subject": "subject name",
                  "task": "what to study",
                  "duration": "45 mins",
                  "type": "reading|quiz|revision|practice"
                }
              ]
            }
          ]
        }
        Generate a plan for all 7 days.`,
      },
    ];

    const raw = await chat(messages);
    const clean = raw.replace(/```json|```/g, "").trim();
    const plan = JSON.parse(clean);

    return res.status(200).json({ success: true, data: plan });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/ai/exam-readiness ──────────────────────────────────────────────
export const getExamReadiness = async (req, res) => {
  try {
    const { subject, quizScores = [], chaptersCompleted = 0, totalChapters = 0, streakDays = 0 } = req.body;
    if (!subject) return res.status(400).json({ success: false, message: "Subject is required" });

    const avgScore = quizScores.length > 0
      ? Math.round(quizScores.reduce((a, b) => a + b, 0) / quizScores.length)
      : 0;
    const progress = totalChapters > 0 ? Math.round((chaptersCompleted / totalChapters) * 100) : 0;

    const messages = [
      {
        role: "system",
        content: `You are an academic performance analyst. Always respond with valid JSON only, no extra text.`,
      },
      {
        role: "user",
        content: `Assess exam readiness for a student studying "${subject}".
        Average quiz score: ${avgScore}%
        Course progress: ${progress}%
        Study streak: ${streakDays} days
        
        Respond with this exact JSON structure:
        {
          "subject": "${subject}",
          "readiness": 75,
          "level": "good|needs work|not ready",
          "strengths": ["strength 1", "strength 2"],
          "weaknesses": ["weakness 1", "weakness 2"],
          "recommendation": "short advice paragraph"
        }`,
      },
    ];

    const raw = await chat(messages);
    const clean = raw.replace(/```json|```/g, "").trim();
    const readiness = JSON.parse(clean);

    return res.status(200).json({ success: true, data: readiness });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/ai/quiz-from-file ──────────────────────────────────────────────
export const generateQuizFromFile = async (req, res) => {
  try {
    const { fileText, fileName } = req.body;

    if (!fileText) {
      return res.status(400).json({ success: false, message: "File text is required" });
    }

    const messages = [
      {
        role: "system",
        content: `You are an academic assessment expert. Always respond with valid JSON only, no extra text.`,
      },
      {
        role: "user",
        content: `Based on the following study material, generate a diagnostic quiz.
        
Material: "${fileText.slice(0, 3000)}"

Respond with this exact JSON structure:
{
  "subject": "detected subject from the material",
  "questions": [
    {
      "question": "question text",
      "options": ["A", "B", "C", "D"],
      "answer": "A",
      "difficulty": "easy|medium|hard"
    }
  ]
}
Generate exactly 5 questions based strictly on the content above.`,
      },
    ];

    const raw = await chat(messages);
    const clean = raw.replace(/```json|```/g, "").trim();
    const quiz = JSON.parse(clean);

    return res.status(200).json({ success: true, data: { ...quiz, fileName } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── POST /api/ai/save-diagnostic ─────────────────────────────────────────────
export const saveDiagnosticResult = async (req, res) => {
  try {
    const { subject, score, total, fileName } = req.body;

    const { error } = await supabase.from("diagnostic_results").insert({
      user_id: req.user.id,
      subject,
      score,
      total,
      source: "file",
      file_name: fileName,
    });

    if (error) throw error;

    const passed = (score / total) * 100 >= 60;
    const messages = [
      {
        role: "system",
        content: `You are a study coach. Always respond with valid JSON only, no extra text.`,
      },
      {
        role: "user",
        content: `A student just scored ${score}/${total} on a diagnostic quiz about "${subject}".
        ${passed ? "They performed well." : "They struggled with this material."}
        
        Create a focused 3-day study plan to help them improve.
        Respond with this exact JSON structure:
        {
          "days": [
            {
              "day": "Day 1",
              "tasks": [
                {
                  "subject": "${subject}",
                  "task": "what to study",
                  "duration": "45 mins",
                  "type": "reading|quiz|revision|practice"
                }
              ]
            }
          ]
        }`,
      },
    ];

    const raw = await chat(messages);
    const clean = raw.replace(/```json|```/g, "").trim();
    const plan = JSON.parse(clean);

    await supabase.from("study_plans").insert({
      user_id: req.user.id,
      subjects: [subject],
      plan,
    });

    return res.status(200).json({
      success: true,
      message: "Result saved",
      data: { plan },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Agent Definitions ────────────────────────────────────────────────────────
const AGENTS = {
  tutor: {
    name: "Tutor",
    systemPrompt: `You are an expert university tutor. Explain concepts clearly, answer academic questions, and guide students through difficult material. Be encouraging, patient, and use examples. Keep responses concise. Use the student's diagnostic scores and course progress to focus on their weak areas.`,
  },
  course_builder: {
    name: "Course Builder",
    systemPrompt: `You are a curriculum designer. When a student gives you a topic, help them refine it then generate a structured course outline. Be specific about chapters and what each one covers. Use their current courses to avoid duplication and suggest complementary topics.`,
  },
  goals: {
    name: "Goals Coach",
    systemPrompt: `You are a life and academic goals coach for university students. Help them define their dream goal then break it into: a 4-year roadmap, this semester's focus, this month's targets, this week's actions, today's first step. Be specific and motivating. Use their current level, XP and courses to make the roadmap realistic.`,
  },
  career: {
    name: "Career Advisor",
    systemPrompt: `You are a university career advisor. Help with CV writing, interview prep, internship hunting, LinkedIn optimization and career path planning. Use the student's courses and level to give field-specific advice.`,
  },
  wellness: {
    name: "Wellness Coach",
    systemPrompt: `You are a student wellness and mental health coach. Check in on how the student feels, detect stress or burnout, suggest coping strategies and healthy habits. Be warm and empathetic. Never diagnose. If the student's streak has dropped or scores are falling, gently acknowledge it. If someone seems in crisis always recommend speaking to a professional.`,
  },
  budget: {
    name: "Budget Advisor",
    systemPrompt: `You are a financial advisor for university students. Help with monthly budget planning, tracking expenses, saving tips and managing scholarships. Be practical and realistic about student budgets.`,
  },
};

const JSON_FORMAT_RULE = `
OUTPUT FORMAT: Respond with valid JSON only (no markdown code fences). Shape:
{"reply":"your full natural reply (newlines allowed inside the string)","courseSuggestion":null}
If the student clearly wants a new multi-chapter AI course in the app on a concrete topic, use:
{"reply":"...","courseSuggestion":{"shouldSuggest":true,"topic":"short specific topic","level":"beginner"|"intermediate"|"advanced"}}
Use courseSuggestion only when they want to learn/build/study a structured course on something specific; otherwise null.`;

function clipAgentContent(s) {
  if (!s) return "";
  const max = 3200;
  return s.length <= max ? s : s.slice(0, max) + "…";
}

function buildCrossAgentSection(orderedMessages) {
  if (!orderedMessages?.length) return "";
  const lines = orderedMessages.map((m) => {
    const label = AGENTS[m.agent_id]?.name || m.agent_id;
    const who = m.role === "user" ? "Student" : label;
    return `[${label}] ${who}: ${clipAgentContent(m.content)}`;
  });
  return `\nSHARED CONTEXT FROM OTHER ASSISTANTS (same student; use when it helps continuity; stay in your role):\n${lines.join("\n")}\n`;
}

function normalizeAgentCourseSuggestion(cs) {
  if (!cs || typeof cs !== "object" || !cs.shouldSuggest || !cs.topic) return null;
  const level = ["beginner", "intermediate", "advanced"].includes(cs.level)
    ? cs.level
    : "beginner";
  return {
    shouldSuggest: true,
    topic: String(cs.topic).trim().slice(0, 400),
    level,
  };
}

function parseAgentStructuredOutput(raw) {
  if (!raw || typeof raw !== "string") {
    return { reply: "Sorry, I could not produce a reply.", courseSuggestion: null };
  }
  const cleaned = raw.replace(/```json\s*|```/gi, "").trim();
  try {
    const o = JSON.parse(cleaned);
    if (o && typeof o.reply === "string") {
      return { reply: o.reply, courseSuggestion: o.courseSuggestion ?? null };
    }
  } catch {
    /* treat as plain text */
  }
  return { reply: raw, courseSuggestion: null };
}

async function groqAgentStructuredJson(messages) {
  const groq = getGroq();
  try {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.65,
      max_tokens: 4096,
      response_format: { type: "json_object" },
    });
    return response.choices[0].message.content;
  } catch {
    const response = await groq.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.65,
      max_tokens: 4096,
    });
    return response.choices[0].message.content;
  }
}

// ─── POST /api/ai/agent-chat ──────────────────────────────────────────────────
export const agentChat = async (req, res) => {
  try {
    const { agentId, message, conversationId, attachmentText, attachmentName } = req.body ?? {};

    if (!agentId || !message?.trim()) {
      return res.status(400).json({ success: false, message: "agentId and message are required" });
    }
    if (!conversationId) {
      return res.status(400).json({ success: false, message: "conversationId is required" });
    }

    const agent = AGENTS[agentId];
    if (!agent) {
      return res.status(400).json({ success: false, message: "Invalid agent ID" });
    }

    const authed = getAuthedSupabaseClient(req.accessToken);

    const { data: conv, error: convErr } = await authed
      .from("ai_conversations")
      .select("id, agent_id, user_id")
      .eq("id", conversationId)
      .eq("user_id", req.user.id)
      .single();

    if (convErr || !conv) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }
    if (conv.agent_id !== agentId) {
      return res.status(400).json({
        success: false,
        message: "This thread belongs to a different assistant",
      });
    }

    let userContent = message.trim();
    const trimmedAtt = typeof attachmentText === "string" ? attachmentText.trim() : "";
    if (trimmedAtt) {
      userContent += `\n\n[Uploaded file: ${attachmentName || "document"}]\n${trimmedAtt.slice(0, 14000)}`;
    }

    const { error: userInsErr } = await authed.from("ai_messages").insert({
      conversation_id: conversationId,
      user_id: req.user.id,
      agent_id: agentId,
      role: "user",
      content: userContent,
    });

    if (userInsErr) {
      console.error("ai_messages user insert:", userInsErr);
      return res.status(500).json({
        success: false,
        message: userInsErr.message || "Could not save your message",
      });
    }

    const { data: threadRows, error: threadErr } = await authed
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(60);

    if (threadErr) throw threadErr;

    const threadForModel = (threadRows || []).map(({ role, content }) => ({
      role: role === "assistant" ? "assistant" : "user",
      content: clipAgentContent(content),
    }));

    const { data: otherConvs } = await authed
      .from("ai_conversations")
      .select("id")
      .eq("user_id", req.user.id)
      .neq("agent_id", agentId);

    const otherIds = (otherConvs || []).map((c) => c.id).filter(Boolean);
    let crossSection = "";
    if (otherIds.length) {
      const { data: crossRows } = await authed
        .from("ai_messages")
        .select("role, content, agent_id, created_at")
        .in("conversation_id", otherIds)
        .order("created_at", { ascending: false })
        .limit(36);

      crossSection = buildCrossAgentSection((crossRows || []).reverse());
    }

    const [
      { data: profile },
      { data: courses },
      { data: diagnostics },
      { data: goal },
    ] = await Promise.all([
      supabase.from("users").select("full_name, xp, level, streak_days, study_hours").eq("id", req.user.id).single(),
      supabase.from("ai_courses").select("title, subject, total_chapters, completed_chapters").eq("user_id", req.user.id).order("created_at", { ascending: false }).limit(8),
      supabase.from("diagnostic_results").select("subject, score, total, taken_at").eq("user_id", req.user.id).order("taken_at", { ascending: false }).limit(5),
      supabase.from("daily_goals").select("goal_minutes, studied_minutes, streak_days").eq("user_id", req.user.id).single(),
    ]);

    const courseList = (courses || []).map((c) => {
      const pct = c.total_chapters > 0
        ? Math.round((c.completed_chapters / c.total_chapters) * 100)
        : 0;
      return `  - ${c.title} (${c.subject}): ${pct}% complete`;
    }).join("\n") || "  - No courses yet";

    const diagnosticList = (diagnostics || []).map((d) => {
      const pct = Math.round((d.score / d.total) * 100);
      return `  - ${d.subject}: ${pct}%`;
    }).join("\n") || "  - No diagnostics yet";

    const studentContext = `
STUDENT CONTEXT (personalize using this):
- Name: ${profile?.full_name || "Student"}
- Level: ${profile?.level || 1} | XP: ${profile?.xp || 0}
- Study streak: ${profile?.streak_days || goal?.streak_days || 0} days
- Study hours total: ${profile?.study_hours || 0}h
- Daily goal: ${goal?.goal_minutes || 30} mins/day

Current courses:
${courseList}

Recent diagnostic scores:
${diagnosticList}

Address the student by name when natural. Align with facts from shared context from other assistants when relevant.
`;

    const systemContent = `${agent.systemPrompt}${crossSection}\n${studentContext}\n${JSON_FORMAT_RULE}`;

    const groqMessages = [{ role: "system", content: systemContent }, ...threadForModel];

    const raw = await groqAgentStructuredJson(groqMessages);
    const { reply, courseSuggestion: csRaw } = parseAgentStructuredOutput(raw);
    const normalizedSuggestion = normalizeAgentCourseSuggestion(csRaw);

    let courseSuggestion = normalizedSuggestion;
    if (normalizedSuggestion) {
      const { data: inserted, error: sugErr } = await authed
        .from("course_suggestions")
        .insert({
          user_id: req.user.id,
          conversation_id: conversationId,
          agent_id: agentId,
          topic: normalizedSuggestion.topic,
          level: normalizedSuggestion.level,
          status: "pending",
        })
        .select("id")
        .single();

      if (!sugErr && inserted?.id) {
        courseSuggestion = { ...normalizedSuggestion, id: inserted.id };
      } else if (sugErr) {
        console.warn("course_suggestions insert skipped:", sugErr.message);
      }
    }

    const { error: asstInsErr } = await authed.from("ai_messages").insert({
      conversation_id: conversationId,
      user_id: req.user.id,
      agent_id: agentId,
      role: "assistant",
      content: reply,
    });

    if (asstInsErr) {
      console.error("ai_messages assistant insert:", asstInsErr);
    }

    await authed
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId)
      .eq("user_id", req.user.id);

    await supabase.from("activity_logs").insert({
      user_id: req.user.id,
      type: "agent_chat",
      description: `Chatted with ${agent.name}`,
    });

    return res.status(200).json({
      success: true,
      data: { reply, courseSuggestion },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
