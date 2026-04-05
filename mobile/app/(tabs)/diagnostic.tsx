import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import {
  apiGenerateQuizFromFile,
  apiSaveDiagnosticResult,
  apiUploadFile,
  apiGenerateDiagnostic,
} from "@/services/api";

const PRIMARY = "#9cd21f";

const SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology",
  "Computer Science", "History", "Economics", "English",
  "Philosophy", "Geography",
];

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

interface StudyPlanDay {
  day: string;
  tasks: { subject: string; task: string; duration: string; type: string }[];
}

type Step = "choose" | "subjects" | "loading" | "quiz" | "results";

export default function DiagnosticScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("choose");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [score, setScore] = useState(0);
  const [studyPlan, setStudyPlan] = useState<StudyPlanDay[]>([]);
  const [loadingMsg, setLoadingMsg] = useState("");

  const toggleSubject = (s: string) =>
    setSelectedSubjects((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  const pickAndUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf"],
        copyToCacheDirectory: true,
      });
      if (result.canceled || result.assets.length === 0) return;
      const file = result.assets[0];
      setStep("loading");
      setLoadingMsg("Uploading your file...");
      const uploadRes = await apiUploadFile(file.uri, file.name, file.mimeType || "application/pdf");
      if (!uploadRes.extractedText) {
        Alert.alert("Error", "Could not extract text from this PDF. Try another file.");
        setStep("choose");
        return;
      }
      setLoadingMsg("AI is reading your material...");
      const quizRes = await apiGenerateQuizFromFile(uploadRes.extractedText, file.name);
      setQuiz(quizRes.data);
      setStep("quiz");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Something went wrong.");
      setStep("choose");
    }
  };

  const generateFromSubject = async () => {
    if (selectedSubjects.length === 0) return;
    setStep("loading");
    setLoadingMsg("Generating your quiz...");
    try {
      const res = await apiGenerateDiagnostic(selectedSubjects[0]);
      setQuiz({ ...res.data, fileName: selectedSubjects[0] });
      setStep("quiz");
    } catch {
      Alert.alert("Error", "Could not generate quiz.");
      setStep("subjects");
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
      const correct = quiz.questions.filter((q, i) => newAnswers[i] === q.answer).length;
      setScore(correct);
      setStep("loading");
      setLoadingMsg("Saving results & generating study plan...");
      try {
        const res = await apiSaveDiagnosticResult(quiz.subject, correct, quiz.questions.length, quiz.fileName);
        setStudyPlan(res.data.plan.days || []);
        setStep("results");
      } catch {
        Alert.alert("Error", "Could not save results.");
        setStep("choose");
      }
    }
  };

  const getDiffColor = (d: string) =>
    d === "easy" ? "#22c55e" : d === "medium" ? "#f97316" : "#ef4444";

  const getScoreColor = () => {
    if (!quiz) return PRIMARY;
    const pct = (score / quiz.questions.length) * 100;
    return pct >= 70 ? "#22c55e" : pct >= 40 ? "#f97316" : "#ef4444";
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

  const resetAll = () => {
    setStep("choose");
    setAnswers({});
    setCurrentIndex(0);
    setQuiz(null);
    setScore(0);
    setStudyPlan([]);
    setSelectedSubjects([]);
  };

  // ── Choose mode ────────────────────────────────────────────────────────────
  if (step === "choose") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.topHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Diagnostic Quiz</Text>
          </View>
          <View style={styles.intro}>
            <Ionicons name="clipboard-outline" size={52} color={PRIMARY} />
            <Text style={styles.introTitle}>Assess your level</Text>
            <Text style={styles.introSub}>
              Upload a PDF chapter or pick a subject — AI generates a personalized quiz to evaluate where you stand.
            </Text>
          </View>
          <Text style={styles.sectionLabel}>How do you want to start?</Text>
          <TouchableOpacity style={styles.modeCard} onPress={pickAndUpload}>
            <View style={[styles.modeIcon, { backgroundColor: "#eff6ff" }]}>
              <Ionicons name="document-text-outline" size={28} color="#3b82f6" />
            </View>
            <View style={styles.modeInfo}>
              <Text style={styles.modeTitle}>Upload a PDF</Text>
              <Text style={styles.modeSub}>AI reads your chapter and generates quiz questions from it</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.modeCard} onPress={() => setStep("subjects")}>
            <View style={[styles.modeIcon, { backgroundColor: PRIMARY + "20" }]}>
              <Ionicons name="school-outline" size={28} color={PRIMARY} />
            </View>
            <View style={styles.modeInfo}>
              <Text style={styles.modeTitle}>Pick a Subject</Text>
              <Text style={styles.modeSub}>AI generates 5 questions on the subject of your choice</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Subject picker ─────────────────────────────────────────────────────────
  if (step === "subjects") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.topHeader}>
            <TouchableOpacity onPress={() => setStep("choose")} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={20} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Pick a Subject</Text>
          </View>
          <Text style={styles.sectionLabel}>Select a subject</Text>
          <View style={styles.subjectsGrid}>
            {SUBJECTS.map((s) => {
              const selected = selectedSubjects.includes(s);
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, selected && styles.chipActive]}
                  onPress={() => setSelectedSubjects(selected ? [] : [s])}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{s}</Text>
                  {selected && <Ionicons name="checkmark" size={13} color="white" />}
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[styles.startBtn, selectedSubjects.length === 0 && styles.startBtnDisabled]}
            disabled={selectedSubjects.length === 0}
            onPress={generateFromSubject}
          >
            <Ionicons name="sparkles" size={18} color="white" />
            <Text style={styles.startBtnText}>Generate Quiz</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (step === "loading") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingTitle}>{loadingMsg}</Text>
          <Text style={styles.loadingSub}>This may take a few seconds...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Quiz ───────────────────────────────────────────────────────────────────
  if (step === "quiz" && quiz) {
    const q = quiz.questions[currentIndex];
    const progress = (currentIndex / quiz.questions.length) * 100;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
        <View style={{ flex: 1 }}>
          <View style={styles.quizHeader}>
            <Text style={styles.quizSubject}>{quiz.subject}</Text>
            <Text style={styles.quizCounter}>{currentIndex + 1} / {quiz.questions.length}</Text>
          </View>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View style={[styles.diffBadge, { backgroundColor: getDiffColor(q.difficulty) + "20" }]}>
              <View style={[styles.diffDot, { backgroundColor: getDiffColor(q.difficulty) }]} />
              <Text style={[styles.diffText, { color: getDiffColor(q.difficulty) }]}>{q.difficulty}</Text>
            </View>
            <Text style={styles.questionText}>{q.question}</Text>
            <View style={styles.options}>
              {q.options.map((opt, i) => (
                <TouchableOpacity key={i} style={styles.optionBtn} onPress={() => handleAnswer(opt)}>
                  <View style={styles.optionLetter}>
                    <Text style={styles.optionLetterText}>{["A", "B", "C", "D"][i]}</Text>
                  </View>
                  <Text style={styles.optionText}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  // ── Results ────────────────────────────────────────────────────────────────
  if (step === "results" && quiz) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={styles.resultsCard}>
            <Ionicons name="trophy" size={52} color={getScoreColor()} />
            <Text style={[styles.scoreNum, { color: getScoreColor() }]}>{score} / {quiz.questions.length}</Text>
            <Text style={styles.scorePct}>{Math.round((score / quiz.questions.length) * 100)}%</Text>
            <Text style={styles.scoreSubject}>{quiz.subject}</Text>
          </View>
          {studyPlan.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={styles.planTitle}>📅 Your Study Plan</Text>
              <Text style={styles.planSub}>Based on your results, here's your next {studyPlan.length} days</Text>
              {studyPlan.map((day, di) => (
                <View key={di} style={styles.dayCard}>
                  <Text style={styles.dayTitle}>{day.day}</Text>
                  {day.tasks.map((task, ti) => (
                    <View key={ti} style={styles.taskRow}>
                      <View style={[styles.taskIcon, { backgroundColor: getTaskColor(task.type) + "20" }]}>
                        <Ionicons name={getTaskIcon(task.type) as any} size={16} color={getTaskColor(task.type)} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.taskText}>{task.task}</Text>
                        <Text style={styles.taskMeta}>{task.duration} · {task.type}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          )}
          <TouchableOpacity style={styles.startBtn} onPress={() => router.push("/(tabs)/dashboard" as any)}>
            <Ionicons name="home" size={18} color="white" />
            <Text style={styles.startBtnText}>Go to Dashboard</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: "white", borderWidth: 1.5, borderColor: PRIMARY, marginTop: 10 }]}
            onPress={resetAll}
          >
            <Ionicons name="refresh" size={18} color={PRIMARY} />
            <Text style={[styles.startBtnText, { color: PRIMARY }]}>Take Another Quiz</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 40 },
  topHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 28 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "white", alignItems: "center", justifyContent: "center", elevation: 1 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },
  intro: { alignItems: "center", marginBottom: 32 },
  introTitle: { fontSize: 22, fontWeight: "bold", color: "#333", marginTop: 12 },
  introSub: { fontSize: 14, color: "#666", textAlign: "center", marginTop: 8, lineHeight: 20 },
  sectionLabel: { fontSize: 15, fontWeight: "600", color: "#333", marginBottom: 14 },
  modeCard: { backgroundColor: "white", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", marginBottom: 12, elevation: 1, gap: 14 },
  modeIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  modeInfo: { flex: 1 },
  modeTitle: { fontSize: 16, fontWeight: "bold", color: "#333", marginBottom: 3 },
  modeSub: { fontSize: 13, color: "#666", lineHeight: 18 },
  subjectsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: "white", borderWidth: 1.5, borderColor: "#e5e7eb" },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { fontSize: 13, color: "#555", fontWeight: "500" },
  chipTextActive: { color: "white" },
  startBtn: { backgroundColor: PRIMARY, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  startBtnDisabled: { backgroundColor: "#ccc" },
  startBtnText: { color: "white", fontWeight: "bold", fontSize: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  loadingTitle: { fontSize: 18, fontWeight: "bold", color: "#333", marginTop: 20 },
  loadingSub: { fontSize: 13, color: "#999", marginTop: 8 },
  quizHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, paddingBottom: 10, backgroundColor: "white" },
  quizSubject: { fontSize: 16, fontWeight: "bold", color: PRIMARY },
  quizCounter: { fontSize: 13, color: "#999" },
  progressBg: { height: 6, backgroundColor: "#e5e7eb" },
  progressFill: { height: 6, backgroundColor: PRIMARY },
  diffBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: "flex-start", marginBottom: 16 },
  diffDot: { width: 8, height: 8, borderRadius: 4 },
  diffText: { fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  questionText: { fontSize: 18, fontWeight: "bold", color: "#333", lineHeight: 26, marginBottom: 24 },
  options: { gap: 12 },
  optionBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 14, padding: 16, gap: 14, elevation: 1, borderWidth: 1.5, borderColor: "#e5e7eb" },
  optionLetter: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  optionLetterText: { fontSize: 13, fontWeight: "bold", color: "#555" },
  optionText: { fontSize: 14, color: "#333", flex: 1, lineHeight: 20 },
  resultsCard: { backgroundColor: "white", borderRadius: 20, padding: 28, alignItems: "center", marginBottom: 24, elevation: 2 },
  scoreNum: { fontSize: 42, fontWeight: "bold", marginTop: 12 },
  scorePct: { fontSize: 18, color: "#999", marginTop: 4 },
  scoreSubject: { fontSize: 13, color: "#999", marginTop: 8, fontStyle: "italic" },
  planTitle: { fontSize: 18, fontWeight: "bold", color: "#333", marginBottom: 6 },
  planSub: { fontSize: 13, color: "#666", marginBottom: 16, lineHeight: 18 },
  dayCard: { backgroundColor: "white", borderRadius: 14, padding: 16, marginBottom: 12, elevation: 1 },
  dayTitle: { fontSize: 15, fontWeight: "bold", color: "#333", marginBottom: 12 },
  taskRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  taskIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  taskText: { fontSize: 13, color: "#333", lineHeight: 18 },
  taskMeta: { fontSize: 11, color: "#999", marginTop: 2, textTransform: "capitalize" },
});
