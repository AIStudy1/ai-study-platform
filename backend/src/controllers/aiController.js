import supabase from "../config/supabaseClient.js";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = "llama-3.3-70b-versatile";

// ─── Helper ───────────────────────────────────────────────────────────────────
async function chat(messages) {
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
    systemPrompt: `You are an expert university tutor. Explain concepts clearly, answer academic questions, and guide students through difficult material. Be encouraging, patient, and use examples. Keep responses concise.`,
  },
  course_builder: {
    name: "Course Builder",
    systemPrompt: `You are a curriculum designer. When a student gives you a topic, help them refine it then generate a structured course outline. Be specific about chapters and what each one covers.`,
  },
  goals: {
    name: "Goals Coach",
    systemPrompt: `You are a life and academic goals coach for university students. Help them define their dream goal then break it into: a 4-year roadmap, this semester's focus, this month's targets, this week's actions, today's first step. Be specific and motivating.`,
  },
  career: {
    name: "Career Advisor",
    systemPrompt: `You are a university career advisor. Help with CV writing, interview prep, internship hunting, LinkedIn optimization and career path planning. Ask about their field and goals first then give specific actionable advice.`,
  },
  wellness: {
    name: "Wellness Coach",
    systemPrompt: `You are a student wellness and mental health coach. Check in on how the student feels, detect stress or burnout, suggest coping strategies and healthy habits. Be warm and empathetic. Never diagnose. If someone seems in crisis always recommend speaking to a professional.`,
  },
  budget: {
    name: "Budget Advisor",
    systemPrompt: `You are a financial advisor for university students. Help with monthly budget planning, tracking expenses, saving tips and managing scholarships. Be practical and realistic about student budgets.`,
  },
};

// ─── POST /api/ai/agent-chat ──────────────────────────────────────────────────
export const agentChat = async (req, res) => {
  try {
    const { agentId, message, history = [] } = req.body;

    if (!agentId || !message) {
      return res.status(400).json({ success: false, message: "agentId and message are required" });
    }

    const agent = AGENTS[agentId];
    if (!agent) {
      return res.status(400).json({ success: false, message: "Invalid agent ID" });
    }

    const messages = [
      { role: "system", content: agent.systemPrompt },
      ...history,
      { role: "user", content: message },
    ];

    const reply = await chat(messages);

    // Log activity
    await supabase.from("activity_logs").insert({
      user_id: req.user.id,
      type: "agent_chat",
      description: `Chatted with ${agent.name}`,
    });

    return res.status(200).json({ success: true, data: { reply } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
