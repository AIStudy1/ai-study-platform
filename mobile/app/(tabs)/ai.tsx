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
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import { apiChatWithAI, apiGenerateCourse } from "@/services/api";
import FileQuizModal from "@/components/FileQuizModal";

const PRIMARY = "#9cd21f";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  file?: { name: string; type: string };
  image?: string;
  isLoading?: boolean;
}

export default function AIAssistant() {
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hi! I'm your AI study assistant 👋\n\nI can help you:\n• Generate a full course on any topic\n• Explain concepts from your materials\n• Create quizzes and study plans\n• Answer questions about your courses\n\nTry saying: 'Generate a course on Cybersecurity' or tap 📄 to upload a file and get a quiz!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [sending, setSending] = useState(false);
  const [attachedFile, setAttachedFile] = useState<any>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [quizModalVisible, setQuizModalVisible] = useState(false);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text && !attachedFile && !attachedImage) return;

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: text,
      file: attachedFile ? { name: attachedFile.name, type: attachedFile.mimeType } : undefined,
      image: attachedImage || undefined,
    };

    const loadingMessage: Message = {
      id: generateId(),
      role: "assistant",
      content: "",
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMessage, loadingMessage]);
    setInput("");
    setAttachedFile(null);
    setAttachedImage(null);
    setSending(true);
    scrollToBottom();

    try {
      const history = messages
        .filter((m) => !m.isLoading)
        .map((m) => ({ role: m.role, content: m.content }));

      const lower = text.toLowerCase();
      const isCourseRequest =
        lower.includes("generate a course") ||
        lower.includes("create a course") ||
        lower.includes("course on") ||
        lower.includes("course about");

      if (isCourseRequest) {
        const topic = text
          .replace(/generate a course on|generate a course about|create a course on|create a course about|course on|course about/gi, "")
          .trim();

        const courseRes = await apiGenerateCourse(topic);
        const course = courseRes.data;

        setMessages((prev) =>
          prev.map((m) =>
            m.isLoading
              ? {
                  ...m,
                  content: `✅ Course created: ${course.title}\n\n${course.description}\n\n📚 ${course.chapters.length} chapters ready\n🧠 Quizzes included\n\nCheck your dashboard to start learning!`,
                  isLoading: false,
                }
              : m
          )
        );
      } else {
        const res = await apiChatWithAI(text, history);
        setMessages((prev) =>
          prev.map((m) =>
            m.isLoading ? { ...m, content: res.data.reply, isLoading: false } : m
          )
        );
      }
    } catch (error: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.isLoading
            ? {
                ...m,
                content: "Sorry, something went wrong. Please try again.",
                isLoading: false,
              }
            : m
        )
      );
    } finally {
      setSending(false);
      scrollToBottom();
    }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        setAttachedFile(result.assets[0]);
      }
    } catch (error) {
      Alert.alert("Error", "Could not pick file");
    }
  };

  const pickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Please allow access to your photos");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });
      if (!result.canceled && result.assets.length > 0) {
        setAttachedImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Could not pick image");
    }
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Please allow camera access");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!result.canceled && result.assets.length > 0) {
        setAttachedImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Could not open camera");
    }
  };

  const showAttachMenu = () => {
    Alert.alert("Attach", "Choose what to attach", [
      { text: "📄 PDF or Document", onPress: pickFile },
      { text: "🖼️ Photo from Gallery", onPress: pickImage },
      { text: "📷 Take a Photo", onPress: takePhoto },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Please allow microphone access");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      Alert.alert("Error", "Could not start recording");
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      setRecording(null);
      setInput("🎤 Voice message (transcription coming soon)");
    } catch (error) {
      Alert.alert("Error", "Could not stop recording");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.aiDot}>
              <Ionicons name="sparkles" size={18} color="white" />
            </View>
            <View>
              <Text style={styles.headerTitle}>AI Study Assistant</Text>
              <Text style={styles.headerSubtitle}>Powered by LLaMA 3</Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.quizButton}
              onPress={() => setQuizModalVisible(true)}
            >
              <Ionicons name="document-text-outline" size={20} color={PRIMARY} />
            </TouchableOpacity>
            <View style={styles.onlineBadge}>
              <Text style={styles.onlineText}>Online</Text>
            </View>
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          onContentSizeChange={scrollToBottom}
        >
          {messages.map((msg) => (
            <View
              key={msg.id}
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
                  msg.role === "user" ? styles.userContent : styles.assistantContent,
                ]}
              >
                {msg.image && (
                  <Image
                    source={{ uri: msg.image }}
                    style={styles.messageImage}
                    resizeMode="cover"
                  />
                )}

                {msg.file && (
                  <View style={styles.fileAttachment}>
                    <MaterialIcons name="picture-as-pdf" size={18} color={PRIMARY} />
                    <Text style={styles.fileName} numberOfLines={1}>
                      {msg.file.name}
                    </Text>
                  </View>
                )}

                {msg.isLoading ? (
                  <View style={styles.loadingDots}>
                    <ActivityIndicator size="small" color="#999" />
                    <Text style={styles.loadingText}>Thinking...</Text>
                  </View>
                ) : (
                  <Text
                    style={[
                      styles.messageText,
                      msg.role === "user" ? styles.userText : styles.assistantText,
                    ]}
                  >
                    {msg.content}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Attachment preview */}
        {(attachedFile || attachedImage) && (
          <View style={styles.attachmentPreview}>
            {attachedImage && (
              <View style={styles.imagePreview}>
                <Image source={{ uri: attachedImage }} style={styles.previewImage} />
                <TouchableOpacity
                  style={styles.removeAttachment}
                  onPress={() => setAttachedImage(null)}
                >
                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            )}
            {attachedFile && (
              <View style={styles.filePreview}>
                <MaterialIcons name="picture-as-pdf" size={20} color={PRIMARY} />
                <Text style={styles.filePreviewName} numberOfLines={1}>
                  {attachedFile.name}
                </Text>
                <TouchableOpacity onPress={() => setAttachedFile(null)}>
                  <Ionicons name="close-circle" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Input Row */}
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.iconButton} onPress={showAttachMenu}>
            <Ionicons name="attach" size={22} color="#666" />
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Ask me anything..."
            placeholderTextColor="#999"
            value={input}
            onChangeText={setInput}
            multiline
          />

          <TouchableOpacity
            style={[styles.iconButton, isRecording && styles.recordingButton]}
            onPress={isRecording ? stopRecording : startRecording}
          >
            <Ionicons
              name={isRecording ? "stop" : "mic"}
              size={22}
              color={isRecording ? "#ef4444" : "#666"}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!input.trim() && !attachedFile && !attachedImage) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={(!input.trim() && !attachedFile && !attachedImage) || sending}
          >
            <Ionicons name="send" size={18} color="white" />
          </TouchableOpacity>
        </View>

        {/* File Quiz Modal */}
        <FileQuizModal
          visible={quizModalVisible}
          onClose={() => setQuizModalVisible(false)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "white",
    elevation: 2,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  aiDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "bold", color: "#333" },
  headerSubtitle: { fontSize: 11, color: "#999" },
  quizButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  onlineBadge: {
    backgroundColor: "#22c55e20",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  onlineText: { fontSize: 12, color: "#22c55e", fontWeight: "bold" },
  messagesContainer: { flex: 1, backgroundColor: "#f7f8f6" },
  messagesContent: { padding: 16, paddingBottom: 8 },
  messageBubble: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  userBubble: { justifyContent: "flex-end" },
  assistantBubble: { justifyContent: "flex-start" },
  assistantIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  bubbleContent: {
    maxWidth: "78%",
    borderRadius: 18,
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
  messageText: { fontSize: 14, lineHeight: 22 },
  userText: { color: "white" },
  assistantText: { color: "#333" },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 8,
  },
  fileAttachment: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    gap: 6,
  },
  fileName: { fontSize: 12, color: "#333", flex: 1 },
  loadingDots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 4,
  },
  loadingText: { fontSize: 13, color: "#999" },
  attachmentPreview: {
    backgroundColor: "white",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  imagePreview: { position: "relative" },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  removeAttachment: {
    position: "absolute",
    top: -6,
    right: -6,
  },
  filePreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    padding: 8,
    gap: 6,
    flex: 1,
  },
  filePreviewName: { fontSize: 12, color: "#333", flex: 1 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    backgroundColor: "white",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  recordingButton: { backgroundColor: "#ef444420" },
  input: {
    flex: 1,
    backgroundColor: "#f3f4f6",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: { backgroundColor: "#ccc" },
});
