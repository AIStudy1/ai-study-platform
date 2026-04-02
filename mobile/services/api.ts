import { supabase } from "@/supabaseConfig";

const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";


// Helper to get the auth token from Supabase session
const getToken = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
};

// Helper for authenticated requests
const authRequest = async (
  method: string,
  endpoint: string,
  body?: any
) => {
  const token = await getToken();
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json();
  if (!data.success) throw new Error(data.message);
  return data;
};

// ─── AI Courses ──────────────────────────────────────────────────────────────

export const apiGetMyCourses = () =>
  authRequest("GET", "/api/ai-courses");

export const apiGetCourse = (id: string) =>
  authRequest("GET", `/api/ai-courses/${id}`);

export const apiCreateCourse = (course: {
  title: string;
  subject: string;
  description: string;
  chapters: { title: string; content: string; quiz?: { title: string } }[];
}) => authRequest("POST", "/api/ai-courses", course);

export const apiDeleteCourse = (id: string) =>
  authRequest("DELETE", `/api/ai-courses/${id}`);

export const apiCompleteChapter = (courseId: string, chapterId: string) =>
  authRequest("PATCH", `/api/ai-courses/${courseId}/chapters/${chapterId}/complete`);

export const apiSubmitQuiz = (courseId: string, quizId: string, score: number) =>
  authRequest("PATCH", `/api/ai-courses/${courseId}/quizzes/${quizId}/submit`, { score });

// ─── Activity ────────────────────────────────────────────────────────────────

export const apiGetActivity = (limit = 20, offset = 0) =>
  authRequest("GET", `/api/activity?limit=${limit}&offset=${offset}`);

export const apiLogActivity = (type: string, description: string) =>
  authRequest("POST", "/api/activity", { type, description });

export const apiClearActivity = () =>
  authRequest("DELETE", "/api/activity");

// ─── User Profile & Goals ────────────────────────────────────────────────────

export const apiGetProfile = () =>
  authRequest("GET", "/api/user/profile");

export const apiUpdateProfile = (updates: { full_name?: string; avatar_url?: string }) =>
  authRequest("PATCH", "/api/user/profile", updates);

export const apiGetGoal = () =>
  authRequest("GET", "/api/user/goal");

export const apiUpdateGoal = (goal_minutes: number) =>
  authRequest("PATCH", "/api/user/goal", { goal_minutes });

export const apiAddStudyProgress = (minutes: number) =>
  authRequest("POST", "/api/user/goal/progress", { minutes });
export const apiChatWithAI = (message: string, history: { role: string; content: string }[]) =>
  authRequest("POST", "/api/ai/chat", { message, history });

export const apiGenerateCourse = (topic: string, level = "beginner") =>
  authRequest("POST", "/api/ai/generate-course", { topic, level });
export const apiGenerateQuizFromFile = (fileText: string, fileName: string) =>
  authRequest("POST", "/api/ai/quiz-from-file", { fileText, fileName });

export const apiSaveDiagnosticResult = (subject: string, score: number, total: number, fileName: string) =>
  authRequest("POST", "/api/ai/save-diagnostic", { subject, score, total, fileName });

export const apiUploadFile = async (fileUri: string, fileName: string, mimeType: string) => {
  const token = await getToken();
  if (!token) throw new Error("Not authenticated");

  const formData = new FormData();
  formData.append("file", {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as any);

  const response = await fetch(`${BACKEND_URL}/api/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json();
  if (!data.success) throw new Error(data.message);
  return data;
};
export const apiAgentChat = (
  agentId: string,
  message: string,
  history: { role: string; content: string }[] = []
) => authRequest("POST", "/api/ai/agent-chat", { agentId, message, history });