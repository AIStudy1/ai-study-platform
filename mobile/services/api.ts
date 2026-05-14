import { supabase } from "@/supabaseConfig";
import Constants from "expo-constants";
const BACKEND_URL = Constants.expoConfig?.extra?.apiUrl ?? "http://192.168.0.108:8000";

const getToken = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
};

const authRequest = async (method: string, endpoint: string, body?: any) => {
  const token = await getToken();
  if (!token) throw new Error("Session expired. Please login again.");
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const data = JSON.parse(text);
  if (!data.success) throw new Error(data.message);
  return data;
};

// ─── AI Courses ───────────────────────────────────────────────────────────────
export const apiGetMyCourses = () => authRequest("GET", "/api/ai-courses");
export const apiGetCourse = (id: string) => authRequest("GET", `/api/ai-courses/${id}`);
export const apiCreateCourse = (course: {
  title: string; subject: string; description: string;
  chapters: { title: string; content: string; quiz?: { title: string } }[];
}) => authRequest("POST", "/api/ai-courses", course);
export const apiDeleteCourse = (id: string) => authRequest("DELETE", `/api/ai-courses/${id}`);
export const apiCompleteChapter = (courseId: string, chapterId: string) =>
  authRequest("PATCH", `/api/ai-courses/${courseId}/chapters/${chapterId}/complete`);
export const apiSubmitQuiz = (
  courseId: string, quizId: string, score: number,
  chapterTitle?: string, questions?: any[], userAnswers?: string[]
) => authRequest("PATCH", `/api/ai-courses/${courseId}/quizzes/${quizId}/submit`, { score, chapterTitle, questions, userAnswers });

// ─── Entry Quiz ───────────────────────────────────────────────────────────────
export const apiGenerateEntryQuiz = (courseId: string) =>
  authRequest("POST", `/api/ai-courses/${courseId}/entry-quiz/generate`);
export const apiSubmitEntryQuiz = (courseId: string, userAnswers: string[]) =>
  authRequest("POST", `/api/ai-courses/${courseId}/entry-quiz/submit`, { userAnswers });

// ─── Activity ─────────────────────────────────────────────────────────────────
export const apiGetActivity = (limit = 20, offset = 0) =>
  authRequest("GET", `/api/activity?limit=${limit}&offset=${offset}`);
export const apiLogActivity = (type: string, description: string) =>
  authRequest("POST", "/api/activity", { type, description });
export const apiClearActivity = () => authRequest("DELETE", "/api/activity");

// ─── User Profile & Goals ─────────────────────────────────────────────────────
export const apiGetProfile = () => authRequest("GET", "/api/user/profile");
export const apiUpdateProfile = (updates: { full_name?: string; avatar_url?: string }) =>
  authRequest("PATCH", "/api/user/profile", updates);
export const apiGetGoal = () => authRequest("GET", "/api/user/goal");
export const apiUpdateGoal = (goal_minutes: number) =>
  authRequest("PATCH", "/api/user/goal", { goal_minutes });
export const apiAddStudyProgress = (minutes: number) =>
  authRequest("POST", "/api/user/goal/progress", { minutes });

// ─── AI (general) ─────────────────────────────────────────────────────────────
export const apiChatWithAI = (message: string, history: { role: string; content: string }[]) =>
  authRequest("POST", "/api/ai/chat", { message, history });
export const apiGenerateCourse = (topic: string, level = "beginner") =>
  authRequest("POST", "/api/ai/generate-course", { topic, level });
export const apiGenerateQuizFromFile = (fileText: string, fileName: string) =>
  authRequest("POST", "/api/ai/quiz-from-file", { fileText, fileName });
export const apiSaveDiagnosticResult = (subject: string, score: number, total: number, fileName: string) =>
  authRequest("POST", "/api/ai/save-diagnostic", { subject, score, total, fileName });

// ─── File upload ──────────────────────────────────────────────────────────────
export const apiUploadFile = async (fileUri: string, fileName: string, mimeType: string) => {
  const token = await getToken();
  if (!token) throw new Error("Not authenticated");
  const formData = new FormData();
  formData.append("file", { uri: fileUri, name: fileName, type: mimeType } as any);
  const response = await fetch(`${BACKEND_URL}/api/upload`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData,
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.message);
  return data;
};

// ─── Voice transcription ──────────────────────────────────────────────────────
export const apiTranscribeAudio = async (audioUri: string) => {
  const token = await getToken();
  if (!token) throw new Error("Not authenticated");
  const isWav = audioUri.toLowerCase().includes(".wav");
  const formData = new FormData();
  formData.append("audio", { uri: audioUri, name: isWav ? "voice.wav" : "voice.m4a", type: isWav ? "audio/wav" : "audio/m4a" } as any);
  const response = await fetch(`${BACKEND_URL}/api/ai/transcribe`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData,
  });
  const data = await response.json();
  if (!data.success) throw new Error(data.message);
  return data;
};

