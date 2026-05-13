import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  apiAgentChat,
  apiCreateConversation,
  apiGetConversationMessages,
  apiListConversations,
} from "@/services/api";
import FileQuizModal from "@/components/FileQuizModal";

const PRIMARY = "#9cd21f";
const PASSING_GRADE = 80;

// ─── Types ────────────────────────────────────────────────────────────────────

interface PreCourseQuestion {
  question: string;
  options: string[];
  answer: string;
  difficulty: "easy" | "medium" | "hard";
  topic: string;
}

interface PreCourseQuiz {
  title: string;
  description: string;
  questions: PreCourseQuestion[];
}

type PreCourseStep =
  | "idle"           // not started
  | "generating"     // fetching quiz from backend
  | "quiz"           // student answering questions
  | "submitting"     // evaluating + generating + saving course
  | "result";        // showing result, ready to navigate

interface PreCourseResult {
  courseId: string;
  courseTitle: string;
  level: "beginner" | "intermediate" | "advanced";
  score: number;
  message: string;
}

// ─── Agents ───────────────────────────────────────────────────────────────────

const AGENTS = [
  {
    id: "tutor",
    name: "Tutor",
    emoji: "🎓",
    tagline: "Explains anything",
    description: "Ask me any academic question and I'll break it down clearly.",
    color: "#9cd21f",
    bg: "#f0f9e8",
  },
  {
    id: "course_builder",
    name: "Course Builder",
    emoji: "📚",
    tagline: "Build a full course",
    description: "Tell me a topic and I'll generate a complete course with chapters and quizzes.",
    color: "#3b82f6",
    bg: "#eff6ff",
  },
  {
    id: "goals",
    name: "Goals Coach",
    emoji: "🎯",
    tagline: "Reach your dreams",
    description: "Share your dream goal and I'll build a step-by-step roadmap to get there.",
    color: "#8b5cf6",
    bg: "#f5f3ff",
  },
  {
    id: "career",
    name: "Career Advisor",
    emoji: "💼",
    tagline: "Land your dream job",
    description: "CV writing, interview prep, internship hunting — I've got you covered.",
    color: "#f97316",
    bg: "#fff7ed",
  },
  {
    id: "wellness",
    name: "Wellness Coach",
    emoji: "🧘",
    tagline: "Mind & balance",
    description: "Feeling stressed or burned out? Let's talk and get you back on track.",
    color: "#22c55e",
    bg: "#f0fdf4",
  },
  {
    id: "budget",
    name: "Budget Advisor",
    emoji: "💰",
    tagline: "Smart with money",
    description: "Student budget planning, saving tips and managing your finances.",
    color: "#eab308",
    bg: "#fefce8",
  },
];

// ─── Welcome messages ─────────────────────────────────────────────────────────

const WELCOME: Record<string, string> = {
  tutor:
    "Hey! I'm your personal tutor 🎓\n\nAsk me anything — concepts, formulas, definitions, homework help. I'll explain it clearly.\n\nWhat are you studying today?",
  course_builder:
    "Hi! I'm your Course Builder 📚\n\nTell me any topic and I'll generate a complete course tailored to your level.\n\nTry: 'I want to learn Machine Learning'",
  goals:
    "Hey there! I'm your Goals Coach 🎯\n\nShare your big dream — whether it's a career, a skill, or a life goal — and I'll break it down into a clear roadmap.\n\nWhat's your dream?",
  career:
    "Hello! I'm your Career Advisor 💼\n\nI can help you with CV writing, interview prep, internship hunting, and career planning.\n\nWhat's your field of study and what career are you aiming for?",
  wellness:
    "Hi, I'm your Wellness Coach 🧘\n\nThis is a safe space. How are you feeling today? Are you stressed, overwhelmed, or just need someone to talk to?\n\nI'm here to listen and help.",
  budget:
    "Hey! I'm your Budget Advisor 💰\n\nI'll help you manage your student finances — budgeting, saving, tracking expenses and making the most of your money.\n\nTell me about your current financial situation and I'll help you plan.",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
  courseSuggestion?: { topic: string; level: string };
}

type Conversation = {
  id: string;
  agent_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

function looksLikeCourseIntent(text: string) {
  const t = (text ?? "").toLowerCase();
  return (
    t.includes("learn") || t.includes("study") || t.includes("course") ||
    t.includes("apprendre") || t.includes("étudier") || t.includes("etudier") ||
    t.includes("cours") || t.includes("تعلم") || t.includes("أتعلم") ||
    t.includes("أدرس") || t.includes("دورة")
  );
}

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "#22c55e",
  medium: "#f97316",
  hard: "#ef4444",
};

