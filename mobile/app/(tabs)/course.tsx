import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Modal, Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  apiCompleteChapter, apiSubmitQuiz, apiLogActivity, apiGetCourse,
  apiGenerateEntryQuiz, apiSubmitEntryQuiz,
} from "@/services/api";
import FileQuizModal from "@/components/FileQuizModal";

const PRIMARY = "#9cd21f";
const PASSING_GRADE = 80;

// ─── Difficulty helpers ───────────────────────────────────────────────────────
const DIFFICULTY_META = {
  beginner:     { color: "#22c55e", bg: "#f0fdf4", label: "Beginner",     icon: "🟢" },
  intermediate: { color: "#f97316", bg: "#fff7ed", label: "Intermediate", icon: "🟡" },
  advanced:     { color: "#ef4444", bg: "#fef2f2", label: "Advanced",     icon: "🔴" },
} as const;
type Difficulty = keyof typeof DIFFICULTY_META;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Question {
  question: string; options: string[]; answer: string;
  difficulty?: string; topic?: string; isBonus?: boolean;
}
interface Quiz {
  id: string; title: string; questions: Question[];
  score: number | null; passed: boolean; attempts: number;
  bonus_questions?: Question[];
}
interface Chapter {
  id: string; title: string; content: string; duration: string;
  is_completed: boolean; order_index: number;
  has_quiz: boolean; quiz: Quiz | null; is_assignment?: boolean;
  difficulty: Difficulty; difficulty_adjusted: boolean;
}
interface Course {
  id: string; title: string; subject: string; description: string;
  total_chapters: number; completed_chapters: number; type: string;
  chapters: Chapter[];
  entry_quiz: any | null;
  entry_quiz_passed: boolean | null;
  entry_quiz_score: number | null;
  course_level: string | null;
  course_xp: number;
}
interface EntryQuizResult {
  score: number; passed: boolean; startingLevel: string;
  feedback: { question: string; correct: string; given: string | null; isCorrect: boolean; topic: string }[];
  chaptersSkipped: number;
  recommendedChapter: { id: string; title: string; order_index: number } | null;
  message: string;
}
interface AIReport {
  summary: string; strengths: string[]; improvements: string[];
  recommendation: string; passed: boolean;
}

type TabType = "chapters" | "quizzes" | "progress";

// ─── XP bar component ─────────────────────────────────────────────────────────
function XPBar({ xp, level }: { xp: number; level: number }) {
  const xpInLevel = xp % 1000;
  const pct = (xpInLevel / 1000) * 100;
  return (
    <View style={xpStyles.row}>
      <View style={xpStyles.levelBadge}>
        <Text style={xpStyles.levelText}>Lv {level}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={xpStyles.barBg}>
          <View style={[xpStyles.barFill, { width: `${pct}%` }]} />
        </View>
        <Text style={xpStyles.xpText}>{xpInLevel} / 1000 XP</Text>
      </View>
    </View>
  );
}
const xpStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  levelBadge: { backgroundColor: PRIMARY, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  levelText: { color: "white", fontWeight: "bold", fontSize: 12 },
  barBg: { height: 8, backgroundColor: "#e5e7eb", borderRadius: 10 },
  barFill: { height: 8, backgroundColor: PRIMARY, borderRadius: 10 },
  xpText: { fontSize: 10, color: "#999", marginTop: 3 },
});

