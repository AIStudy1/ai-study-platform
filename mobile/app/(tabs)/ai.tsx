import React, { useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiAgentChat } from "@/services/api";
import FileQuizModal from "@/components/FileQuizModal";

const PRIMARY = "#9cd21f";

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

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isLoading?: boolean;
}

const WELCOME: Record<string, string> = {
  tutor: "Hey! I'm your personal tutor 🎓\n\nAsk me anything — concepts, formulas, definitions, homework help. I'll explain it clearly.\n\nWhat are you studying today?",
  course_builder: "Hi! I'm your Course Builder 📚\n\nTell me any topic and I'll generate a full course with chapters and quizzes.\n\nTry: 'Build a course on Machine Learning'",
  goals: "Hey there! I'm your Goals Coach 🎯\n\nShare your big dream — whether it's a career, a skill, or a life goal — and I'll break it down into a clear roadmap.\n\nWhat's your dream?",
  career: "Hello! I'm your Career Advisor 💼\n\nI can help you with CV writing, interview prep, internship hunting, and career planning.\n\nWhat's your field of study and what career are you aiming for?",
  wellness: "Hi, I'm your Wellness Coach 🧘\n\nThis is a safe space. How are you feeling today? Are you stressed, overwhelmed, or just need someone to talk to?\n\nI'm here to listen and help.",
  budget: "Hey! I'm your Budget Advisor 💰\n\nI'll help you manage your student finances — budgeting, saving, tracking expenses and making the most of your money.\n\nTell me about your current financial situation and I'll help you plan.",
};

export default function AIScreen() {
  const [selectedAgent, setSelectedAgent] = useState<typeof AGENTS[0] | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [quizModalVisible, setQuizModalVisible] = useState(false);

  const genId = () => Math.random().toString(36).substr(2, 9);

  const openAgent = (agent: typeof AGENTS[0]) => {
    setSelectedAgent(agent);
    setMessages([{ id: "1", role: "assistant", content: WELCOME[agent.id] }]);
    setInput("");
  };

  const closeAgent = () => {
    setSelectedAgent(null);
    setMessages([]);
    setInput("");
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !selectedAgent) return;

    const userMsg: Message = { id: genId(), role: "user", content: text };
    const loadingMsg: Message = { id: genId(), role: "assistant", content: "", isLoading: true };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");
    setSending(true);

    try {
      const history = messages
        .filter((m) => !m.isLoading)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await apiAgentChat(selectedAgent.id, text, history);

      setMessages((prev) =>
        prev.map((m) =>
          m.isLoading ? { ...m, content: res.data.reply, isLoading: false } : m
        )
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.isLoading
            ? { ...m, content: "Sorry, something went wrong. Please try again.", isLoading: false }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  };

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

      {/* Agent Chat Modal */}
      <Modal visible={!!selectedAgent} animationType="slide" presentationStyle="pageSheet">
        {selectedAgent && (
          <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
            <KeyboardAvoidingView
              style={{ flex: 1 }}
              behavior={Platform.OS === "ios" ? "padding" : "height"}
              keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
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
                <View style={[styles.onlineDot, { backgroundColor: selectedAgent.color }]} />
              </View>

              {/* Messages */}
              <ScrollView style={styles.msgContainer} contentContainerStyle={styles.msgContent}>
                {messages.map((msg) => (
                  <View
                    key={msg.id}
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

      <FileQuizModal visible={quizModalVisible} onClose={() => setQuizModalVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 20, backgroundColor: "white",
  },
  headerTitle: { fontSize: 26, fontWeight: "bold", color: "#333" },
  headerSubtitle: { fontSize: 13, color: "#666", marginTop: 2 },
  quizBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: PRIMARY + "20", alignItems: "center", justifyContent: "center",
  },
  list: { padding: 16, paddingBottom: 40 },
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
  iconBox: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  emoji: { fontSize: 28 },
  cardInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" },
  agentName: { fontSize: 16, fontWeight: "bold", color: "#333" },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  tagText: { fontSize: 11, fontWeight: "600" },
  agentDesc: { fontSize: 13, color: "#666", lineHeight: 18 },
  chatHeader: {
    flexDirection: "row", alignItems: "center", padding: 16,
    backgroundColor: "white", elevation: 2, gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center",
  },
  chatIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  chatName: { fontSize: 16, fontWeight: "bold", color: "#333" },
  chatTagline: { fontSize: 12, color: "#999" },
  onlineDot: { width: 10, height: 10, borderRadius: 5 },
  msgContainer: { flex: 1, backgroundColor: "#f7f8f6" },
  msgContent: { padding: 16, paddingBottom: 8 },
  bubble: { flexDirection: "row", alignItems: "flex-end", marginBottom: 12 },
  userBubble: { justifyContent: "flex-end" },
  aiBubble: { justifyContent: "flex-start" },
  aiAvatar: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 8 },
  bubbleInner: { maxWidth: "78%", borderRadius: 18, padding: 12 },
  userInner: { borderBottomRightRadius: 4 },
  aiInner: { backgroundColor: "white", borderBottomLeftRadius: 4, elevation: 1 },
  msgText: { fontSize: 14, lineHeight: 22 },
  inputRow: {
    flexDirection: "row", alignItems: "flex-end", padding: 12,
    backgroundColor: "white", borderTopWidth: 1, borderTopColor: "#e5e7eb", gap: 10,
  },
  textInput: {
    flex: 1, backgroundColor: "#f3f4f6", borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: "#333", maxHeight: 100,
  },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
});