const LEVEL_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  beginner:     { label: "Beginner",     color: "#22c55e", bg: "#f0fdf4", icon: "🟢" },
  intermediate: { label: "Intermediate", color: "#f97316", bg: "#fff7ed", icon: "🟡" },
  advanced:     { label: "Advanced",     color: "#ef4444", bg: "#fef2f2", icon: "🔴" },
};

// ─── Animated option button (reused from course.tsx pattern) ──────────────────

function OptionButton({
  option, index, onPress, state,
}: {
  option: string; index: number;
  onPress: () => void;
  state: "idle" | "correct" | "wrong";
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const bgColor    = state === "correct" ? "#22c55e" : state === "wrong" ? "#ef4444" : "white";
  const borderColor = state === "correct" ? "#22c55e" : state === "wrong" ? "#ef4444" : "#e5e7eb";

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 80, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[pcStyles.optionBtn, { backgroundColor: bgColor, borderColor }]}
        onPress={handlePress}
        disabled={state !== "idle"}
        activeOpacity={0.8}
      >
        <View style={[pcStyles.optionLetter, {
          backgroundColor: state !== "idle" ? "rgba(255,255,255,0.25)" : "#f3f4f6",
        }]}>
          <Text style={[pcStyles.optionLetterText, state !== "idle" && { color: "white" }]}>
            {["A", "B", "C", "D"][index]}
          </Text>
        </View>
        <Text style={[pcStyles.optionText, state !== "idle" && { color: "white" }]}>{option}</Text>
        {state === "correct" && <Ionicons name="checkmark-circle" size={20} color="white" />}
        {state === "wrong"   && <Ionicons name="close-circle"     size={20} color="white" />}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Course suggestion inline card ───────────────────────────────────────────

function CourseSuggestionCard({
  topic, onStart, loading,
}: {
  topic: string;
  onStart: () => void;
  loading: boolean;
}) {
  return (
    <View style={pcStyles.suggestionCard}>
      <View style={pcStyles.suggestionHeader}>
        <Ionicons name="sparkles" size={18} color="#3b82f6" />
        <Text style={pcStyles.suggestionTitle}>Turn this into a course?</Text>
      </View>
      <Text style={pcStyles.suggestionTopic} numberOfLines={2}>{topic}</Text>
      <Text style={pcStyles.suggestionSub}>
        Take a quick level quiz first — the course will be tailored exactly to where you are.
      </Text>
      <TouchableOpacity
        style={pcStyles.suggestionBtn}
        onPress={onStart}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="white" size="small" />
          : <>
              <Ionicons name="flask-outline" size={16} color="white" />
              <Text style={pcStyles.suggestionBtnText}>Start Learning Journey</Text>
            </>}
      </TouchableOpacity>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function AIScreen() {
  const insets  = useSafeAreaInsets();
  const router  = useRouter();

  const [selectedAgent, setSelectedAgent] = useState<typeof AGENTS[0] | null>(null);
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [input,         setInput]         = useState("");
  const [sending,       setSending]       = useState(false);
  const [quizModalVisible, setQuizModalVisible] = useState(false);
  const [conversationId,   setConversationId]   = useState<string | null>(null);
  const [historyVisible,   setHistoryVisible]   = useState(false);
  const [conversations,    setConversations]    = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages,      setLoadingMessages]      = useState(false);

  // ── Pre-course quiz state ──────────────────────────────────────────────────
  const [pcVisible,     setPcVisible]     = useState(false);
  const [pcTopic,       setPcTopic]       = useState("");
  const [pcStep,        setPcStep]        = useState<PreCourseStep>("idle");
  const [pcQuiz,        setPcQuiz]        = useState<PreCourseQuiz | null>(null);
  const [pcIndex,       setPcIndex]       = useState(0);
  const [pcAnswers,     setPcAnswers]     = useState<string[]>([]);
  const [pcOptionState, setPcOptionState] = useState<"idle" | "correct" | "wrong">("idle");
  const [pcLastAnswer,  setPcLastAnswer]  = useState<string | null>(null);
  const [pcResult,      setPcResult]      = useState<PreCourseResult | null>(null);

  const genId = () => Math.random().toString(36).substr(2, 9);

  const agentWelcome = useMemo(() => {
    if (!selectedAgent) return "";
    return WELCOME[selectedAgent.id] ?? "Hi!";
  }, [selectedAgent]);

  // ── Agent open/close ───────────────────────────────────────────────────────

  const openAgent = async (agent: typeof AGENTS[0]) => {
    setSelectedAgent(agent);
    setConversationId(null);
    setMessages([{ id: "1", role: "assistant", content: WELCOME[agent.id] }]);
    setInput("");
    setHistoryVisible(true);
  };

  const closeAgent = () => {
    setSelectedAgent(null);
    setMessages([]);
    setInput("");
    setConversationId(null);
    setHistoryVisible(false);
    setConversations([]);
  };

  // ── Conversations ──────────────────────────────────────────────────────────

  const refreshConversations = async (agentId: string) => {
    setLoadingConversations(true);
    try {
      const res = await apiListConversations(agentId);
      setConversations(res.data as Conversation[]);
    } finally {
      setLoadingConversations(false);
    }
  };

  useEffect(() => {
    if (!selectedAgent) return;
    refreshConversations(selectedAgent.id);
  }, [selectedAgent?.id]);

  const startNewChat = async () => {
    if (!selectedAgent) return;
    setLoadingMessages(true);
    try {
      const created = await apiCreateConversation(selectedAgent.id);
      const conv    = created.data as Conversation;
      setConversationId(conv.id);
      setMessages([{ id: "1", role: "assistant", content: agentWelcome }]);
      setHistoryVisible(false);
      await refreshConversations(selectedAgent.id);
    } finally {
      setLoadingMessages(false);
    }
  };

  const openConversation = async (conv: Conversation) => {
    if (!selectedAgent) return;
    setLoadingMessages(true);
    try {
      setConversationId(conv.id);
      const res    = await apiGetConversationMessages(conv.id);
      const loaded = (res.data as any[]).map((m) => ({
        id:      m.id,
        role:    m.role,
        content: m.content,
      })) as Message[];
      setMessages(loaded.length > 0 ? loaded : [{ id: "1", role: "assistant", content: agentWelcome }]);
      setHistoryVisible(false);
    } finally {
      setLoadingMessages(false);
    }
  };

  // ── Send message ───────────────────────────────────────────────────────────

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !selectedAgent) return;

    // Auto-create conversation if needed
    let activeConvId = conversationId;
    if (!activeConvId) {
      try {
        const created = await apiCreateConversation(selectedAgent.id);
        activeConvId  = (created.data as Conversation).id;
        setConversationId(activeConvId);
      } catch (e: any) {
        Alert.alert("Error", e.message);
        return;
      }
    }

    const userMsg: Message    = { id: genId(), role: "user",      content: text };
    const loadingMsg: Message = { id: genId(), role: "assistant", content: "", isLoading: true };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");
    setSending(true);

    try {
      const res        = await apiAgentChat(selectedAgent.id, text, activeConvId!);
      const reply      = res.data.reply as string;
      const suggestion = (res.data as any)?.courseSuggestion;

      // Fallback: if backend didn't flag it but message looks like course intent
      const fallbackSuggestion =
        !suggestion?.shouldSuggest && looksLikeCourseIntent(text)
          ? { shouldSuggest: true, topic: text, level: "beginner" }
          : null;

      const finalSuggestion =
        suggestion?.shouldSuggest && suggestion?.topic ? suggestion : fallbackSuggestion;

      // Replace loading bubble, and optionally attach courseSuggestion to it
      setMessages((prev) =>
        prev.map((m) =>
          m.isLoading
            ? {
                ...m,
                content: reply,
                isLoading: false,
                courseSuggestion: finalSuggestion?.shouldSuggest
                  ? { topic: finalSuggestion.topic, level: finalSuggestion.level }
                  : undefined,
              }
            : m
        )
      );

      // Refresh title
      const newTitle = (res.data as any)?.conversationTitle;
      if (newTitle) {
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConvId ? { ...c, title: newTitle } : c))
        );
      }
      await refreshConversations(selectedAgent.id);
    } catch (e: any) {
      const errorMessage = e?.message || "Something went wrong. Please try again.";
      setMessages((prev) =>
        prev.map((m) =>
          m.isLoading ? { ...m, content: `Sorry: ${errorMessage}`, isLoading: false } : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  // ── Pre-course quiz: start ─────────────────────────────────────────────────

  const startPreCourseQuiz = async (topic: string) => {
    setPcTopic(topic);
    setPcStep("generating");
    setPcVisible(true);
    setPcQuiz(null);
    setPcIndex(0);
    setPcAnswers([]);
    setPcOptionState("idle");
    setPcLastAnswer(null);
    setPcResult(null);

    try {
      const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
      const { supabase } = await import("@/supabaseConfig");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(`${BACKEND_URL}/api/ai/pre-course-quiz/generate`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ topic }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      setPcQuiz(json.data);
      setPcStep("quiz");
    } catch (e: any) {
      Alert.alert("Error", e.message);
      setPcVisible(false);
      setPcStep("idle");
    }
  };

  // ── Pre-course quiz: answer ────────────────────────────────────────────────

  const handlePcAnswer = (option: string) => {
    if (!pcQuiz || pcStep !== "quiz") return;
    const currentQ = pcQuiz.questions[pcIndex];
    const isCorrect = option === currentQ.answer;

    setPcOptionState(isCorrect ? "correct" : "wrong");
    setPcLastAnswer(option);

    setTimeout(() => {
      const newAnswers = [...pcAnswers, option];
      setPcAnswers(newAnswers);
      setPcOptionState("idle");
      setPcLastAnswer(null);

      if (pcIndex < pcQuiz.questions.length - 1) {
        setPcIndex((i) => i + 1);
      } else {
        finishPreCourseQuiz(newAnswers);
      }
    }, 700);
  };

  // ── Pre-course quiz: submit ────────────────────────────────────────────────

  const finishPreCourseQuiz = async (answers: string[]) => {
    if (!pcQuiz) return;
    setPcStep("submitting");

    try {
      const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
      const { supabase } = await import("@/supabaseConfig");
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch(`${BACKEND_URL}/api/ai/pre-course-quiz/submit`, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          topic:       pcTopic,
          questions:   pcQuiz.questions,
          userAnswers: answers,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message);

      setPcResult(json.data);
      setPcStep("result");

      // Append success message to chat
      setMessages((prev) => [
        ...prev,
        {
          id:      genId(),
          role:    "assistant",
          content: `✅ Course created: **${json.data.courseTitle}**\n\nLevel: ${json.data.level} · Score: ${json.data.score}%\n\nYou can find it in your dashboard!`,
        },
      ]);
    } catch (e: any) {
      Alert.alert("Course generation failed", e.message);
      setPcStep("quiz"); // let them retry
    }
  };

  // ── Pre-course quiz: close ─────────────────────────────────────────────────

  const closePcQuiz = () => {
    setPcVisible(false);
    setPcStep("idle");
    setPcQuiz(null);
    setPcResult(null);
    setPcIndex(0);
    setPcAnswers([]);
    setPcLastAnswer(null);
  };

  const goToCourse = () => {
    if (!pcResult) return;
    closePcQuiz();
    router.push({
      pathname: "/(tabs)/course",
      params:   { courseId: pcResult.courseId },
    } as any);
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>AI Agents</Text>
          <Text style={styles.headerSubtitle}>Choose your AI assistant</Text>
        </View>
        <TouchableOpacity style={styles.quizBtn} onPress={() => setQuizModalVisible(true)}>
          <Ionicons name="document-text-outline" size={20} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        <View style={styles.banner}>
          <Ionicons name="sparkles" size={18} color={PRIMARY} />
          <Text style={styles.bannerText}>
            6 specialized AI agents — each an expert at one thing
          </Text>
        </View>

        {AGENTS.map((agent) => (
          <TouchableOpacity key={agent.id} style={styles.card} onPress={() => openAgent(agent)}>
            <View style={[styles.iconBox, { backgroundColor: agent.bg }]}>
              <Text style={styles.emoji}>{agent.emoji}</Text>
            </View>
            <View style={styles.cardInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.agentName}>{agent.name}</Text>
                <View style={[styles.tag, { backgroundColor: agent.color + "20" }]}>
                  <Text style={[styles.tagText, { color: agent.color }]}>{agent.tagline}</Text>
                </View>
              </View>
              <Text style={styles.agentDesc} numberOfLines={2}>{agent.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ══ Agent Chat Modal ══════════════════════════════════════════════════ */}
      <Modal visible={!!selectedAgent} animationType="slide" presentationStyle="pageSheet">
        {selectedAgent && (
          <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
            >
              {/* Chat Header */}
              <View style={styles.chatHeader}>
                <TouchableOpacity onPress={closeAgent} style={styles.backBtn}>
                  <Ionicons name="arrow-back" size={20} color="#333" />
                </TouchableOpacity>
                <View style={[styles.chatIcon, { backgroundColor: selectedAgent.bg }]}>
                  <Text style={{ fontSize: 22 }}>{selectedAgent.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chatName}>{selectedAgent.name}</Text>
                  <Text style={styles.chatTagline}>{selectedAgent.tagline}</Text>
                </View>
                <TouchableOpacity onPress={() => setHistoryVisible(true)} style={styles.historyBtn}>
                  <Ionicons name="time-outline" size={20} color="#333" />
                </TouchableOpacity>
                <View style={[styles.onlineDot, { backgroundColor: selectedAgent.color }]} />
              </View>

              {/* History Picker */}
              <Modal visible={historyVisible} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
                  <View style={styles.historyHeader}>
                    <TouchableOpacity onPress={() => setHistoryVisible(false)} style={styles.backBtn}>
                      <Ionicons name="arrow-back" size={20} color="#333" />
                    </TouchableOpacity>
                    <Text style={styles.historyTitle}>Chats</Text>
                    <View style={{ width: 36 }} />
                  </View>
                  <View style={styles.historyActions}>
                    <TouchableOpacity
                      style={[styles.newChatBtn, { backgroundColor: selectedAgent.color }]}
                      onPress={startNewChat}
                      disabled={loadingMessages}
                    >
                      {loadingMessages
                        ? <ActivityIndicator color="white" />
                        : <Text style={styles.newChatBtnText}>New chat</Text>}
                    </TouchableOpacity>
                  </View>
                  <ScrollView contentContainerStyle={styles.historyList}>
                    {loadingConversations ? (
                      <ActivityIndicator color={selectedAgent.color} />
                    ) : conversations.length === 0 ? (
                      <Text style={styles.historyEmpty}>No previous chats yet.</Text>
                    ) : (
                      conversations.map((c) => (
                        <TouchableOpacity
                          key={c.id}
                          style={styles.historyItem}
                          onPress={() => openConversation(c)}
                          disabled={loadingMessages}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.historyItemTitle} numberOfLines={1}>
                              {c.title || "Chat"}
                            </Text>
                            <Text style={styles.historyItemMeta} numberOfLines={1}>
                              {new Date(c.updated_at || c.created_at).toLocaleString()}
                            </Text>
                          </View>
                          <Ionicons name="chevron-forward" size={18} color="#bbb" />
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                </SafeAreaView>
              </Modal>

              {/* Messages */}
              <ScrollView
                style={styles.msgContainer}
                contentContainerStyle={[styles.msgContent, { paddingBottom: insets.bottom + 88 }]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              >
                {messages.map((msg) => (
                  <View key={msg.id}>
                    <View
                      style={[
                        styles.bubble,
                        msg.role === "user" ? styles.userBubble : styles.aiBubble,
                      ]}
                    >
                      {msg.role === "assistant" && (
                        <View style={[styles.aiAvatar, { backgroundColor: selectedAgent.bg }]}>
                          <Text style={{ fontSize: 16 }}>{selectedAgent.emoji}</Text>
                        </View>
                      )}
                      <View
                        style={[
                          styles.bubbleInner,
                          msg.role === "user"
                            ? [styles.userInner, { backgroundColor: selectedAgent.color }]
                            : styles.aiInner,
                        ]}
                      >
                        {msg.isLoading ? (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 4 }}>
                            <ActivityIndicator size="small" color="#999" />
                            <Text style={{ fontSize: 13, color: "#999" }}>Thinking...</Text>
                          </View>
                        ) : (
                          <Text style={[styles.msgText, msg.role === "user" ? { color: "white" } : { color: "#333" }]}>
                            {msg.content}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Inline course suggestion card — only on assistant messages */}
                    {msg.role === "assistant" && msg.courseSuggestion && (
                      <View style={{ paddingLeft: 48 }}>
                        <CourseSuggestionCard
                          topic={msg.courseSuggestion.topic}
                          onStart={() => startPreCourseQuiz(msg.courseSuggestion!.topic)}
                          loading={pcStep === "generating" && pcTopic === msg.courseSuggestion.topic}
                        />
                      </View>
                    )}
                  </View>
                ))}
              </ScrollView>

              {/* Input */}
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.textInput}
                  placeholder={`Message ${selectedAgent.name}...`}
                  placeholderTextColor="#999"
                  value={input}
                  onChangeText={setInput}
                  multiline
                />
                <TouchableOpacity
                  style={[
                    styles.sendBtn,
                    { backgroundColor: selectedAgent.color },
                    (!input.trim() || sending) && { opacity: 0.4 },
                  ]}
                  onPress={sendMessage}
                  disabled={!input.trim() || sending}
                >
                  <Ionicons name="send" size={18} color="white" />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        )}
      </Modal>

      {/* ══ Pre-Course Quiz Modal ═════════════════════════════════════════════ */}
      <Modal visible={pcVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>

          {/* Generating */}
          {pcStep === "generating" && (
            <View style={pcStyles.centered}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={pcStyles.generatingTitle}>Building your level quiz…</Text>
              <Text style={pcStyles.generatingSubtitle}>Topic: {pcTopic}</Text>
            </View>
          )}

          {/* Quiz */}
          {pcStep === "quiz" && pcQuiz && (
            <>
              <View style={pcStyles.header}>
                <TouchableOpacity onPress={closePcQuiz} style={pcStyles.closeBtn}>
                  <Ionicons name="close" size={20} color="#333" />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={pcStyles.headerTitle} numberOfLines={1}>{pcQuiz.title}</Text>
                  <Text style={pcStyles.headerSub}>{pcQuiz.description}</Text>
                </View>
                <View style={{ width: 36 }} />
              </View>

              {/* Progress bar */}
              <View style={pcStyles.progressBg}>
                <View style={[pcStyles.progressFill, {
                  width: `${(pcIndex / pcQuiz.questions.length) * 100}%`,
                }]} />
              </View>

              <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
                <View style={pcStyles.quizMeta}>
                  <Text style={pcStyles.quizCounter}>
                    {pcIndex + 1} / {pcQuiz.questions.length}
                  </Text>
                  <View style={[pcStyles.diffBadge, {
                    backgroundColor: (DIFFICULTY_COLOR[pcQuiz.questions[pcIndex]?.difficulty] ?? "#999") + "20",
                  }]}>
                    <Text style={[pcStyles.diffText, {
                      color: DIFFICULTY_COLOR[pcQuiz.questions[pcIndex]?.difficulty] ?? "#999",
                    }]}>
                      {pcQuiz.questions[pcIndex]?.difficulty}
                    </Text>
                  </View>
                </View>

                {pcQuiz.questions[pcIndex]?.topic && (
                  <Text style={pcStyles.topicLabel}>📌 {pcQuiz.questions[pcIndex].topic}</Text>
                )}

                <Text style={pcStyles.questionText}>
                  {pcQuiz.questions[pcIndex]?.question}
                </Text>

                <View style={pcStyles.options}>
                  {pcQuiz.questions[pcIndex]?.options.map((opt, i) => {
                    const correct = pcQuiz.questions[pcIndex].answer;
                    return (
                      <OptionButton
                        key={i}
                        option={opt}
                        index={i}
                        onPress={() => handlePcAnswer(opt)}
                        state={
                          pcOptionState === "idle"
                            ? "idle"
                            : opt === correct
                            ? "correct"
                            : opt === pcLastAnswer
                            ? "wrong"
                            : "idle"
                        }
                      />
                    );
                  })}
                </View>
              </ScrollView>
            </>
          )}

          {/* Submitting */}
          {pcStep === "submitting" && (
            <View style={pcStyles.centered}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={pcStyles.generatingTitle}>Analysing your level…</Text>
              <Text style={pcStyles.generatingSubtitle}>Generating your personalised course</Text>
            </View>
          )}

          {/* Result */}
          {pcStep === "result" && pcResult && (() => {
            const lm = LEVEL_META[pcResult.level] ?? LEVEL_META.beginner;
            return (
              <>
                <View style={pcStyles.header}>
                  <View style={{ width: 36 }} />
                  <Text style={pcStyles.headerTitle}>Your Course is Ready!</Text>
                  <TouchableOpacity onPress={closePcQuiz} style={pcStyles.closeBtn}>
                    <Ionicons name="close" size={20} color="#333" />
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
                  {/* Score card */}
                  <View style={[pcStyles.resultCard, { borderColor: lm.color }]}>
                    <Text style={{ fontSize: 44 }}>
                      {pcResult.score >= 80 ? "🏆" : pcResult.score >= 50 ? "📈" : "🌱"}
                    </Text>
                    <Text style={[pcStyles.resultScore, { color: lm.color }]}>
                      {pcResult.score}%
                    </Text>
                    <View style={[pcStyles.levelBadge, { backgroundColor: lm.bg }]}>
                      <Text style={[pcStyles.levelBadgeText, { color: lm.color }]}>
                        {lm.icon} {lm.label} Level
                      </Text>
                    </View>
                    <Text style={pcStyles.resultMessage}>{pcResult.message}</Text>
                  </View>

                  {/* Course name */}
                  <View style={pcStyles.courseNameCard}>
                    <Ionicons name="sparkles" size={20} color="#3b82f6" />
                    <View style={{ flex: 1 }}>
                      <Text style={pcStyles.courseNameLabel}>Course created</Text>
                      <Text style={pcStyles.courseNameTitle}>{pcResult.courseTitle}</Text>
                    </View>
                  </View>

                  <Text style={pcStyles.resultInfo}>
                    Your course has been calibrated to your level. As you complete chapters and quizzes, the difficulty will adapt automatically.
                  </Text>

                  <TouchableOpacity style={pcStyles.goBtn} onPress={goToCourse}>
                    <Ionicons name="arrow-forward-circle" size={22} color="white" />
                    <Text style={pcStyles.goBtnText}>Go to My Course</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={pcStyles.laterBtn} onPress={closePcQuiz}>
                    <Text style={pcStyles.laterBtnText}>Later (find it in Dashboard)</Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            );
          })()}

        </SafeAreaView>
      </Modal>

      <FileQuizModal visible={quizModalVisible} onClose={() => setQuizModalVisible(false)} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 20, backgroundColor: "white",
  },
  headerTitle:    { fontSize: 26, fontWeight: "bold", color: "#333" },
  headerSubtitle: { fontSize: 13, color: "#666", marginTop: 2 },
  quizBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: PRIMARY + "20", alignItems: "center", justifyContent: "center",
  },
  list:    { padding: 16, paddingBottom: 40 },
  banner: {
    flexDirection: "row", alignItems: "center", backgroundColor: PRIMARY + "15",
    borderRadius: 12, padding: 12, marginBottom: 20, gap: 10,
    borderWidth: 1, borderColor: PRIMARY + "30",
  },
  bannerText: { fontSize: 13, color: "#444", flex: 1, lineHeight: 18 },
  card: {
    backgroundColor: "white", borderRadius: 16, padding: 16,
    flexDirection: "row", alignItems: "center", marginBottom: 12, elevation: 1, gap: 14,
  },
  iconBox:   { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  emoji:     { fontSize: 28 },
  cardInfo:  { flex: 1 },
  nameRow:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" },
  agentName: { fontSize: 16, fontWeight: "bold", color: "#333" },
  tag:       { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  tagText:   { fontSize: 11, fontWeight: "600" },
  agentDesc: { fontSize: 13, color: "#666", lineHeight: 18 },
  chatHeader: {
    flexDirection: "row", alignItems: "center", padding: 16,
    backgroundColor: "white", elevation: 2, gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center",
  },
  chatIcon:    { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  chatName:    { fontSize: 16, fontWeight: "bold", color: "#333" },
  chatTagline: { fontSize: 12, color: "#999" },
  onlineDot:   { width: 10, height: 10, borderRadius: 5 },
  historyBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center",
  },
  msgContainer: { flex: 1, backgroundColor: "#f7f8f6" },
  msgContent:   { padding: 16, paddingBottom: 8 },
  bubble:       { flexDirection: "row", alignItems: "flex-end", marginBottom: 12 },
  userBubble:   { justifyContent: "flex-end" },
  aiBubble:     { justifyContent: "flex-start" },
  aiAvatar: {
    width: 32, height: 32, borderRadius: 10,
    alignItems: "center", justifyContent: "center", marginRight: 8,
  },
  bubbleInner:  { maxWidth: "78%", borderRadius: 18, padding: 12 },
  userInner:    { borderBottomRightRadius: 4 },
  aiInner:      { backgroundColor: "white", borderBottomLeftRadius: 4, elevation: 1 },
  msgText:      { fontSize: 14, lineHeight: 22 },
  inputRow: {
    flexDirection: "row", alignItems: "flex-end", padding: 12,
    backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#e5e7eb", gap: 10,
  },
  textInput: {
    flex: 1, backgroundColor: "#f3f4f6", borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: "#333",
    maxHeight: 100, textAlignVertical: "center",
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  historyHeader: {
    flexDirection: "row", alignItems: "center", padding: 16,
    backgroundColor: "white", elevation: 2,
  },
  historyTitle:    { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "bold", color: "#333" },
  historyActions:  { padding: 16 },
  newChatBtn:      { paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  newChatBtnText:  { color: "white", fontWeight: "bold" },
  historyList:     { padding: 16, paddingBottom: 30, gap: 10 },
  historyEmpty:    { color: "#666", textAlign: "center", marginTop: 20 },
  historyItem: {
    backgroundColor: "white", borderRadius: 14, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  historyItemTitle: { fontSize: 14, fontWeight: "600", color: "#333" },
  historyItemMeta:  { fontSize: 12, color: "#999", marginTop: 4 },
});

const pcStyles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  generatingTitle:    { fontSize: 18, fontWeight: "bold", color: "#333", marginTop: 20, textAlign: "center" },
  generatingSubtitle: { fontSize: 14, color: "#666", marginTop: 8, textAlign: "center" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, backgroundColor: "white", elevation: 2,
  },
  headerTitle: { fontSize: 16, fontWeight: "bold", color: "#333" },
  headerSub:   { fontSize: 11, color: "#999", marginTop: 2, textAlign: "center" },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center",
  },
  progressBg:   { height: 5, backgroundColor: "#e5e7eb" },
  progressFill: { height: 5, backgroundColor: "#3b82f6" },
  quizMeta:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  quizCounter:  { fontSize: 13, color: "#999" },
  diffBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  diffText:     { fontSize: 12, fontWeight: "600" },
  topicLabel:   { fontSize: 12, color: "#8b5cf6", fontWeight: "600", marginBottom: 8 },
  questionText: { fontSize: 18, fontWeight: "bold", color: "#333", lineHeight: 26, marginBottom: 24 },
  options:      { gap: 12 },
  optionBtn: {
    flexDirection: "row", alignItems: "center", backgroundColor: "white",
    borderRadius: 14, padding: 16, gap: 14, elevation: 1, borderWidth: 1.5, borderColor: "#e5e7eb",
  },
  optionLetter: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center",
  },
  optionLetterText: { fontSize: 13, fontWeight: "bold", color: "#555" },
  optionText:       { fontSize: 14, color: "#333", flex: 1, lineHeight: 20 },
  resultCard: {
    backgroundColor: "white", borderRadius: 20, padding: 28, alignItems: "center",
    marginBottom: 16, elevation: 2, borderWidth: 2,
  },
  resultScore:   { fontSize: 48, fontWeight: "bold", marginTop: 8 },
  levelBadge:    { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, marginTop: 8 },
  levelBadgeText:{ fontSize: 14, fontWeight: "bold" },
  resultMessage: { fontSize: 14, color: "#666", textAlign: "center", marginTop: 12, lineHeight: 20 },
  courseNameCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#eff6ff", borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: "#bfdbfe",
  },
  courseNameLabel: { fontSize: 11, color: "#3b82f6", fontWeight: "600" },
  courseNameTitle: { fontSize: 15, fontWeight: "bold", color: "#1e3a8a", marginTop: 2 },
  resultInfo: { fontSize: 13, color: "#666", lineHeight: 20, textAlign: "center", marginBottom: 24 },
  goBtn: {
    backgroundColor: "#3b82f6", borderRadius: 14, padding: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12,
  },
  goBtnText:   { color: "white", fontWeight: "bold", fontSize: 16 },
  laterBtn:    { alignItems: "center", padding: 12 },
  laterBtnText:{ color: "#999", fontSize: 14 },

  // Suggestion card (inline in chat)
  suggestionCard: {
    backgroundColor: "#eff6ff", borderRadius: 14, padding: 14, marginTop: 8,
    marginBottom: 4, borderWidth: 1, borderColor: "#bfdbfe",
  },
  suggestionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  suggestionTitle:  { fontSize: 13, fontWeight: "bold", color: "#1d4ed8" },
  suggestionTopic:  { fontSize: 15, fontWeight: "bold", color: "#1e3a8a", marginBottom: 6 },
  suggestionSub:    { fontSize: 12, color: "#3b82f6", lineHeight: 17, marginBottom: 12 },
  suggestionBtn: {
    backgroundColor: "#3b82f6", borderRadius: 10, paddingVertical: 10,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  suggestionBtnText: { color: "white", fontWeight: "bold", fontSize: 13 },
});