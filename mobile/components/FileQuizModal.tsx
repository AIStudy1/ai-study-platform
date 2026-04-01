import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import {
  apiUploadFile,
  apiGenerateQuizFromFile,
  apiSaveDiagnosticResult,
} from "@/services/api";

const PRIMARY = "#9cd21f";

interface Question {
  question: string;
  options: string[];
  answer: string;
  difficulty: "easy" | "medium" | "hard";
}

interface Quiz {
  subject: string;
  fileName: string;
  questions: Question[];
}

interface StudyPlanTask {
  subject: string;
  task: string;
  duration: string;
  type: string;
}

interface StudyPlanDay {
  day: string;
  tasks: StudyPlanTask[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Step = "upload" | "loading" | "quiz" | "results" | "plan";

export default function FileQuizModal({ visible, onClose }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [score, setScore] = useState(0);
  const [studyPlan, setStudyPlan] = useState<StudyPlanDay[]>([]);
  const [loadingMessage, setLoadingMessage] = useState("");

  const reset = () => {
    setStep("upload");
    setQuiz(null);
    setCurrentIndex(0);
    setAnswers({});
    setScore(0);
    setStudyPlan([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const pickAndUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || result.assets.length === 0) return;

      const file = result.assets[0];
      setStep("loading");
      setLoadingMessage("Uploading your file...");

      // Upload file and extract text
      const uploadRes = await apiUploadFile(file.uri, file.name, file.mimeType || "application/pdf");

      if (!uploadRes.extractedText) {
        Alert.alert("Error", "Could not extract text from this PDF. Please try another file.");
        setStep("upload");
        return;
      }

      setLoadingMessage("AI is reading your material...");

      // Generate quiz from extracted text
      const quizRes = await apiGenerateQuizFromFile(uploadRes.extractedText, file.name);
      setQuiz(quizRes.data);
      setStep("quiz");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Something went wrong. Please try again.");
      setStep("upload");
    }
  };

  const handleAnswer = async (option: string) => {
    if (!quiz) return;

    const newAnswers = { ...answers, [currentIndex]: option };
    setAnswers(newAnswers);

    const isLast = currentIndex === quiz.questions.length - 1;

    if (!isLast) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Calculate score
      const correct = quiz.questions.filter(
        (q, i) => newAnswers[i] === q.answer
      ).length;
      setScore(correct);
      setStep("loading");
      setLoadingMessage("Saving your results and generating study plan...");

      try {
        const res = await apiSaveDiagnosticResult(
          quiz.subject,
          correct,
          quiz.questions.length,
          quiz.fileName
        );
        setStudyPlan(res.data.plan.days);
        setStep("results");
      } catch (error) {
        Alert.alert("Error", "Could not save results. Please try again.");
        setStep("upload");
      }
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    if (difficulty === "easy") return "#22c55e";
    if (difficulty === "medium") return "#f97316";
    return "#ef4444";
  };

  const getScoreColor = () => {
    if (!quiz) return PRIMARY;
    const pct = (score / quiz.questions.length) * 100;
    if (pct >= 70) return "#22c55e";
    if (pct >= 40) return "#f97316";
    return "#ef4444";
  };

  const getScoreMessage = () => {
    if (!quiz) return "";
    const pct = (score / quiz.questions.length) * 100;
    if (pct >= 70) return "Great job! You know this material well 💪";
    if (pct >= 40) return "Good effort! There's room to improve 📖";
    return "Keep going! Review the material and try again 🌱";
  };

  const getTaskIcon = (type: string) => {
    switch (type) {
      case "reading": return "book-outline";
      case "quiz": return "help-circle-outline";
      case "revision": return "refresh-outline";
      case "practice": return "pencil-outline";
      default: return "checkmark-circle-outline";
    }
  };

  const getTaskColor = (type: string) => {
    switch (type) {
      case "reading": return "#3b82f6";
      case "quiz": return "#a855f7";
      case "revision": return "#f97316";
      case "practice": return "#22c55e";
      default: return PRIMARY;
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>

        {/* ── Upload Step ─────────────────────────────────────────── */}
        {step === "upload" && (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Quiz from File</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.uploadArea}>
              <View style={styles.uploadIcon}>
                <Ionicons name="document-text-outline" size={52} color={PRIMARY} />
              </View>
              <Text style={styles.uploadTitle}>Upload your study material</Text>
              <Text style={styles.uploadSubtitle}>
                Upload a PDF and our AI will generate a personalized quiz based on its content
              </Text>

              <View style={styles.featureList}>
                {[
                  "AI reads your material",
                  "Generates 5 targeted questions",
                  "Saves your score to your profile",
                  "Creates a personalized study plan",
                ].map((feature, i) => (
                  <View key={i} style={styles.featureItem}>
                    <Ionicons name="checkmark-circle" size={18} color={PRIMARY} />
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity style={styles.uploadButton} onPress={pickAndUpload}>
                <MaterialIcons name="picture-as-pdf" size={20} color="white" />
                <Text style={styles.uploadButtonText}>Choose PDF File</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {/* ── Loading Step ────────────────────────────────────────── */}
        {step === "loading" && (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={styles.loadingTitle}>{loadingMessage}</Text>
            <Text style={styles.loadingSubtitle}>This may take a few seconds...</Text>
          </View>
        )}

        {/* ── Quiz Step ───────────────────────────────────────────── */}
        {step === "quiz" && quiz && (
          <View style={styles.content}>
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>{quiz.subject}</Text>
                <Text style={styles.headerSubtitle}>
                  Question {currentIndex + 1} of {quiz.questions.length}
                </Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Progress bar */}
            <View style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${((currentIndex) / quiz.questions.length) * 100}%` },
                ]}
              />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
              {/* Difficulty badge */}
              <View style={styles.difficultyRow}>
                <View
                  style={[
                    styles.difficultyBadge,
                    { backgroundColor: getDifficultyColor(quiz.questions[currentIndex].difficulty) + "20" },
                  ]}
                >
                  <View
                    style={[
                      styles.difficultyDot,
                      { backgroundColor: getDifficultyColor(quiz.questions[currentIndex].difficulty) },
                    ]}
                  />
                  <Text
                    style={[
                      styles.difficultyText,
                      { color: getDifficultyColor(quiz.questions[currentIndex].difficulty) },
                    ]}
                  >
                    {quiz.questions[currentIndex].difficulty}
                  </Text>
                </View>
              </View>

              <Text style={styles.questionText}>
                {quiz.questions[currentIndex].question}
              </Text>

              <View style={styles.optionsContainer}>
                {quiz.questions[currentIndex].options.map((option, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.optionButton}
                    onPress={() => handleAnswer(option)}
                  >
                    <View style={styles.optionLetter}>
                      <Text style={styles.optionLetterText}>
                        {["A", "B", "C", "D"][i]}
                      </Text>
                    </View>
                    <Text style={styles.optionText}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* ── Results Step ────────────────────────────────────────── */}
        {step === "results" && quiz && (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Results</Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.resultsCard}>
              <Ionicons name="trophy" size={48} color={getScoreColor()} />
              <Text style={[styles.scoreText, { color: getScoreColor() }]}>
                {score} / {quiz.questions.length}
              </Text>
              <Text style={styles.scorePct}>
                {Math.round((score / quiz.questions.length) * 100)}%
              </Text>
              <Text style={styles.scoreMessage}>{getScoreMessage()}</Text>
              <Text style={styles.scoreSubject}>{quiz.subject}</Text>
            </View>

            {/* Study Plan */}
            {studyPlan.length > 0 && (
              <View style={styles.planSection}>
                <Text style={styles.planTitle}>📅 Your Personalized Study Plan</Text>
                <Text style={styles.planSubtitle}>
                  Based on your results, here's a 3-day plan to help you improve
                </Text>

                {studyPlan.map((day, di) => (
                  <View key={di} style={styles.dayCard}>
                    <Text style={styles.dayTitle}>{day.day}</Text>
                    {day.tasks.map((task, ti) => (
                      <View key={ti} style={styles.taskItem}>
                        <View
                          style={[
                            styles.taskIcon,
                            { backgroundColor: getTaskColor(task.type) + "20" },
                          ]}
                        >
                          <Ionicons
                            name={getTaskIcon(task.type) as any}
                            size={16}
                            color={getTaskColor(task.type)}
                          />
                        </View>
                        <View style={styles.taskInfo}>
                          <Text style={styles.taskText}>{task.task}</Text>
                          <Text style={styles.taskMeta}>
                            {task.duration} · {task.type}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.doneButton} onPress={handleClose}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f8f6" },
  content: { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },
  headerSubtitle: { fontSize: 13, color: "#999", marginTop: 2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    elevation: 1,
  },
  uploadArea: { alignItems: "center" },
  uploadIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: PRIMARY + "20",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  uploadTitle: { fontSize: 22, fontWeight: "bold", color: "#333", marginBottom: 8 },
  uploadSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 10,
  },
  featureList: { width: "100%", marginBottom: 32, gap: 12 },
  featureItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { fontSize: 14, color: "#444" },
  uploadButton: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
  },
  uploadButtonText: { color: "white", fontWeight: "bold", fontSize: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingTitle: { fontSize: 18, fontWeight: "bold", color: "#333", marginTop: 20 },
  loadingSubtitle: { fontSize: 13, color: "#999", marginTop: 8 },
  progressBg: { height: 6, backgroundColor: "#e5e7eb", marginHorizontal: 20 },
  progressFill: { height: 6, backgroundColor: PRIMARY, borderRadius: 10 },
  difficultyRow: { marginBottom: 16 },
  difficultyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  difficultyDot: { width: 8, height: 8, borderRadius: 4 },
  difficultyText: { fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  questionText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    lineHeight: 26,
    marginBottom: 28,
  },
  optionsContainer: { gap: 12 },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 14,
    padding: 16,
    gap: 14,
    elevation: 1,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
  },
  optionLetter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  optionLetterText: { fontSize: 13, fontWeight: "bold", color: "#555" },
  optionText: { fontSize: 14, color: "#333", flex: 1, lineHeight: 20 },
  resultsCard: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    marginBottom: 24,
    elevation: 2,
  },
  scoreText: { fontSize: 42, fontWeight: "bold", marginTop: 12 },
  scorePct: { fontSize: 18, color: "#999", marginTop: 4 },
  scoreMessage: {
    fontSize: 15,
    color: "#444",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
  },
  scoreSubject: {
    fontSize: 13,
    color: "#999",
    marginTop: 8,
    fontStyle: "italic",
  },
  planSection: { marginBottom: 24 },
  planTitle: { fontSize: 18, fontWeight: "bold", color: "#333", marginBottom: 6 },
  planSubtitle: { fontSize: 13, color: "#666", marginBottom: 16, lineHeight: 18 },
  dayCard: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
  },
  dayTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  taskItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  taskIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  taskInfo: { flex: 1 },
  taskText: { fontSize: 13, color: "#333", lineHeight: 18 },
  taskMeta: { fontSize: 11, color: "#999", marginTop: 2, textTransform: "capitalize" },
  doneButton: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  doneButtonText: { color: "white", fontWeight: "bold", fontSize: 16 },
});
