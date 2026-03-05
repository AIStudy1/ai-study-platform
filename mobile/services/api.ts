import { supabase } from "@/supabaseConfig";

const BACKEND_URL = "http://192.168.1.193:8000";

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