// ─── Animated option button ───────────────────────────────────────────────────
function OptionButton({
  option, index, onPress, state,
}: {
  option: string; index: number;
  onPress: () => void;
  state: "idle" | "correct" | "wrong";
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const bgColor =
    state === "correct" ? "#22c55e" :
    state === "wrong"   ? "#ef4444" :
    "white";
  const borderColor =
    state === "correct" ? "#22c55e" :
    state === "wrong"   ? "#ef4444" :
    "#e5e7eb";

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
        style={[styles.optionBtn, { backgroundColor: bgColor, borderColor }]}
        onPress={handlePress}
        disabled={state !== "idle"}
        activeOpacity={0.8}
      >
        <View style={[styles.optionLetter, {
          backgroundColor: state !== "idle" ? "rgba(255,255,255,0.25)" : "#f3f4f6",
        }]}>
          <Text style={[styles.optionLetterText, state !== "idle" && { color: "white" }]}>
            {["A","B","C","D"][index]}
          </Text>
        </View>
        <Text style={[styles.optionText, state !== "idle" && { color: "white" }]}>{option}</Text>
        {state === "correct" && <Ionicons name="checkmark-circle" size={20} color="white" />}
        {state === "wrong"   && <Ionicons name="close-circle"     size={20} color="white" />}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CourseDetail() {
  const router = useRouter();
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const [activeTab, setActiveTab] = useState<TabType>("chapters");
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingChapter, setLoadingChapter] = useState<string | null>(null);
  const [quizModalVisible, setQuizModalVisible] = useState(false);

  // Chapter reader
  const [chapterModal, setChapterModal] = useState<Chapter | null>(null);

  // ── Entry quiz state ───────────────────────────────────────────────────────
  const [entryQuizVisible, setEntryQuizVisible] = useState(false);
  const [entryQuizData, setEntryQuizData] = useState<any | null>(null);
  const [entryQuizLoading, setEntryQuizLoading] = useState(false);
  const [entryQuizAnswers, setEntryQuizAnswers] = useState<string[]>([]);
  const [entryQuizIndex, setEntryQuizIndex] = useState(0);
  const [entryQuizSubmitting, setEntryQuizSubmitting] = useState(false);
  const [entryQuizResult, setEntryQuizResult] = useState<EntryQuizResult | null>(null);
  const [entryOptionState, setEntryOptionState] = useState<"idle"|"correct"|"wrong">("idle");

  // ── Chapter quiz state ─────────────────────────────────────────────────────
  const [activeQuiz, setActiveQuiz] = useState<{ chapter: Chapter; quiz: Quiz; allQuestions: Question[] } | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [optionStates, setOptionStates] = useState<Record<number, "idle"|"correct"|"wrong">>({});

  // Report modal
  const [report, setReport] = useState<{ score: number; report: AIReport; chapterTitle: string; attempts: number } | null>(null);

  const [addingCourse, setAddingCourse] = useState(false);

  const genId = () => Math.random().toString(36).substr(2, 9);

  useEffect(() => { if (courseId) fetchCourse(); }, [courseId]);

  const fetchCourse = async () => {
    try {
      setLoading(true);
      const res = await apiGetCourse(courseId!);
      const data = res.data;
      const chapters: Chapter[] = (data.chapters || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        content: c.content || "",
        duration: c.duration || "30 min",
        is_completed: c.is_completed || false,
        order_index: c.order_index,
        has_quiz: c.quizzes && c.quizzes.length > 0,
        quiz: c.quizzes?.[0]
          ? {
              id: c.quizzes[0].id,
              title: c.quizzes[0].title,
              questions: c.quizzes[0].questions || [],
              bonus_questions: c.quizzes[0].bonus_questions || [],
              score: c.quizzes[0].score ?? null,
              passed: c.quizzes[0].passed || false,
              attempts: c.quizzes[0].attempts || 0,
            }
          : null,
        is_assignment: c.is_assignment || false,
        difficulty: (c.difficulty as Difficulty) || "beginner",
        difficulty_adjusted: c.difficulty_adjusted || false,
      }));
      setCourse({
        id: data.id,
        title: data.title,
        subject: data.subject,
        description: data.description,
        total_chapters: data.total_chapters,
        completed_chapters: data.completed_chapters,
        type: data.type || "ai",
        chapters,
        entry_quiz: data.entry_quiz || null,
        entry_quiz_passed: data.entry_quiz_passed ?? null,
        entry_quiz_score: data.entry_quiz_score ?? null,
        course_level: data.course_level || null,
        course_xp: data.course_xp || 0,
      });
    } catch {
      Alert.alert("Error", "Could not load course.");
      router.replace("/(tabs)/dashboard" as any);
    } finally {
      setLoading(false);
    }
  };

  // ── Entry quiz ─────────────────────────────────────────────────────────────

  const handleStartEntryQuiz = async () => {
    if (!course) return;
    // If already generated, use cached version; otherwise generate
    if (course.entry_quiz) {
      setEntryQuizData(course.entry_quiz);
      setEntryQuizIndex(0);
      setEntryQuizAnswers([]);
      setEntryQuizResult(null);
      setEntryOptionState("idle");
      setEntryQuizVisible(true);
      return;
    }
    setEntryQuizLoading(true);
    try {
      const res = await apiGenerateEntryQuiz(course.id);
      setEntryQuizData(res.data);
      setCourse((prev) => prev ? { ...prev, entry_quiz: res.data } : prev);
      setEntryQuizIndex(0);
      setEntryQuizAnswers([]);
      setEntryQuizResult(null);
      setEntryOptionState("idle");
      setEntryQuizVisible(true);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setEntryQuizLoading(false);
    }
  };

  const handleEntryAnswer = (option: string) => {
    if (!entryQuizData) return;
    const questions: Question[] = entryQuizData.questions;
    const currentQ = questions[entryQuizIndex];
    const isCorrect = option === currentQ.answer;

    setEntryOptionState(isCorrect ? "correct" : "wrong");

    setTimeout(() => {
      const newAnswers = [...entryQuizAnswers, option];
      setEntryQuizAnswers(newAnswers);
      setEntryOptionState("idle");

      if (entryQuizIndex < questions.length - 1) {
        setEntryQuizIndex((i) => i + 1);
      } else {
        finishEntryQuiz(newAnswers);
      }
    }, 700); // show feedback for 700ms then advance
  };

  const finishEntryQuiz = async (answers: string[]) => {
    if (!course) return;
    setEntryQuizSubmitting(true);
    try {
      const res = await apiSubmitEntryQuiz(course.id, answers);
      setEntryQuizResult(res.data);
      // Refresh course to get updated chapter difficulties + completed_chapters
      await fetchCourse();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setEntryQuizSubmitting(false);
    }
  };

  const closeEntryQuiz = () => {
    setEntryQuizVisible(false);
    setEntryQuizData(null);
    setEntryQuizResult(null);
    setEntryQuizIndex(0);
    setEntryQuizAnswers([]);
  };

  // ── Chapter quiz ───────────────────────────────────────────────────────────

  const openQuiz = (chapter: Chapter) => {
    if (!chapter.is_completed) {
      Alert.alert("Locked 🔒", "Complete the chapter first to unlock the quiz.");
      return;
    }
    if (!chapter.quiz) return;
    const base = chapter.quiz.questions || [];
    const bonus = chapter.quiz.bonus_questions || [];
    const allQuestions = [...base, ...bonus];
    if (allQuestions.length === 0) {
      Alert.alert("No questions", "This quiz has no questions yet.");
      return;
    }
    setActiveQuiz({ chapter, quiz: chapter.quiz, allQuestions });
    setQuizAnswers({});
    setQuizIndex(0);
    setOptionStates({});
  };

  const handleQuizAnswer = (option: string) => {
    if (!activeQuiz) return;
    const currentQ = activeQuiz.allQuestions[quizIndex];
    const isCorrect = option === currentQ.answer;

    // Show feedback
    setOptionStates((prev) => ({
      ...prev,
      [quizIndex]: isCorrect ? "correct" : "wrong",
    }));

    setTimeout(() => {
      const newAnswers = { ...quizAnswers, [quizIndex]: option };
      setQuizAnswers(newAnswers);

      if (quizIndex < activeQuiz.allQuestions.length - 1) {
        setQuizIndex((i) => i + 1);
      } else {
        finishQuiz(newAnswers);
      }
    }, 700);
  };

  const finishQuiz = async (answers: Record<number, string>) => {
    if (!activeQuiz || !course) return;
    const { chapter, quiz, allQuestions } = activeQuiz;
    const correct = allQuestions.filter((q, i) => answers[i] === q.answer).length;
    const score = Math.round((correct / allQuestions.length) * 100);
    const userAnswers = allQuestions.map((_, i) => answers[i] || "");

    setQuizSubmitting(true);
    try {
      const res = await apiSubmitQuiz(
        course.id, quiz.id, score, chapter.title, allQuestions, userAnswers
      );
      const passed = score >= PASSING_GRADE;

      setCourse((prev) => prev
        ? {
            ...prev,
            chapters: prev.chapters.map((c) =>
              c.id === chapter.id
                ? { ...c, quiz: c.quiz ? { ...c.quiz, score, passed, attempts: res.data.attempts } : null }
                : c
            ),
          }
        : prev);

      setActiveQuiz(null);
      setReport({ score, report: res.data.report, chapterTitle: chapter.title, attempts: res.data.attempts });
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setQuizSubmitting(false);
    }
  };

  const handleCompleteChapter = async (chapter: Chapter) => {
    if (!course || chapter.is_completed) return;
    try {
      setLoadingChapter(chapter.id);
      await apiCompleteChapter(course.id, chapter.id);
      await apiLogActivity("chapter_completed", `Completed: ${chapter.title}`);
      setCourse((prev) => prev
        ? {
            ...prev,
            completed_chapters: prev.completed_chapters + 1,
            chapters: prev.chapters.map((c) =>
              c.id === chapter.id ? { ...c, is_completed: true } : c
            ),
          }
        : prev);
      setChapterModal((prev) => prev ? { ...prev, is_completed: true } : prev);
      Alert.alert("Chapter Complete! 🎉", chapter.has_quiz ? "Quiz is now unlocked!" : "Great job!");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoadingChapter(null);
    }
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>Loading course...</Text>
      </View>
    </SafeAreaView>
  );
  if (!course) return null;

  const completedChapters = course.chapters.filter((c) => c.is_completed).length;
  const progressPercent = course.chapters.length > 0
    ? Math.round((completedChapters / course.chapters.length) * 100) : 0;
  const passedQuizzes = course.chapters.filter((c) => c.has_quiz && c.quiz?.passed).length;
  const totalQuizzes  = course.chapters.filter((c) => c.has_quiz).length;
  const scoredChapters = course.chapters.filter((c) => (c.quiz?.score ?? 0) > 0);
  const avgScore = scoredChapters.length > 0
    ? Math.round(scoredChapters.reduce((acc, c) => acc + (c.quiz?.score ?? 0), 0) / scoredChapters.length) : 0;

  const entryQuizTaken = course.entry_quiz_passed !== null;
  const diffMeta = DIFFICULTY_META[course.course_level as Difficulty] || DIFFICULTY_META.beginner;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Course Detail</Text>
        <TouchableOpacity style={styles.quizFromFileBtn} onPress={() => setQuizModalVisible(true)}>
          <Ionicons name="document-text-outline" size={20} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIconBox}>
            <Ionicons name={course.type === "ai" ? "sparkles" : "school"} size={36} color="white" />
          </View>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 12 }}>
            <View style={[styles.typeBadge, { backgroundColor: course.type === "ai" ? PRIMARY + "20" : "#eff6ff" }]}>
              <Text style={[styles.typeBadgeText, { color: course.type === "ai" ? PRIMARY : "#3b82f6" }]}>
                {course.type === "ai" ? "AI Generated" : "Moodle Course"}
              </Text>
            </View>
            {course.course_level && (
              <View style={[styles.typeBadge, { backgroundColor: diffMeta.bg }]}>
                <Text style={[styles.typeBadgeText, { color: diffMeta.color }]}>
                  {diffMeta.icon} {diffMeta.label}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.courseTitle}>{course.title}</Text>
          <Text style={styles.courseSubject}>{course.subject}</Text>
          <Text style={styles.courseDescription}>{course.description}</Text>
          <XPBar xp={course.course_xp || 0} level={Math.floor((course.course_xp || 0) / 1000) + 1} />
        </View>

        {/* Entry Quiz Banner */}
        {!entryQuizTaken ? (
          <TouchableOpacity
            style={styles.entryQuizBanner}
            onPress={handleStartEntryQuiz}
            disabled={entryQuizLoading}
          >
            <View style={styles.entryQuizBannerLeft}>
              <View style={styles.entryQuizIcon}>
                {entryQuizLoading
                  ? <ActivityIndicator color="white" size="small" />
                  : <Ionicons name="flask" size={22} color="white" />}
              </View>
              <View>
                <Text style={styles.entryQuizTitle}>Take Entry Quiz</Text>
                <Text style={styles.entryQuizSub}>
                  Test your knowledge → AI sets your starting level
                </Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={18} color="white" />
          </TouchableOpacity>
        ) : (
          <View style={[styles.entryQuizBanner, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
            <View style={styles.entryQuizBannerLeft}>
              <View style={[styles.entryQuizIcon, { backgroundColor: "#22c55e" }]}>
                <Ionicons name="checkmark" size={22} color="white" />
              </View>
              <View>
                <Text style={[styles.entryQuizTitle, { color: "#166534" }]}>Entry Quiz Completed</Text>
                <Text style={[styles.entryQuizSub, { color: "#4ade80" }]}>
                  Score: {course.entry_quiz_score}% · Level: {diffMeta.label}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleStartEntryQuiz}>
              <Text style={{ color: "#22c55e", fontWeight: "600", fontSize: 12 }}>Retake</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Progress card */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Overall Progress</Text>
            <Text style={styles.progressPercent}>{progressPercent}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          <View style={styles.progressStats}>
            <View style={styles.progressStat}>
              <MaterialIcons name="menu-book" size={18} color={PRIMARY} />
              <Text style={styles.progressStatText}>{completedChapters}/{course.chapters.length} Chapters</Text>
            </View>
            <View style={styles.progressStat}>
              <MaterialIcons name="quiz" size={18} color="#8b5cf6" />
              <Text style={styles.progressStatText}>{passedQuizzes}/{totalQuizzes} Quizzes</Text>
            </View>
          </View>
        </View>

        {/* Upload banner */}
        <TouchableOpacity style={styles.uploadBanner} onPress={() => setQuizModalVisible(true)}>
          <View style={styles.uploadBannerLeft}>
            <Ionicons name="document-text-outline" size={24} color={PRIMARY} />
            <View>
              <Text style={styles.uploadBannerTitle}>Quiz from your notes</Text>
              <Text style={styles.uploadBannerSubtitle}>Upload a PDF and AI generates a quiz</Text>
            </View>
          </View>
          <Ionicons name="arrow-forward" size={18} color={PRIMARY} />
        </TouchableOpacity>

        {/* Tabs */}
        <View style={styles.tabs}>
          {(["chapters", "quizzes", "progress"] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Chapters tab ─────────────────────────────────────────────── */}
        {activeTab === "chapters" && (
          <View style={styles.section}>
            {course.chapters.map((chapter, index) => {
              const dm = DIFFICULTY_META[chapter.difficulty] || DIFFICULTY_META.beginner;
              return (
                <View key={chapter.id}>
                  {index < course.chapters.length - 1 && (
                    <View style={[styles.connector, { backgroundColor: chapter.is_completed ? PRIMARY : "#e5e7eb" }]} />
                  )}
                  <TouchableOpacity
                    style={[styles.chapterCard, chapter.is_completed && styles.chapterCardDone]}
                    onPress={() => setChapterModal(chapter)}
                  >
                    <View style={[styles.stepCircle, { backgroundColor: chapter.is_completed ? PRIMARY : "#e5e7eb" }]}>
                      {loadingChapter === chapter.id
                        ? <ActivityIndicator size="small" color="white" />
                        : chapter.is_completed
                          ? <Ionicons name="checkmark" size={16} color="white" />
                          : <Text style={styles.stepNumber}>{chapter.order_index}</Text>}
                    </View>
                    <View style={styles.chapterInfo}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text style={[styles.chapterTitle, !chapter.is_completed && styles.chapterTitleLocked]}>
                          {chapter.title}
                        </Text>
                        {chapter.difficulty_adjusted && (
                          <View style={[styles.adaptedBadge, { backgroundColor: dm.bg }]}>
                            <Text style={[styles.adaptedBadgeText, { color: dm.color }]}>
                              {dm.icon} {dm.label}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.chapterMeta}>
                        <Ionicons name="time-outline" size={12} color="#999" />
                        <Text style={styles.chapterDuration}>{chapter.duration}</Text>
                        {chapter.has_quiz && chapter.is_completed && (
                          <View style={[styles.assignmentBadge, { backgroundColor: "#8b5cf620" }]}>
                            <Text style={[styles.assignmentBadgeText, { color: "#8b5cf6" }]}>
                              {chapter.quiz?.bonus_questions && chapter.quiz.bonus_questions.length > 0
                                ? `Quiz +${chapter.quiz.bonus_questions.length} bonus`
                                : "Quiz ready"}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <View style={styles.chapterRight}>
                      {chapter.is_completed
                        ? <View style={styles.doneBadge}><Text style={styles.doneBadgeText}>Done</Text></View>
                        : <Ionicons name="chevron-forward" size={18} color="#ccc" />}
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Quizzes tab ───────────────────────────────────────────────── */}
        {activeTab === "quizzes" && (
          <View style={styles.section}>
            <View style={styles.passingGradeBanner}>
              <Ionicons name="ribbon-outline" size={16} color="#f97316" />
              <Text style={styles.passingGradeText}>Passing grade: {PASSING_GRADE}%</Text>
            </View>
            {course.chapters.filter((c) => c.has_quiz).map((chapter) => {
              const bonusCount = chapter.quiz?.bonus_questions?.length || 0;
              return (
                <TouchableOpacity
                  key={chapter.id}
                  style={styles.quizCard}
                  onPress={() => openQuiz(chapter)}
                >
                  <View style={[styles.quizIconBox, {
                    backgroundColor: chapter.quiz?.passed ? "#22c55e20"
                      : chapter.quiz?.score !== null ? "#ef444420" : "#f3f4f6",
                  }]}>
                    <MaterialIcons
                      name="quiz" size={24}
                      color={chapter.quiz?.passed ? "#22c55e"
                        : chapter.quiz?.score !== null ? "#ef4444" : "#ccc"}
                    />
                  </View>
                  <View style={styles.quizInfo}>
                    <Text style={styles.quizTitle}>Quiz: {chapter.title}</Text>
                    {bonusCount > 0 && (
                      <View style={styles.bonusBadge}>
                        <Ionicons name="flash" size={10} color="#8b5cf6" />
                        <Text style={styles.bonusBadgeText}>{bonusCount} adaptive bonus questions</Text>
                      </View>
                    )}
                    {chapter.quiz?.score !== null
                      ? <Text style={styles.quizScore}>
                          Score: {chapter.quiz?.score}% {chapter.quiz?.passed ? "✅" : "❌"}
                          {(chapter.quiz?.attempts || 0) > 1 ? ` · ${chapter.quiz?.attempts} attempts` : ""}
                        </Text>
                      : <Text style={styles.quizLocked}>
                          {chapter.is_completed ? "Tap to attempt" : "Complete chapter first"}
                        </Text>}
                  </View>
                  <View style={styles.quizRight}>
                    {chapter.quiz?.passed
                      ? <View style={[styles.doneBadge, { backgroundColor: "#22c55e20" }]}>
                          <Text style={[styles.doneBadgeText, { color: "#22c55e" }]}>Passed</Text>
                        </View>
                      : chapter.quiz?.score !== null
                        ? <View style={[styles.doneBadge, { backgroundColor: "#ef444420" }]}>
                            <Text style={[styles.doneBadgeText, { color: "#ef4444" }]}>
                              {chapter.quiz?.passed === false ? "Retry" : "Failed"}
                            </Text>
                          </View>
                        : <Ionicons name="lock-closed" size={18} color="#ccc" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* ── Progress tab ──────────────────────────────────────────────── */}
        {activeTab === "progress" && (
          <View style={styles.section}>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: PRIMARY + "15" }]}>
                <Text style={[styles.summaryNumber, { color: PRIMARY }]}>{progressPercent}%</Text>
                <Text style={styles.summaryLabel}>Completed</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: "#8b5cf615" }]}>
                <Text style={[styles.summaryNumber, { color: "#8b5cf6" }]}>{passedQuizzes}/{totalQuizzes}</Text>
                <Text style={styles.summaryLabel}>Quizzes Passed</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: "#f9731615" }]}>
                <Text style={[styles.summaryNumber, { color: "#f97316" }]}>{avgScore}%</Text>
                <Text style={styles.summaryLabel}>Avg Score</Text>
              </View>
            </View>

            {/* Entry quiz result card */}
            {entryQuizTaken && (
              <View style={[styles.entryResultCard, { borderColor: course.entry_quiz_passed ? PRIMARY : "#f97316" }]}>
                <Ionicons
                  name={course.entry_quiz_passed ? "checkmark-circle" : "information-circle"}
                  size={20}
                  color={course.entry_quiz_passed ? PRIMARY : "#f97316"}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryResultTitle}>Entry Quiz</Text>
                  <Text style={styles.entryResultSub}>
                    Score: {course.entry_quiz_score}% · Starting level: {diffMeta.label}
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.breakdownTitle}>Chapter Breakdown</Text>
            {course.chapters.map((chapter) => {
              const dm = DIFFICULTY_META[chapter.difficulty] || DIFFICULTY_META.beginner;
              return (
                <View key={chapter.id} style={styles.breakdownCard}>
                  <View style={styles.breakdownLeft}>
                    <View style={[styles.breakdownDot, { backgroundColor: chapter.is_completed ? PRIMARY : "#e5e7eb" }]} />
                    <Text style={styles.breakdownTitle2} numberOfLines={1}>{chapter.title}</Text>
                    {chapter.difficulty_adjusted && (
                      <View style={[styles.adaptedBadge, { backgroundColor: dm.bg }]}>
                        <Text style={[styles.adaptedBadgeText, { color: dm.color }]}>{dm.icon}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.breakdownRight}>
                    {chapter.is_completed
                      ? <Ionicons name="checkmark-circle" size={20} color={PRIMARY} />
                      : <Ionicons name="ellipse-outline" size={20} color="#ccc" />}
                    {chapter.has_quiz && (
                      <View style={[styles.quizResultBadge, {
                        backgroundColor: chapter.quiz?.passed ? "#22c55e20"
                          : chapter.quiz?.score !== null ? "#ef444420" : "#f3f4f6",
                      }]}>
                        <Text style={[styles.quizResultText, {
                          color: chapter.quiz?.passed ? "#22c55e"
                            : chapter.quiz?.score !== null ? "#ef4444" : "#999",
                        }]}>
                          {chapter.quiz?.score !== null ? `${chapter.quiz?.score}%` : "Quiz"}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ══ Chapter Reader Modal ════════════════════════════════════════════ */}
      <Modal visible={!!chapterModal} animationType="slide" presentationStyle="pageSheet">
        {chapterModal && (
          <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setChapterModal(null)} style={styles.backButton}>
                <Ionicons name="arrow-back" size={20} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle} numberOfLines={1}>{chapterModal.title}</Text>
              <View style={{ width: 36 }} />
            </View>
            <ScrollView contentContainerStyle={styles.chapterContent}>
              {/* Difficulty badge */}
              {(() => {
                const dm = DIFFICULTY_META[chapterModal.difficulty] || DIFFICULTY_META.beginner;
                return (
                  <View style={[styles.chapterDiffBadge, { backgroundColor: dm.bg }]}>
                    <Text style={[styles.chapterDiffText, { color: dm.color }]}>
                      {dm.icon} {dm.label} Level
                      {chapterModal.difficulty_adjusted ? " · AI Adapted" : ""}
                    </Text>
                  </View>
                );
              })()}
              <Text style={styles.chapterContentTitle}>{chapterModal.title}</Text>
              <Text style={styles.chapterContentBody}>
                {chapterModal.content || "No content available for this chapter."}
              </Text>

              {!chapterModal.is_completed && (
                <TouchableOpacity
                  style={styles.completeBtn}
                  onPress={() => handleCompleteChapter(chapterModal)}
                  disabled={loadingChapter === chapterModal.id}
                >
                  {loadingChapter === chapterModal.id
                    ? <ActivityIndicator color="white" />
                    : <>
                        <Ionicons name="checkmark-circle" size={20} color="white" />
                        <Text style={styles.completeBtnText}>Mark as Complete</Text>
                      </>}
                </TouchableOpacity>
              )}

              {chapterModal.is_completed && chapterModal.has_quiz && (
                <TouchableOpacity
                  style={[styles.completeBtn, { backgroundColor: "#8b5cf6" }]}
                  onPress={() => { setChapterModal(null); openQuiz(chapterModal); }}
                >
                  <Ionicons name="help-circle" size={20} color="white" />
                  <Text style={styles.completeBtnText}>
                    Take Quiz
                    {(chapterModal.quiz?.bonus_questions?.length || 0) > 0
                      ? ` (+${chapterModal.quiz!.bonus_questions!.length} bonus)`
                      : ""}
                  </Text>
                </TouchableOpacity>
              )}

              {chapterModal.is_completed && (
                <View style={styles.completedBanner}>
                  <Ionicons name="checkmark-circle" size={20} color={PRIMARY} />
                  <Text style={styles.completedBannerText}>Chapter completed</Text>
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      {/* ══ Entry Quiz Modal ════════════════════════════════════════════════ */}
      <Modal visible={entryQuizVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
          {/* Result screen */}
          {entryQuizResult ? (
            <>
              <View style={styles.modalHeader}>
                <View style={{ width: 36 }} />
                <Text style={styles.modalHeaderTitle}>Entry Quiz Result</Text>
                <TouchableOpacity onPress={closeEntryQuiz} style={styles.backButton}>
                  <Ionicons name="close" size={20} color="#333" />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
                <View style={[styles.reportScoreCard, {
                  borderColor: entryQuizResult.passed ? PRIMARY : "#f97316",
                }]}>
                  <Ionicons
                    name={entryQuizResult.passed ? "trophy" : "school"}
                    size={44}
                    color={entryQuizResult.passed ? PRIMARY : "#f97316"}
                  />
                  <Text style={[styles.reportScore, {
                    color: entryQuizResult.passed ? PRIMARY : "#f97316",
                  }]}>{entryQuizResult.score}%</Text>
                  <Text style={styles.reportStatus}>
                    Starting Level: {DIFFICULTY_META[entryQuizResult.startingLevel as Difficulty]?.label || entryQuizResult.startingLevel}
                  </Text>
                  <Text style={styles.reportSummary}>{entryQuizResult.message}</Text>
                </View>

                {entryQuizResult.chaptersSkipped > 0 && (
                  <View style={[styles.reportSection, { backgroundColor: PRIMARY + "15", borderRadius: 14, padding: 14 }]}>
                    <Text style={styles.reportSectionTitle}>⚡ Chapters Unlocked</Text>
                    <Text style={{ fontSize: 14, color: "#444", lineHeight: 20 }}>
                      Based on your score, {entryQuizResult.chaptersSkipped} beginner chapter{entryQuizResult.chaptersSkipped > 1 ? "s" : ""} have been marked complete. You can still read them anytime.
                    </Text>
                  </View>
                )}

                {entryQuizResult.recommendedChapter && (
                  <View style={[styles.reportSection, { backgroundColor: "#eff6ff", borderRadius: 14, padding: 14 }]}>
                    <Text style={styles.reportSectionTitle}>🎯 Recommended Start</Text>
                    <Text style={{ fontSize: 14, color: "#444" }}>
                      Chapter {entryQuizResult.recommendedChapter.order_index}: {entryQuizResult.recommendedChapter.title}
                    </Text>
                  </View>
                )}

                {/* Per-question feedback */}
                <Text style={[styles.reportSectionTitle, { marginBottom: 10 }]}>📋 Question Review</Text>
                {entryQuizResult.feedback.map((f, i) => (
                  <View key={i} style={[styles.feedbackCard, {
                    borderLeftColor: f.isCorrect ? "#22c55e" : "#ef4444",
                  }]}>
                    <View style={styles.feedbackHeader}>
                      <Ionicons
                        name={f.isCorrect ? "checkmark-circle" : "close-circle"}
                        size={16}
                        color={f.isCorrect ? "#22c55e" : "#ef4444"}
                      />
                      <Text style={styles.feedbackQ} numberOfLines={2}>{f.question}</Text>
                    </View>
                    {!f.isCorrect && (
                      <Text style={styles.feedbackCorrect}>Correct: {f.correct}</Text>
                    )}
                    {f.topic ? <Text style={styles.feedbackTopic}>Topic: {f.topic}</Text> : null}
                  </View>
                ))}

                <TouchableOpacity style={styles.completeBtn} onPress={closeEntryQuiz}>
                  <Ionicons name="arrow-forward" size={20} color="white" />
                  <Text style={styles.completeBtnText}>Start Learning</Text>
                </TouchableOpacity>
              </ScrollView>
            </>
          ) : entryQuizData ? (
            /* Quiz questions */
            <>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={closeEntryQuiz} style={styles.backButton}>
                  <Ionicons name="close" size={20} color="#333" />
                </TouchableOpacity>
                <Text style={styles.modalHeaderTitle}>{entryQuizData.title || "Entry Quiz"}</Text>
                <View style={{ width: 36 }} />
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, {
                  width: `${((entryQuizIndex) / (entryQuizData.questions?.length || 1)) * 100}%`,
                }]} />
              </View>
              <ScrollView contentContainerStyle={{ padding: 20 }}>
                <View style={styles.quizMeta}>
                  <Text style={styles.quizMetaText}>
                    {entryQuizIndex + 1} / {entryQuizData.questions?.length}
                  </Text>
                  <View style={[styles.passingBadge, { backgroundColor: "#eff6ff" }]}>
                    <Text style={[styles.passingBadgeText, { color: "#3b82f6" }]}>Level Check</Text>
                  </View>
                </View>

                {entryQuizData.questions?.[entryQuizIndex]?.topic && (
                  <Text style={styles.questionTopic}>
                    📌 {entryQuizData.questions[entryQuizIndex].topic}
                  </Text>
                )}
                <Text style={styles.questionText}>
                  {entryQuizData.questions?.[entryQuizIndex]?.question}
                </Text>

                {entryQuizSubmitting ? (
                  <View style={styles.centered}>
                    <ActivityIndicator size="large" color={PRIMARY} />
                    <Text style={{ marginTop: 12, color: "#666" }}>Analysing your level...</Text>
                  </View>
                ) : (
                  <View style={styles.options}>
                    {entryQuizData.questions?.[entryQuizIndex]?.options?.map((opt: string, i: number) => {
                      const correct = entryQuizData.questions[entryQuizIndex].answer;
                      let state: "idle" | "correct" | "wrong" = "idle";
                      if (entryOptionState !== "idle") {
                        if (opt === correct) state = "correct";
                        else if (entryQuizAnswers.length === entryQuizIndex) state = "idle"; // not yet answered
                      }
                      return (
                        <OptionButton
                          key={i}
                          option={opt}
                          index={i}
                          onPress={() => handleEntryAnswer(opt)}
                          state={entryOptionState !== "idle" && opt === correct ? "correct"
                            : entryOptionState !== "idle" && entryOptionState === "wrong" && i === entryQuizData.questions[entryQuizIndex].options.indexOf(entryQuizAnswers[entryQuizAnswers.length] ?? "@@") ? "wrong"
                            : "idle"}
                        />
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            </>
          ) : (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={PRIMARY} />
              <Text style={{ marginTop: 12, color: "#666" }}>Generating quiz...</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* ══ Chapter Quiz Modal ══════════════════════════════════════════════ */}
      <Modal visible={!!activeQuiz} animationType="slide" presentationStyle="pageSheet">
        {activeQuiz && (
          <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setActiveQuiz(null)} style={styles.backButton}>
                <Ionicons name="close" size={20} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle} numberOfLines={1}>{activeQuiz.quiz.title}</Text>
              <View style={{ width: 36 }} />
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, {
                width: `${(quizIndex / activeQuiz.allQuestions.length) * 100}%`,
              }]} />
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={styles.quizMeta}>
                <Text style={styles.quizMetaText}>{quizIndex + 1} / {activeQuiz.allQuestions.length}</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {activeQuiz.allQuestions[quizIndex]?.isBonus && (
                    <View style={[styles.passingBadge, { backgroundColor: "#f5f3ff" }]}>
                      <Text style={[styles.passingBadgeText, { color: "#8b5cf6" }]}>⚡ Bonus</Text>
                    </View>
                  )}
                  <View style={styles.passingBadge}>
                    <Text style={styles.passingBadgeText}>Pass: {PASSING_GRADE}%</Text>
                  </View>
                </View>
              </View>

              {activeQuiz.allQuestions[quizIndex]?.difficulty && (
                <Text style={styles.questionTopic}>
                  {DIFFICULTY_META[activeQuiz.allQuestions[quizIndex].difficulty as Difficulty]?.icon}{" "}
                  {DIFFICULTY_META[activeQuiz.allQuestions[quizIndex].difficulty as Difficulty]?.label}
                </Text>
              )}

              <Text style={styles.questionText}>{activeQuiz.allQuestions[quizIndex].question}</Text>

              {quizSubmitting ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color={PRIMARY} />
                  <Text style={{ marginTop: 12, color: "#666" }}>Generating AI report...</Text>
                </View>
              ) : (
                <View style={styles.options}>
                  {activeQuiz.allQuestions[quizIndex].options.map((opt, i) => (
                    <OptionButton
                      key={i}
                      option={opt}
                      index={i}
                      onPress={() => handleQuizAnswer(opt)}
                      state={optionStates[quizIndex] !== undefined
                        ? (opt === activeQuiz.allQuestions[quizIndex].answer ? "correct"
                          : (quizAnswers[quizIndex] === opt ? "wrong" : "idle"))
                        : "idle"}
                    />
                  ))}
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      {/* ══ AI Report Modal ══════════════════════════════════════════════════ */}
      <Modal visible={!!report} animationType="slide" presentationStyle="pageSheet">
        {report && (
          <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
            <View style={styles.modalHeader}>
              <View style={{ width: 36 }} />
              <Text style={styles.modalHeaderTitle}>Quiz Report</Text>
              <TouchableOpacity onPress={() => setReport(null)} style={styles.backButton}>
                <Ionicons name="close" size={20} color="#333" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              <View style={[styles.reportScoreCard, {
                borderColor: report.report.passed ? PRIMARY : "#ef4444",
              }]}>
                <Ionicons
                  name={report.report.passed ? "trophy" : "refresh"}
                  size={44}
                  color={report.report.passed ? PRIMARY : "#ef4444"}
                />
                <Text style={[styles.reportScore, {
                  color: report.report.passed ? PRIMARY : "#ef4444",
                }]}>{report.score}%</Text>
                <Text style={styles.reportStatus}>
                  {report.report.passed ? "Passed ✅" : `Failed — need ${PASSING_GRADE}%`}
                </Text>
                {report.attempts > 1 && (
                  <Text style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                    Attempt #{report.attempts}
                  </Text>
                )}
                <Text style={styles.reportSummary}>{report.report.summary}</Text>
              </View>

              {report.report.passed && (
                <View style={[styles.reportSection, { backgroundColor: PRIMARY + "15", borderRadius: 14, padding: 14, marginBottom: 16 }]}>
                  <Text style={{ fontSize: 14, color: "#166534", fontWeight: "600" }}>
                    🎮 +50 XP earned! Next chapter quiz will be adapted to your level.
                  </Text>
                </View>
              )}

              <View style={styles.reportSection}>
                <Text style={styles.reportSectionTitle}>💪 Strengths</Text>
                {report.report.strengths.map((s, i) => (
                  <View key={i} style={styles.reportItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                    <Text style={styles.reportItemText}>{s}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.reportSection}>
                <Text style={styles.reportSectionTitle}>📖 Areas to Improve</Text>
                {report.report.improvements.map((s, i) => (
                  <View key={i} style={styles.reportItem}>
                    <Ionicons name="alert-circle" size={16} color="#f97316" />
                    <Text style={styles.reportItemText}>{s}</Text>
                  </View>
                ))}
              </View>

              <View style={[styles.reportSection, { backgroundColor: PRIMARY + "15", borderRadius: 14, padding: 14 }]}>
                <Text style={styles.reportSectionTitle}>🎯 Next Step</Text>
                <Text style={{ fontSize: 14, color: "#444", lineHeight: 20 }}>
                  {report.report.recommendation}
                </Text>
              </View>

              <TouchableOpacity style={styles.completeBtn} onPress={() => setReport(null)}>
                <Text style={styles.completeBtnText}>Continue</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      <FileQuizModal visible={quizModalVisible} onClose={() => setQuizModalVisible(false)} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, fontSize: 14, color: "#999" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "white", elevation: 2 },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#333", flex: 1, textAlign: "center", marginHorizontal: 8 },
  quizFromFileBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: PRIMARY + "20", alignItems: "center", justifyContent: "center" },
  container: { flex: 1 },
  // Hero
  hero: { backgroundColor: "white", padding: 24, alignItems: "center", marginBottom: 8 },
  heroIconBox: { width: 80, height: 80, borderRadius: 20, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  typeBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  typeBadgeText: { fontSize: 12, fontWeight: "bold" },
  courseTitle: { fontSize: 22, fontWeight: "bold", color: "#333", textAlign: "center", marginBottom: 4, marginTop: 4 },
  courseSubject: { fontSize: 14, color: "#999", marginBottom: 12 },
  courseDescription: { fontSize: 14, color: "#666", textAlign: "center", lineHeight: 22 },
  // Entry quiz banner
  entryQuizBanner: { backgroundColor: "#8b5cf6", marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "transparent" },
  entryQuizBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  entryQuizIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  entryQuizTitle: { fontSize: 15, fontWeight: "bold", color: "white" },
  entryQuizSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  // Entry quiz result card
  entryResultCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "white", borderRadius: 14, padding: 14, marginBottom: 16, elevation: 1, borderWidth: 1.5 },
  entryResultTitle: { fontSize: 14, fontWeight: "bold", color: "#333" },
  entryResultSub: { fontSize: 12, color: "#666", marginTop: 2 },
  // Progress card
  progressCard: { backgroundColor: "white", marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16, elevation: 1 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressTitle: { fontWeight: "bold", color: "#333" },
  progressPercent: { fontWeight: "bold", color: PRIMARY, fontSize: 18 },
  progressBarBg: { height: 8, backgroundColor: "#e5e7eb", borderRadius: 10, marginBottom: 12 },
  progressBarFill: { height: 8, backgroundColor: PRIMARY, borderRadius: 10 },
  progressStats: { flexDirection: "row", justifyContent: "space-around" },
  progressStat: { flexDirection: "row", alignItems: "center", gap: 6 },
  progressStatText: { fontSize: 13, color: "#666" },
  // Upload banner
  uploadBanner: { backgroundColor: PRIMARY + "15", marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: PRIMARY + "30" },
  uploadBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  uploadBannerTitle: { fontSize: 14, fontWeight: "bold", color: "#333" },
  uploadBannerSubtitle: { fontSize: 12, color: "#666", marginTop: 2 },
  // Tabs
  tabs: { flexDirection: "row", marginHorizontal: 16, backgroundColor: "white", borderRadius: 12, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: PRIMARY },
  tabText: { fontWeight: "600", color: "#999", fontSize: 14 },
  tabTextActive: { color: "white" },
  section: { paddingHorizontal: 16, paddingBottom: 40 },
  // Chapters
  connector: { width: 2, height: 12, marginLeft: 29, marginVertical: -2, zIndex: 0 },
  chapterCard: { backgroundColor: "white", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 8, elevation: 1, zIndex: 1 },
  chapterCardDone: { borderLeftWidth: 3, borderLeftColor: PRIMARY },
  stepCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginRight: 12 },
  stepNumber: { fontWeight: "bold", color: "#999", fontSize: 14 },
  chapterInfo: { flex: 1 },
  chapterTitle: { fontWeight: "bold", color: "#333", fontSize: 14, marginBottom: 4 },
  chapterTitleLocked: { color: "#999" },
  chapterMeta: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  chapterDuration: { fontSize: 12, color: "#999" },
  assignmentBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginLeft: 4 },
  assignmentBadgeText: { fontSize: 10, fontWeight: "bold" },
  adaptedBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  adaptedBadgeText: { fontSize: 10, fontWeight: "600" },
  chapterRight: { alignItems: "flex-end" },
  doneBadge: { backgroundColor: PRIMARY + "20", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  doneBadgeText: { fontSize: 11, color: PRIMARY, fontWeight: "bold" },
  passingGradeBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff7ed", borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: "#fed7aa" },
  passingGradeText: { fontSize: 13, color: "#f97316", fontWeight: "600" },
  // Quizzes
  quizCard: { backgroundColor: "white", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 10, elevation: 1 },
  quizIconBox: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 12 },
  quizInfo: { flex: 1 },
  quizTitle: { fontWeight: "bold", color: "#333", fontSize: 14, marginBottom: 2 },
  quizScore: { fontSize: 12, color: "#666", marginTop: 2 },
  quizLocked: { fontSize: 12, color: "#ccc", marginTop: 2 },
  quizRight: { alignItems: "flex-end" },
  bonusBadge: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 3 },
  bonusBadgeText: { fontSize: 10, color: "#8b5cf6", fontWeight: "600" },
  // Progress tab
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  summaryCard: { flex: 1, borderRadius: 14, padding: 14, alignItems: "center" },
  summaryNumber: { fontSize: 22, fontWeight: "bold", marginBottom: 4 },
  summaryLabel: { fontSize: 11, color: "#666", textAlign: "center" },
  breakdownTitle: { fontSize: 16, fontWeight: "bold", color: "#333", marginBottom: 12 },
  breakdownCard: { backgroundColor: "white", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  breakdownLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  breakdownDot: { width: 10, height: 10, borderRadius: 5 },
  breakdownTitle2: { fontSize: 13, color: "#333", fontWeight: "500", flex: 1 },
  breakdownRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  quizResultBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  quizResultText: { fontSize: 11, fontWeight: "bold" },
  // Modals
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "white", elevation: 2 },
  modalHeaderTitle: { fontSize: 16, fontWeight: "bold", color: "#333", flex: 1, textAlign: "center", marginHorizontal: 8 },
  chapterContent: { padding: 20, paddingBottom: 40 },
  chapterDiffBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignSelf: "flex-start", marginBottom: 16 },
  chapterDiffText: { fontSize: 12, fontWeight: "700" },
  chapterContentTitle: { fontSize: 22, fontWeight: "bold", color: "#333", marginBottom: 16 },
  chapterContentBody: { fontSize: 15, color: "#444", lineHeight: 26 },
  completeBtn: { backgroundColor: PRIMARY, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 24 },
  completeBtnText: { color: "white", fontWeight: "bold", fontSize: 16 },
  completedBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: PRIMARY + "15", borderRadius: 12, padding: 12, marginTop: 16 },
  completedBannerText: { color: PRIMARY, fontWeight: "600", fontSize: 14 },
  // Quiz UI
  progressBg: { height: 6, backgroundColor: "#e5e7eb" },
  progressFill: { height: 6, backgroundColor: PRIMARY },
  quizMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  quizMetaText: { fontSize: 13, color: "#999" },
  passingBadge: { backgroundColor: "#fff7ed", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  passingBadgeText: { fontSize: 12, color: "#f97316", fontWeight: "600" },
  questionTopic: { fontSize: 12, color: "#8b5cf6", fontWeight: "600", marginBottom: 8 },
  questionText: { fontSize: 18, fontWeight: "bold", color: "#333", lineHeight: 26, marginBottom: 24 },
  options: { gap: 12 },
  optionBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 14, padding: 16, gap: 14, elevation: 1, borderWidth: 1.5, borderColor: "#e5e7eb" },
  optionLetter: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  optionLetterText: { fontSize: 13, fontWeight: "bold", color: "#555" },
  optionText: { fontSize: 14, color: "#333", flex: 1, lineHeight: 20 },
  // Report
  reportScoreCard: { backgroundColor: "white", borderRadius: 20, padding: 28, alignItems: "center", marginBottom: 20, elevation: 2, borderWidth: 2 },
  reportScore: { fontSize: 48, fontWeight: "bold", marginTop: 8 },
  reportStatus: { fontSize: 16, fontWeight: "600", color: "#666", marginTop: 4 },
  reportSummary: { fontSize: 14, color: "#666", textAlign: "center", marginTop: 12, lineHeight: 20 },
  reportSection: { marginBottom: 16 },
  reportSectionTitle: { fontSize: 16, fontWeight: "bold", color: "#333", marginBottom: 10 },
  reportItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  reportItemText: { fontSize: 14, color: "#444", flex: 1, lineHeight: 20 },
  // Feedback cards (entry quiz review)
  feedbackCard: { backgroundColor: "white", borderRadius: 10, padding: 12, marginBottom: 8, borderLeftWidth: 3, elevation: 1 },
  feedbackHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  feedbackQ: { fontSize: 13, color: "#333", flex: 1, lineHeight: 18 },
  feedbackCorrect: { fontSize: 12, color: "#22c55e", marginTop: 4, marginLeft: 24 },
  feedbackTopic: { fontSize: 11, color: "#999", marginTop: 2, marginLeft: 24 },
});
