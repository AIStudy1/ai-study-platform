import { Platform } from "react-native";
import Constants from "expo-constants";
import { supabase } from "@/supabaseConfig";

/**
 * API base URL. On a real phone, localhost points at the phone — use your PC's LAN IP.
 * Expo sets hostUri (e.g. 192.168.x.x:8081) while Metro runs; we reuse that IP for :8000.
 */
function inferDevBackendUrl(): string | undefined {
  const raw =
    Constants.expoConfig?.hostUri ??
    (Constants as { manifest?: { debuggerHost?: string } }).manifest?.debuggerHost;
  if (typeof raw !== "string" || !raw.includes(":")) return undefined;
  const host = raw.split(":")[0];
  if (!/^\d+\.\d+\.\d+\.\d+$/.test(host)) return undefined;
  return `http://${host}:8000`;
}

const BACKEND_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  inferDevBackendUrl() ??
  (Platform.OS === "android" ? "http://10.0.2.2:8000" : "http://localhost:8000");

function networkErrorHelp(): string {
  const isLocal =
    BACKEND_URL.includes("localhost") ||
    BACKEND_URL.includes("127.0.0.1") ||
    BACKEND_URL.includes("10.0.2.2");
  if (!isLocal) {
    return ` Cannot reach ${BACKEND_URL}. Check VPN, firewall, and that the server is running.`;
  }
  return (
    ` Cannot reach ${BACKEND_URL}. On a physical device use your computer's Wi‑Fi IP: create mobile/.env with EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:8000` +
    ` (same network as the phone). Ensure the backend is running and Windows Firewall allows port 8000.`
  );
}

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

  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Network request failed";
    throw new Error(`${msg}.${networkErrorHelp()}`);
  }

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
  entry_quiz?: {
    title?: string;
    questions: { question: string; options: string[]; answer: string }[];
  };
  chapters: {
    title: string;
    content: string;
    quiz?: { title: string; questions?: { question: string; options: string[]; answer: string }[] };
  }[];
}) => authRequest("POST", "/api/ai-courses", course);

export const apiSubmitEntryQuiz = (courseId: string, answers: string[]) =>
  authRequest("POST", `/api/ai-courses/${courseId}/entry-quiz/submit`, { answers });

export const apiDeleteCourse = (id: string) =>
  authRequest("DELETE", `/api/ai-courses/${id}`);

export const apiCompleteChapter = (courseId: string, chapterId: string) =>
  authRequest("PATCH", `/api/ai-courses/${courseId}/chapters/${chapterId}/complete`);

export const apiSubmitQuiz = (
  courseId: string,
  quizId: string,
  payload: { score: number } | { answers: string[] }
) => authRequest("PATCH", `/api/ai-courses/${courseId}/quizzes/${quizId}/submit`, payload);

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

export const apiGenerateDiagnostic = (subject: string) =>
  authRequest("POST", "/api/ai/diagnostic", { subject });

export const apiGenerateStudyPlan = (
  subjects: string[],
  dailyHours = 2,
  diagnosticResults: any[] = []
) =>
  authRequest("POST", "/api/ai/study-plan", {
    subjects,
    dailyHours,
    diagnosticResults,
  });

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

  let response: Response;
  try {
    response = await fetch(`${BACKEND_URL}/api/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Network request failed";
    throw new Error(`${msg}.${networkErrorHelp()}`);
  }

  const data = await response.json();
  if (!data.success) throw new Error(data.message);
  return data;
};

// ─── AI Agent Chats (Threads) ────────────────────────────────────────────────
export const apiListConversations = (agentId?: string) =>
  authRequest(
    "GET",
    agentId ? `/api/ai/conversations?agentId=${encodeURIComponent(agentId)}` : "/api/ai/conversations"
  );

export const apiCreateConversation = (agentId: string, title?: string) =>
  authRequest("POST", "/api/ai/conversations", { agentId, title });

export const apiGetConversationMessages = (conversationId: string) =>
  authRequest("GET", `/api/ai/conversations/${conversationId}/messages`);

export const apiListCourseSuggestions = (status?: string) =>
  authRequest(
    "GET",
    status
      ? `/api/ai/course-suggestions?status=${encodeURIComponent(status)}`
      : "/api/ai/course-suggestions"
  );

export const apiPatchCourseSuggestion = (
  id: string,
  body: { status?: string; courseId?: string }
) =>
  authRequest("PATCH", `/api/ai/course-suggestions/${id}`, {
    status: body.status,
    courseId: body.courseId,
  });

export const apiAgentChat = (
  agentId: string,
  message: string,
  conversationId: string,
  attachmentText?: string,
  attachmentName?: string
) =>
  authRequest("POST", "/api/ai/agent-chat", {
    agentId,
    message,
    conversationId,
    attachmentText,
    attachmentName,
  });
