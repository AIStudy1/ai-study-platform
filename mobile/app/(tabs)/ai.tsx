import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

const PRIMARY = "#9cd21f";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AIAssistant() {
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your AI study assistant 👋 Ask me anything about your courses and I'll help you understand it better!",
    },
  ]);
  const [input, setInput] = useState("");

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Our AI is coming soon! 🚀 We're building something amazing for you.",
        },
      ]);
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 500);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Title */}
        <View style={styles.header}>
          <View style={styles.aiDot} />
          <Text style={styles.headerTitle}>AI Study Assistant</Text>
        </View>

        {/* Coming Soon Banner */}
        <View style={styles.banner}>
          <Ionicons name="construct-outline" size={16} color={PRIMARY} />
          <Text style={styles.bannerText}>
            AI features coming soon — we're building our own!
          </Text>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: true })
          }
        >
          {messages.map((msg, index) => (
            <View
              key={index}
              style={[
                styles.messageBubble,
                msg.role === "user" ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              {msg.role === "assistant" && (
                <View style={styles.assistantIcon}>
                  <Ionicons name="sparkles" size={14} color="white" />
                </View>
              )}
              <View
                style={[
                  styles.bubbleContent,
                  msg.role === "user"
                    ? styles.userContent
                    : styles.assistantContent,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    msg.role === "user"
                      ? styles.userText
                      : styles.assistantText,
                  ]}
                >
                  {msg.content}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask me anything..."
            placeholderTextColor="#999"
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!input.trim()}
          >
            <Ionicons name="send" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    backgroundColor: "white",
    elevation: 2,
    gap: 8,
  },
  aiDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PRIMARY,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f9e8",
    padding: 10,
    paddingHorizontal: 16,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  bannerText: {
    fontSize: 12,
    color: "#555",
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  userBubble: {
    justifyContent: "flex-end",
  },
  assistantBubble: {
    justifyContent: "flex-start",
  },
  assistantIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  bubbleContent: {
    maxWidth: "75%",
    borderRadius: 16,
    padding: 12,
  },
  userContent: {
    backgroundColor: PRIMARY,
    borderBottomRightRadius: 4,
  },
  assistantContent: {
    backgroundColor: "white",
    borderBottomLeftRadius: 4,
    elevation: 1,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userText: {
    color: "white",
  },
  assistantText: {
    color: "#333",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    backgroundColor: "white",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#ccc",
  },
});