// ─── AI Agent Chats ───────────────────────────────────────────────────────────
export const apiListConversations = (agentId?: string) =>
  authRequest("GET", agentId ? `/api/ai/conversations?agentId=${encodeURIComponent(agentId)}` : "/api/ai/conversations");
export const apiCreateConversation = (agentId: string, title?: string) =>
  authRequest("POST", "/api/ai/conversations", { agentId, title });
export const apiGetConversationMessages = (conversationId: string) =>
  authRequest("GET", `/api/ai/conversations/${conversationId}/messages`);
export const apiAgentChat = (
  agentId: string, message: string, conversationId: string,
  attachmentText?: string, attachmentName?: string
) => authRequest("POST", "/api/ai/agent-chat", { agentId, message, conversationId, attachmentText, attachmentName });

// ─── Rewards & Badges ─────────────────────────────────────────────────────────
export const apiGetBadges = () => authRequest("GET", "/api/rewards/badges");

// ─── Leaderboard ─────────────────────────────────────────────────────────────
export const apiGetLeaderboard = (type: "global" | "friends" = "global", period: "weekly" | "alltime" = "weekly") =>
  authRequest("GET", `/api/streaks/leaderboard?type=${type}&period=${period}`);

// ─── Streaks ──────────────────────────────────────────────────────────────────
export const apiGetStreak = () => authRequest("GET", "/api/streaks");
export const apiRecordStudyActivity = (activityType: string, xpEarned = 0) =>
  authRequest("POST", "/api/streaks/record", { activityType, xpEarned });
export const apiBuyStreakFreeze = () => authRequest("POST", "/api/streaks/freeze");

// ─── Friends ──────────────────────────────────────────────────────────────────
export const apiGetFriends = () => authRequest("GET", "/api/streaks/friends");
export const apiSearchUsers = (query: string) =>
  authRequest("GET", `/api/streaks/friends/search?q=${encodeURIComponent(query)}`);
export const apiAddFriend = (body: { friendId?: string; inviteCode?: string }) =>
  authRequest("POST", "/api/streaks/friends", body);
export const apiRespondToFriend = (friendshipId: string, action: "accept" | "reject") =>
  authRequest("PATCH", `/api/streaks/friends/${friendshipId}`, { action });
export const apiGetInviteCode = () => authRequest("GET", "/api/streaks/invite-code");

// ─── Planner ──────────────────────────────────────────────────────────────────
export const apiGetTasks = (filter?: "today" | "all" | "done") =>
  authRequest("GET", `/api/planner/tasks${filter ? `?filter=${filter}` : ""}`);
export const apiCreateTask = (task: {
  title: string; due_date?: string; type?: string; linked_course_id?: string; notes?: string;
}) => authRequest("POST", "/api/planner/tasks", task);
export const apiCompleteTask = (id: string) => authRequest("PATCH", `/api/planner/tasks/${id}/done`, {});
export const apiDeleteTask = (id: string) => authRequest("DELETE", `/api/planner/tasks/${id}`);
export const apiGenerateTasksWithAI = (goal: string, days?: number) =>
  authRequest("POST", "/api/planner/ai-generate", { goal, days });

// ─── Pre-course quiz ──────────────────────────────────────────────────────────
export const apiGeneratePreCourseQuiz = (topic: string) =>
  authRequest("POST", "/api/ai/pre-course-quiz/generate", { topic });
export const apiSubmitPreCourseQuiz = (topic: string, questions: any[], userAnswers: string[]) =>
  authRequest("POST", "/api/ai/pre-course-quiz/submit", { topic, questions, userAnswers });

// ─── Flashcards ───────────────────────────────────────────────────────────────

/** Generate flashcards for a chapter (reuses existing if already generated) */
export const apiGenerateFlashcards = (
  courseId: string, chapterId: string, chapterTitle: string, chapterContent: string
) => authRequest("POST", "/api/flashcards/generate", { courseId, chapterId, chapterTitle, chapterContent });

/** Get ALL flashcards grouped by course → chapter (permanent library) */
export const apiGetAllFlashcards = () => authRequest("GET", "/api/flashcards/all");

/** Get cards due for review today */
export const apiGetFlashcardsDue = (courseId?: string, limit = 30) =>
  authRequest("GET", `/api/flashcards/due${courseId ? `?courseId=${courseId}&limit=${limit}` : `?limit=${limit}`}`);

/** Overall flashcard stats */
export const apiGetFlashcardStats = () => authRequest("GET", "/api/flashcards/stats");

/** Submit SM-2 rating for a single card */
export const apiReviewFlashcard = (cardId: string, rating: 1 | 2 | 4 | 5) =>
  authRequest("PATCH", `/api/flashcards/${cardId}/review`, { rating });

/** Call when a full review session ends */
export const apiCompleteReviewSession = (cardsReviewed: number, correctCount: number) =>
  authRequest("POST", "/api/flashcards/session-complete", { cardsReviewed, correctCount });