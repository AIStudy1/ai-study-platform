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
  apiGenerateEntryQuiz, apiSubmitEntryQuiz, apiGenerateFlashcards,
} from "@/services/api";
import FileQuizModal from "@/components/FileQuizModal";
import { PomodoroFloatingPill } from "@/components/PomodoroTimer";
import { usePomodoro } from "@/context/PomodoroContext";

const PRIMARY = "#9cd21f";

const DIFFICULTY_META = {
  beginner:     { color: "#22c55e", bg: "#f0fdf4", label: "Beginner",     icon: "🟢" },
  intermediate: { color: "#f97316", bg: "#fff7ed", label: "Intermediate", icon: "🟡" },
  advanced:     { color: "#ef4444", bg: "#fef2f2", label: "Advanced",     icon: "🔴" },
} as const;
type Difficulty = keyof typeof DIFFICULTY_META;

function getPassingGrade(difficulty: string): number {
  if (difficulty === "advanced")     return 80;
  if (difficulty === "intermediate") return 70;
  return 60;
}

interface Question {
  question: string; options: string[]; answer: string;
  difficulty?: string; topic?: string; isBonus?: boolean;
}
interface Quiz {
  id: string; title: string; questions: Question[];
  score: number | null; passed: boolean; attempts: number;
  bonus_questions?: Question[];
  passing_grade?: number;
}
interface Chapter {
  id: string; title: string; content: string; duration: string;
  is_completed: boolean; order_index: number;
  has_quiz: boolean; quiz: Quiz | null; is_assignment?: boolean;
  difficulty: Difficulty; difficulty_adjusted: boolean;
  content_adjusted?: boolean;
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

function XPBar({ xp, level }: { xp: number; level: number }) {
  const xpInLevel = xp % 1000;
  const pct = (xpInLevel / 1000) * 100;
  return (
    <View style={xpStyles.row}>
      <View style={xpStyles.levelBadge}><Text style={xpStyles.levelText}>Lv {level}</Text></View>
      <View style={{ flex: 1 }}>
        <View style={xpStyles.barBg}><View style={[xpStyles.barFill, { width: `${pct}%` }]} /></View>
        <Text style={xpStyles.xpText}>{xpInLevel} / 1000 XP</Text>
      </View>
    </View>
  );
}
const xpStyles = StyleSheet.create({
  row:        { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  levelBadge: { backgroundColor: PRIMARY, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  levelText:  { color: "white", fontWeight: "bold", fontSize: 12 },
  barBg:      { height: 8, backgroundColor: "#e5e7eb", borderRadius: 10 },
  barFill:    { height: 8, backgroundColor: PRIMARY, borderRadius: 10 },
  xpText:     { fontSize: 10, color: "#999", marginTop: 3 },
});

function OptionButton({ option, index, onPress, state }: {
  option: string; index: number; onPress: () => void; state: "idle" | "correct" | "wrong";
}) {
  const scale      = useRef(new Animated.Value(1)).current;
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
      <TouchableOpacity style={[styles.optionBtn, { backgroundColor: bgColor, borderColor }]}
        onPress={handlePress} disabled={state !== "idle"} activeOpacity={0.8}>
        <View style={[styles.optionLetter, { backgroundColor: state !== "idle" ? "rgba(255,255,255,0.25)" : "#f3f4f6" }]}>
          <Text style={[styles.optionLetterText, state !== "idle" && { color: "white" }]}>{["A","B","C","D"][index]}</Text>
        </View>
        <Text style={[styles.optionText, state !== "idle" && { color: "white" }]}>{option}</Text>
        {state === "correct" && <Ionicons name="checkmark-circle" size={20} color="white" />}
        {state === "wrong"   && <Ionicons name="close-circle"     size={20} color="white" />}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function CourseDetail() {
  const router = useRouter();
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const [activeTab,      setActiveTab]      = useState<TabType>("chapters");
  const [course,         setCourse]         = useState<Course | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [loadingChapter, setLoadingChapter] = useState<string | null>(null);
  const [quizModalVisible, setQuizModalVisible] = useState(false);
  const [chapterModal,     setChapterModal]     = useState<Chapter | null>(null);

  // ── Flashcard generation state ─────────────────────────────────────────────
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false);

  const [entryQuizVisible,    setEntryQuizVisible]    = useState(false);
  const [entryQuizData,       setEntryQuizData]       = useState<any | null>(null);
  const [entryQuizLoading,    setEntryQuizLoading]    = useState(false);
  const [entryQuizAnswers,    setEntryQuizAnswers]    = useState<string[]>([]);
  const [entryQuizIndex,      setEntryQuizIndex]      = useState(0);
  const [entryQuizSubmitting, setEntryQuizSubmitting] = useState(false);
  const [entryQuizResult,     setEntryQuizResult]     = useState<EntryQuizResult | null>(null);
  const [entryOptionState,    setEntryOptionState]    = useState<"idle"|"correct"|"wrong">("idle");
  const [lastEntryAnswer,     setLastEntryAnswer]     = useState<string | null>(null);

  const [activeQuiz,     setActiveQuiz]     = useState<{ chapter: Chapter; quiz: Quiz; allQuestions: Question[] } | null>(null);
  const [quizAnswers,    setQuizAnswers]    = useState<Record<number, string>>({});
  const [quizIndex,      setQuizIndex]      = useState(0);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [optionStates,   setOptionStates]   = useState<Record<number, "idle"|"correct"|"wrong">>({});
  const [selectedOption, setSelectedOption] = useState<Record<number, string>>({});

  const [report, setReport] = useState<{
    score: number; report: AIReport; chapterTitle: string;
    attempts: number; passingGrade: number;
    contentRewritten: boolean; newQuestionsReady: boolean;
  } | null>(null);

  const { settings: pomodoroSettings, start: pomodoroStart, state: pomodoroState } = usePomodoro();
  useEffect(() => { if (courseId) fetchCourse(); }, [courseId]);

  const fetchCourse = async () => {
    try {
      setLoading(true);
      const res  = await apiGetCourse(courseId!);
      const data = res.data;
      const chapters: Chapter[] = (data.chapters || []).map((c: any) => ({
        id: c.id, title: c.title, content: c.content || "",
        duration: c.duration || "30 min",
        is_completed: c.is_completed || false,
        order_index: c.order_index,
        has_quiz: c.quizzes && c.quizzes.length > 0,
        quiz: c.quizzes?.[0] ? {
          id: c.quizzes[0].id, title: c.quizzes[0].title,
          questions: c.quizzes[0].questions || [],
          bonus_questions: c.quizzes[0].bonus_questions || [],
          score: c.quizzes[0].score ?? null,
          passed: c.quizzes[0].passed || false,
          attempts: c.quizzes[0].attempts || 0,
          passing_grade: c.quizzes[0].passing_grade ?? null,
        } : null,
        is_assignment: c.is_assignment || false,
        difficulty: (c.difficulty as Difficulty) || "beginner",
        difficulty_adjusted: c.difficulty_adjusted || false,
        content_adjusted: c.content_adjusted || false,
      }));
      setCourse({
        id: data.id, title: data.title, subject: data.subject,
        description: data.description,
        total_chapters: data.total_chapters,
        completed_chapters: data.completed_chapters,
        type: data.type || "ai", chapters,
        entry_quiz: data.entry_quiz || null,
        entry_quiz_passed: data.entry_quiz_passed ?? null,
        entry_quiz_score: data.entry_quiz_score ?? null,
        course_level: data.course_level || null,
        course_xp: data.course_xp || 0,
      });
    } catch {
      Alert.alert("Error", "Could not load course.");
      router.replace("/(tabs)/dashboard" as any);
    } finally { setLoading(false); }
  };

  // ── Flashcard generation ───────────────────────────────────────────────────
  const handleGenerateFlashcards = async (chapter: Chapter) => {
    if (!course || !chapter.content) return;
    setGeneratingFlashcards(true);
    try {
      const res = await apiGenerateFlashcards(
        course.id, chapter.id, chapter.title, chapter.content
      );
      const count = res.data?.length || 0;
      const isNew = !res.existing;
      Alert.alert(
        isNew ? "🃏 Flashcards Created!" : "🃏 Flashcards Ready",
        isNew
          ? `${count} flashcards generated for "${chapter.title}". Find them in the Flashcards tab!`
          : `${count} flashcards already exist for this chapter. Go review them!`,
        [
          { text: "Later", style: "cancel" },
          {
            text: "Review Now",
            onPress: () => {
              setChapterModal(null);
              router.push({ pathname: "/(tabs)/flashcard-review", params: { courseId: course.id } } as any);
            },
          },
        ]
      );
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not generate flashcards.");
    } finally {
      setGeneratingFlashcards(false);
    }
  };

  const handleStartEntryQuiz = async () => {
    if (!course) return;
    if (course.entry_quiz) {
      setEntryQuizData(course.entry_quiz); setEntryQuizIndex(0);
      setEntryQuizAnswers([]); setEntryQuizResult(null);
      setEntryOptionState("idle"); setEntryQuizVisible(true);
      return;
    }
    setEntryQuizLoading(true);
    try {
      const res = await apiGenerateEntryQuiz(course.id);
      setEntryQuizData(res.data);
      setCourse((prev) => prev ? { ...prev, entry_quiz: res.data } : prev);
      setEntryQuizIndex(0); setEntryQuizAnswers([]); setEntryQuizResult(null);
      setEntryOptionState("idle"); setEntryQuizVisible(true);
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setEntryQuizLoading(false); }
  };

  const handleEntryAnswer = (option: string) => {
    if (!entryQuizData) return;
    const questions: Question[] = entryQuizData.questions;
    const isCorrect = option === questions[entryQuizIndex].answer;
    setEntryOptionState(isCorrect ? "correct" : "wrong");
    setLastEntryAnswer(option);
    setTimeout(() => {
      const newAnswers = [...entryQuizAnswers, option];
      setEntryQuizAnswers(newAnswers); setEntryOptionState("idle"); setLastEntryAnswer(null);
      if (entryQuizIndex < questions.length - 1) setEntryQuizIndex((i) => i + 1);
      else finishEntryQuiz(newAnswers);
    }, 700);
  };

  const finishEntryQuiz = async (answers: string[]) => {
    if (!course) return;
    setEntryQuizSubmitting(true);
    try {
      const res = await apiSubmitEntryQuiz(course.id, answers);
      setEntryQuizResult(res.data); await fetchCourse();
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setEntryQuizSubmitting(false); }
  };

  const closeEntryQuiz = () => {
    setEntryQuizVisible(false); setEntryQuizData(null); setEntryQuizResult(null);
    setEntryQuizIndex(0); setEntryQuizAnswers([]); setLastEntryAnswer(null);
  };

  const openQuiz = (chapter: Chapter) => {
    if (!chapter.is_completed) { Alert.alert("Locked 🔒", "Complete the chapter first to unlock the quiz."); return; }
    if (!chapter.quiz) return;
    if (course) {
      const sorted = [...course.chapters].sort((a, b) => a.order_index - b.order_index);
      const idx    = sorted.findIndex((c) => c.id === chapter.id);
      if (idx > 0) {
        const prev = sorted[idx - 1];
        if (prev.has_quiz && prev.quiz && !prev.quiz.passed) {
          Alert.alert("Previous quiz required 🔒",
            `Pass the quiz for "${prev.title}" first (${prev.quiz.score !== null ? `score: ${prev.quiz.score}%` : "not attempted yet"}).`);
          return;
        }
      }
    }
    const allQuestions = [...(chapter.quiz.questions || []), ...(chapter.quiz.bonus_questions || [])];
    if (allQuestions.length === 0) { Alert.alert("No questions", "This quiz has no questions yet."); return; }
    setQuizAnswers({}); setQuizIndex(0); setOptionStates({}); setSelectedOption({});
    setActiveQuiz({ chapter, quiz: chapter.quiz, allQuestions });
  };

  const handleQuizAnswer = (option: string) => {
    if (!activeQuiz) return;
    const isCorrect = option === activeQuiz.allQuestions[quizIndex].answer;
    setSelectedOption((prev) => ({ ...prev, [quizIndex]: option }));
    setOptionStates((prev) => ({ ...prev, [quizIndex]: isCorrect ? "correct" : "wrong" }));
    setTimeout(() => {
      const newAnswers = { ...quizAnswers, [quizIndex]: option };
      setQuizAnswers(newAnswers);
      if (quizIndex < activeQuiz.allQuestions.length - 1) setQuizIndex((i) => i + 1);
      else finishQuiz(newAnswers);
    }, 700);
  };

  const finishQuiz = async (answers: Record<number, string>) => {
    if (!activeQuiz || !course) return;
    const { chapter, quiz, allQuestions } = activeQuiz;
    const correct     = allQuestions.filter((q, i) => answers[i] === q.answer).length;
    const score       = Math.round((correct / allQuestions.length) * 100);
    const userAnswers = allQuestions.map((_, i) => answers[i] || "");
    const passingGrade = quiz.passing_grade ?? getPassingGrade(chapter.difficulty);
    const passed       = score >= passingGrade;

    setQuizSubmitting(true);
    try {
      const res = await apiSubmitQuiz(course.id, quiz.id, score, chapter.title, allQuestions, userAnswers);
      setCourse((prev) => prev ? {
        ...prev,
        chapters: prev.chapters.map((c) => c.id === chapter.id
          ? { ...c, quiz: c.quiz ? { ...c.quiz, score, passed, attempts: res.data.attempts } : null }
          : c),
      } : prev);
      setActiveQuiz(null); setSelectedOption({}); setOptionStates({});
      setQuizAnswers({}); setQuizIndex(0);
      setReport({
        score, report: res.data.report, chapterTitle: chapter.title,
        attempts: res.data.attempts, passingGrade: res.data.passingGrade ?? passingGrade,
        contentRewritten: res.data.contentRewritten ?? false,
        newQuestionsReady: res.data.newQuestionsReady ?? false,
      });
      if (res.data.contentRewritten) await fetchCourse();
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setQuizSubmitting(false); }
  };

  const handleCompleteChapter = async (chapter: Chapter) => {
    if (!course || chapter.is_completed) return;
    try {
      setLoadingChapter(chapter.id);
      await apiCompleteChapter(course.id, chapter.id);
      await apiLogActivity("chapter_completed", `Completed: ${chapter.title}`);
      setCourse((prev) => prev ? {
        ...prev,
        completed_chapters: prev.completed_chapters + 1,
        chapters: prev.chapters.map((c) => c.id === chapter.id ? { ...c, is_completed: true } : c),
      } : prev);
      setChapterModal((prev) => prev ? { ...prev, is_completed: true } : prev);

      // ── Auto-generate flashcards in background (silent, no alert on fail) ──
      if (chapter.content) {
        apiGenerateFlashcards(course.id, chapter.id, chapter.title, chapter.content)
          .catch(() => {}); // fire-and-forget, don't block or alert
      }

      Alert.alert(
        "Chapter Complete! 🎉",
        chapter.has_quiz
          ? "Quiz is now unlocked! Flashcards have been generated for review."
          : "Great job! Flashcards have been generated for review."
      );
    } catch (e: any) { Alert.alert("Error", e.message); }
    finally { setLoadingChapter(null); }
  };

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      <View style={styles.centered}><ActivityIndicator size="large" color={PRIMARY} /><Text style={styles.loadingText}>Loading course...</Text></View>
    </SafeAreaView>
  );
  if (!course) return null;

  const completedChapters = course.chapters.filter((c) => c.is_completed).length;
  const progressPercent   = course.chapters.length > 0 ? Math.round((completedChapters / course.chapters.length) * 100) : 0;
  const passedQuizzes     = course.chapters.filter((c) => c.has_quiz && c.quiz?.passed).length;
  const totalQuizzes      = course.chapters.filter((c) => c.has_quiz).length;
  const scoredChapters    = course.chapters.filter((c) => (c.quiz?.score ?? 0) > 0);
  const avgScore          = scoredChapters.length > 0
    ? Math.round(scoredChapters.reduce((acc, c) => acc + (c.quiz?.score ?? 0), 0) / scoredChapters.length) : 0;
  const entryQuizTaken    = course.entry_quiz_passed !== null;
  const diffMeta          = DIFFICULTY_META[course.course_level as Difficulty] || DIFFICULTY_META.beginner;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
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
                <Text style={[styles.typeBadgeText, { color: diffMeta.color }]}>{diffMeta.icon} {diffMeta.label}</Text>
              </View>
            )}
          </View>
          <Text style={styles.courseTitle}>{course.title}</Text>
          <Text style={styles.courseSubject}>{course.subject}</Text>
          <Text style={styles.courseDescription}>{course.description}</Text>
          <XPBar xp={course.course_xp || 0} level={Math.floor((course.course_xp || 0) / 1000) + 1} />
        </View>

        {entryQuizTaken && (
          <View style={[styles.entryQuizBanner, { backgroundColor: "#f0fdf4", borderColor: "#bbf7d0" }]}>
            <View style={styles.entryQuizBannerLeft}>
              <View style={[styles.entryQuizIcon, { backgroundColor: "#22c55e" }]}>
                <Ionicons name="checkmark" size={22} color="white" />
              </View>
              <View>
                <Text style={[styles.entryQuizTitle, { color: "#166534" }]}>Level Assessed</Text>
                <Text style={[styles.entryQuizSub, { color: "#4ade80" }]}>
                  Score: {course.entry_quiz_score}% · Level: {diffMeta.label}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleStartEntryQuiz} disabled={entryQuizLoading}>
              {entryQuizLoading
                ? <ActivityIndicator size="small" color="#22c55e" />
                : <Text style={{ color: "#22c55e", fontWeight: "600", fontSize: 12 }}>Retake</Text>}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Overall Progress</Text>
            <Text style={styles.progressPercent}>{progressPercent}%</Text>
          </View>
          <View style={styles.progressBarBg}><View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} /></View>
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

        <View style={styles.tabs}>
          {(["chapters", "quizzes", "progress"] as TabType[]).map((tab) => (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

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
                    onPress={() => {
                      setChapterModal(chapter);
                      if (pomodoroSettings.enabled && !pomodoroState.isRunning && pomodoroState.phase === "work") pomodoroStart();
                    }}
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
                        <Text style={[styles.chapterTitle, !chapter.is_completed && styles.chapterTitleLocked]}>{chapter.title}</Text>
                        {chapter.difficulty_adjusted && (
                          <View style={[styles.adaptedBadge, { backgroundColor: dm.bg }]}>
                            <Text style={[styles.adaptedBadgeText, { color: dm.color }]}>{dm.icon} {dm.label}</Text>
                          </View>
                        )}
                        {chapter.content_adjusted && (
                          <View style={[styles.adaptedBadge, { backgroundColor: "#eff6ff" }]}>
                            <Text style={[styles.adaptedBadgeText, { color: "#3b82f6" }]}>📖 Updated</Text>
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
                                ? `Quiz +${chapter.quiz.bonus_questions.length} bonus` : "Quiz ready"}
                            </Text>
                          </View>
                        )}
                        {chapter.is_completed && (
                          <View style={[styles.assignmentBadge, { backgroundColor: "#fef3c720" }]}>
                            <Text style={[styles.assignmentBadgeText, { color: "#d97706" }]}>🃏 Cards ready</Text>
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

        {activeTab === "quizzes" && (
          <View style={styles.section}>
            <View style={styles.passingGradeBanner}>
              <Ionicons name="ribbon-outline" size={16} color="#f97316" />
              <Text style={styles.passingGradeText}>
                Pass grade: Beginner 60% · Intermediate 70% · Advanced 80%
              </Text>
            </View>
            {course.chapters.filter((c) => c.has_quiz).map((chapter) => {
              const bonusCount   = chapter.quiz?.bonus_questions?.length || 0;
              const passingGrade = chapter.quiz?.passing_grade ?? getPassingGrade(chapter.difficulty);
              const dm           = DIFFICULTY_META[chapter.difficulty] || DIFFICULTY_META.beginner;
              return (
                <TouchableOpacity key={chapter.id} style={styles.quizCard} onPress={() => openQuiz(chapter)}>
                  <View style={[styles.quizIconBox, {
                    backgroundColor: chapter.quiz?.passed ? "#22c55e20" : chapter.quiz?.score !== null ? "#ef444420" : "#f3f4f6",
                  }]}>
                    <MaterialIcons name="quiz" size={24}
                      color={chapter.quiz?.passed ? "#22c55e" : chapter.quiz?.score !== null ? "#ef4444" : "#ccc"} />
                  </View>
                  <View style={styles.quizInfo}>
                    <Text style={styles.quizTitle}>Quiz: {chapter.title}</Text>
                    <Text style={{ fontSize: 11, color: "#999", marginBottom: 2 }}>
                      {dm.icon} {dm.label} · Pass: {passingGrade}%
                    </Text>
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
                            <Text style={[styles.doneBadgeText, { color: "#ef4444" }]}>Retry</Text>
                          </View>
                        : <Ionicons name="lock-closed" size={18} color="#ccc" />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

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
            {entryQuizTaken && (
              <View style={[styles.entryResultCard, { borderColor: course.entry_quiz_passed ? PRIMARY : "#f97316" }]}>
                <Ionicons name={course.entry_quiz_passed ? "checkmark-circle" : "information-circle"} size={20}
                  color={course.entry_quiz_passed ? PRIMARY : "#f97316"} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.entryResultTitle}>Level Assessment</Text>
                  <Text style={styles.entryResultSub}>Score: {course.entry_quiz_score}% · Starting level: {diffMeta.label}</Text>
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
                    {chapter.content_adjusted && (
                      <View style={[styles.adaptedBadge, { backgroundColor: "#eff6ff" }]}>
                        <Text style={[styles.adaptedBadgeText, { color: "#3b82f6" }]}>📖</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.breakdownRight}>
                    {chapter.is_completed
                      ? <Ionicons name="checkmark-circle" size={20} color={PRIMARY} />
                      : <Ionicons name="ellipse-outline" size={20} color="#ccc" />}
                    {chapter.has_quiz && (
                      <View style={[styles.quizResultBadge, {
                        backgroundColor: chapter.quiz?.passed ? "#22c55e20" : chapter.quiz?.score !== null ? "#ef444420" : "#f3f4f6",
                      }]}>
                        <Text style={[styles.quizResultText, {
                          color: chapter.quiz?.passed ? "#22c55e" : chapter.quiz?.score !== null ? "#ef4444" : "#999",
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
              {(() => {
                const dm = DIFFICULTY_META[chapterModal.difficulty] || DIFFICULTY_META.beginner;
                return (
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                    <View style={[styles.chapterDiffBadge, { backgroundColor: dm.bg }]}>
                      <Text style={[styles.chapterDiffText, { color: dm.color }]}>
                        {dm.icon} {dm.label} Level{chapterModal.difficulty_adjusted ? " · AI Adapted" : ""}
                      </Text>
                    </View>
                    {chapterModal.content_adjusted && (
                      <View style={[styles.chapterDiffBadge, { backgroundColor: "#eff6ff" }]}>
                        <Text style={[styles.chapterDiffText, { color: "#3b82f6" }]}>📖 Content Updated by AI</Text>
                      </View>
                    )}
                  </View>
                );
              })()}
              <Text style={styles.chapterContentTitle}>{chapterModal.title}</Text>
              <Text style={styles.chapterContentBody}>{chapterModal.content || "No content available."}</Text>

              {/* ── Mark complete button ─────────────────────────────────── */}
              {!chapterModal.is_completed && (
                <TouchableOpacity style={styles.completeBtn} onPress={() => handleCompleteChapter(chapterModal)} disabled={loadingChapter === chapterModal.id}>
                  {loadingChapter === chapterModal.id
                    ? <ActivityIndicator color="white" />
                    : <><Ionicons name="checkmark-circle" size={20} color="white" /><Text style={styles.completeBtnText}>Mark as Complete</Text></>}
                </TouchableOpacity>
              )}

              {/* ── Completed chapter actions ────────────────────────────── */}
              {chapterModal.is_completed && (
                <>
                  {chapterModal.has_quiz && (
                    <TouchableOpacity style={[styles.completeBtn, { backgroundColor: "#8b5cf6" }]}
                      onPress={() => { setChapterModal(null); openQuiz(chapterModal); }}>
                      <Ionicons name="help-circle" size={20} color="white" />
                      <Text style={styles.completeBtnText}>
                        Take Quiz{(chapterModal.quiz?.bonus_questions?.length || 0) > 0 ? ` (+${chapterModal.quiz!.bonus_questions!.length} bonus)` : ""}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* ── Flashcard button ─────────────────────────────────── */}
                  <TouchableOpacity
                    style={[styles.completeBtn, { backgroundColor: "#f59e0b", marginTop: 12 }]}
                    onPress={() => handleGenerateFlashcards(chapterModal)}
                    disabled={generatingFlashcards}
                  >
                    {generatingFlashcards
                      ? <ActivityIndicator color="white" />
                      : <><Text style={{ fontSize: 18 }}>🃏</Text><Text style={styles.completeBtnText}>Study with Flashcards</Text></>}
                  </TouchableOpacity>

                  <View style={styles.completedBanner}>
                    <Ionicons name="checkmark-circle" size={20} color={PRIMARY} />
                    <Text style={styles.completedBannerText}>Chapter completed</Text>
                  </View>
                </>
              )}
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      {/* ══ Entry Quiz Modal ════════════════════════════════════════════════ */}
      <Modal visible={entryQuizVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
          {entryQuizResult ? (
            <>
              <View style={styles.modalHeader}>
                <View style={{ width: 36 }} />
                <Text style={styles.modalHeaderTitle}>Level Assessment Result</Text>
                <TouchableOpacity onPress={closeEntryQuiz} style={styles.backButton}>
                  <Ionicons name="close" size={20} color="#333" />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
                <View style={[styles.reportScoreCard, { borderColor: entryQuizResult.passed ? PRIMARY : "#f97316" }]}>
                  <Ionicons name={entryQuizResult.passed ? "trophy" : "school"} size={44} color={entryQuizResult.passed ? PRIMARY : "#f97316"} />
                  <Text style={[styles.reportScore, { color: entryQuizResult.passed ? PRIMARY : "#f97316" }]}>{entryQuizResult.score}%</Text>
                  <Text style={styles.reportStatus}>
                    Level: {DIFFICULTY_META[entryQuizResult.startingLevel as Difficulty]?.label || entryQuizResult.startingLevel}
                  </Text>
                  <Text style={styles.reportSummary}>{entryQuizResult.message}</Text>
                </View>
                {entryQuizResult.chaptersSkipped > 0 && (
                  <View style={[styles.reportSection, { backgroundColor: PRIMARY + "15", borderRadius: 14, padding: 14 }]}>
                    <Text style={styles.reportSectionTitle}>⚡ Chapters Unlocked</Text>
                    <Text style={{ fontSize: 14, color: "#444", lineHeight: 20 }}>
                      {entryQuizResult.chaptersSkipped} beginner chapter{entryQuizResult.chaptersSkipped > 1 ? "s" : ""} marked complete.
                    </Text>
                  </View>
                )}
                <Text style={[styles.reportSectionTitle, { marginBottom: 10 }]}>📋 Question Review</Text>
                {entryQuizResult.feedback.map((f, i) => (
                  <View key={i} style={[styles.feedbackCard, { borderLeftColor: f.isCorrect ? "#22c55e" : "#ef4444" }]}>
                    <View style={styles.feedbackHeader}>
                      <Ionicons name={f.isCorrect ? "checkmark-circle" : "close-circle"} size={16} color={f.isCorrect ? "#22c55e" : "#ef4444"} />
                      <Text style={styles.feedbackQ} numberOfLines={2}>{f.question}</Text>
                    </View>
                    {!f.isCorrect && <Text style={styles.feedbackCorrect}>Correct: {f.correct}</Text>}
                    {f.topic ? <Text style={styles.feedbackTopic}>Topic: {f.topic}</Text> : null}
                  </View>
                ))}
                <TouchableOpacity style={styles.completeBtn} onPress={closeEntryQuiz}>
                  <Ionicons name="arrow-forward" size={20} color="white" />
                  <Text style={styles.completeBtnText}>Back to Course</Text>
                </TouchableOpacity>
              </ScrollView>
            </>
          ) : entryQuizData ? (
            <>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={closeEntryQuiz} style={styles.backButton}>
                  <Ionicons name="close" size={20} color="#333" />
                </TouchableOpacity>
                <Text style={styles.modalHeaderTitle}>{entryQuizData.title || "Level Check"}</Text>
                <View style={{ width: 36 }} />
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${(entryQuizIndex / (entryQuizData.questions?.length || 1)) * 100}%` }]} />
              </View>
              <ScrollView contentContainerStyle={{ padding: 20 }}>
                <View style={styles.quizMeta}>
                  <Text style={styles.quizMetaText}>{entryQuizIndex + 1} / {entryQuizData.questions?.length}</Text>
                  <View style={[styles.passingBadge, { backgroundColor: "#eff6ff" }]}>
                    <Text style={[styles.passingBadgeText, { color: "#3b82f6" }]}>Level Check</Text>
                  </View>
                </View>
                {entryQuizData.questions?.[entryQuizIndex]?.topic && (
                  <Text style={styles.questionTopic}>📌 {entryQuizData.questions[entryQuizIndex].topic}</Text>
                )}
                <Text style={styles.questionText}>{entryQuizData.questions?.[entryQuizIndex]?.question}</Text>
                {entryQuizSubmitting ? (
                  <View style={styles.centered}><ActivityIndicator size="large" color={PRIMARY} /><Text style={{ marginTop: 12, color: "#666" }}>Analysing your level...</Text></View>
                ) : (
                  <View style={styles.options}>
                    {entryQuizData.questions?.[entryQuizIndex]?.options?.map((opt: string, i: number) => {
                      const correct = entryQuizData.questions[entryQuizIndex].answer;
                      return (
                        <OptionButton key={i} option={opt} index={i} onPress={() => handleEntryAnswer(opt)}
                          state={entryOptionState === "idle" ? "idle" : opt === correct ? "correct" : opt === lastEntryAnswer ? "wrong" : "idle"} />
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            </>
          ) : (
            <View style={styles.centered}><ActivityIndicator size="large" color={PRIMARY} /><Text style={{ marginTop: 12, color: "#666" }}>Generating quiz...</Text></View>
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
              <View style={[styles.progressFill, { width: `${(quizIndex / activeQuiz.allQuestions.length) * 100}%` }]} />
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
                    <Text style={styles.passingBadgeText}>
                      Pass: {activeQuiz.quiz.passing_grade ?? getPassingGrade(activeQuiz.chapter.difficulty)}%
                    </Text>
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
                <View style={styles.centered}><ActivityIndicator size="large" color={PRIMARY} /><Text style={{ marginTop: 12, color: "#666" }}>Generating AI report...</Text></View>
              ) : (
                <View style={styles.options}>
                  {activeQuiz.allQuestions[quizIndex].options.map((opt, i) => (
                    <OptionButton key={i} option={opt} index={i} onPress={() => handleQuizAnswer(opt)}
                      state={optionStates[quizIndex] !== undefined
                        ? (opt === activeQuiz.allQuestions[quizIndex].answer ? "correct" : selectedOption[quizIndex] === opt ? "wrong" : "idle")
                        : "idle"} />
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
              <View style={[styles.reportScoreCard, { borderColor: report.report.passed ? PRIMARY : "#ef4444" }]}>
                <Ionicons name={report.report.passed ? "trophy" : "refresh"} size={44} color={report.report.passed ? PRIMARY : "#ef4444"} />
                <Text style={[styles.reportScore, { color: report.report.passed ? PRIMARY : "#ef4444" }]}>{report.score}%</Text>
                <Text style={styles.reportStatus}>
                  {report.report.passed ? "Passed ✅" : `Failed — need ${report.passingGrade}%`}
                </Text>
                {report.attempts > 1 && <Text style={{ fontSize: 12, color: "#999", marginTop: 4 }}>Attempt #{report.attempts}</Text>}
                <Text style={styles.reportSummary}>{report.report.summary}</Text>
              </View>

              {report.contentRewritten && (
                <View style={[styles.reportSection, { backgroundColor: "#eff6ff", borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#bfdbfe" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Text style={{ fontSize: 16 }}>📖</Text>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#1d4ed8" }}>Chapter Content Updated</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: "#3b82f6", lineHeight: 20 }}>
                    The AI has rewritten this chapter to be clearer and easier to understand. Re-read it before your next attempt — new questions are ready for you.
                  </Text>
                </View>
              )}

              {!report.contentRewritten && report.newQuestionsReady && (
                <View style={[styles.reportSection, { backgroundColor: "#fff7ed", borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#fed7aa" }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Text style={{ fontSize: 16 }}>🔄</Text>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: "#c2410c" }}>New Questions Ready</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: "#f97316", lineHeight: 20 }}>
                    Fresh questions focusing on your weak areas are ready. Review the chapter and try again.
                  </Text>
                </View>
              )}

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
                <Text style={{ fontSize: 14, color: "#444", lineHeight: 20 }}>{report.report.recommendation}</Text>
              </View>

              <TouchableOpacity style={styles.completeBtn} onPress={() => setReport(null)}>
                <Text style={styles.completeBtnText}>Continue</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      <FileQuizModal visible={quizModalVisible} onClose={() => setQuizModalVisible(false)} />
      <PomodoroFloatingPill />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  section: { paddingHorizontal: 16, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700", color: "#1f2937", marginHorizontal: 10 },
  quizFromFileBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: PRIMARY + "15", alignItems: "center", justifyContent: "center" },
  hero: { backgroundColor: "white", paddingHorizontal: 24, paddingVertical: 28, alignItems: "center", marginBottom: 12, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  heroIconBox: { width: 84, height: 84, borderRadius: 24, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  typeBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  typeBadgeText: { fontSize: 12, fontWeight: "700" },
  courseTitle: { fontSize: 24, fontWeight: "800", color: "#111827", textAlign: "center", marginTop: 6, marginBottom: 6 },
  courseSubject: { fontSize: 14, color: "#6b7280", marginBottom: 14 },
  courseDescription: { fontSize: 14, color: "#4b5563", textAlign: "center", lineHeight: 22 },
  entryQuizBanner: { marginHorizontal: 16, marginBottom: 14, borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1 },
  entryQuizBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  entryQuizIcon: { width: 46, height: 46, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  entryQuizTitle: { fontSize: 15, fontWeight: "700" },
  entryQuizSub: { fontSize: 12, marginTop: 3 },
  entryResultCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "white", borderRadius: 16, padding: 16, marginBottom: 18, borderWidth: 1.5 },
  entryResultTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  entryResultSub: { fontSize: 12, color: "#6b7280", marginTop: 3 },
  progressCard: { backgroundColor: "white", marginHorizontal: 16, marginBottom: 14, borderRadius: 20, padding: 18 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  progressTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  progressPercent: { fontSize: 20, fontWeight: "800", color: PRIMARY },
  progressBarBg: { height: 10, backgroundColor: "#e5e7eb", borderRadius: 999, overflow: "hidden", marginBottom: 14 },
  progressBarFill: { height: 10, backgroundColor: PRIMARY, borderRadius: 999 },
  progressStats: { flexDirection: "row", justifyContent: "space-around" },
  progressStat: { flexDirection: "row", alignItems: "center", gap: 6 },
  progressStatText: { fontSize: 13, color: "#6b7280" },
  uploadBanner: { backgroundColor: PRIMARY + "12", marginHorizontal: 16, marginBottom: 14, borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: PRIMARY + "25" },
  uploadBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  uploadBannerTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  uploadBannerSubtitle: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  tabs: { flexDirection: "row", marginHorizontal: 16, marginBottom: 18, backgroundColor: "white", borderRadius: 14, padding: 4 },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  tabActive: { backgroundColor: PRIMARY },
  tabText: { fontSize: 14, fontWeight: "600", color: "#9ca3af" },
  tabTextActive: { color: "white" },
  connector: { width: 2, height: 14, marginLeft: 30, marginVertical: -3, zIndex: 0 },
  chapterCard: { backgroundColor: "white", borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", marginBottom: 10, zIndex: 1 },
  chapterCardDone: { borderLeftWidth: 4, borderLeftColor: PRIMARY },
  stepCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginRight: 14 },
  stepNumber: { fontSize: 14, fontWeight: "700", color: "#6b7280" },
  chapterInfo: { flex: 1 },
  chapterTitle: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 4 },
  chapterTitleLocked: { color: "#9ca3af" },
  chapterMeta: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  chapterDuration: { fontSize: 12, color: "#9ca3af" },
  assignmentBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 4 },
  assignmentBadgeText: { fontSize: 10, fontWeight: "700" },
  adaptedBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  adaptedBadgeText: { fontSize: 10, fontWeight: "600" },
  chapterRight: { alignItems: "flex-end" },
  doneBadge: { backgroundColor: PRIMARY + "20", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  doneBadgeText: { fontSize: 11, fontWeight: "700", color: PRIMARY },
  passingGradeBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff7ed", borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "#fed7aa" },
  passingGradeText: { flex: 1, fontSize: 12, fontWeight: "600", color: "#ea580c" },
  quizCard: { backgroundColor: "white", borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", marginBottom: 12 },
  quizIconBox: { width: 50, height: 50, borderRadius: 16, alignItems: "center", justifyContent: "center", marginRight: 14 },
  quizInfo: { flex: 1 },
  quizTitle: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 3 },
  quizScore: { fontSize: 12, color: "#4b5563", marginTop: 3 },
  quizLocked: { fontSize: 12, color: "#9ca3af", marginTop: 3 },
  quizRight: { alignItems: "flex-end" },
  bonusBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  bonusBadgeText: { fontSize: 10, fontWeight: "600", color: "#8b5cf6" },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  summaryCard: { flex: 1, borderRadius: 18, paddingVertical: 18, paddingHorizontal: 10, alignItems: "center" },
  summaryNumber: { fontSize: 24, fontWeight: "800", marginBottom: 4 },
  summaryLabel: { fontSize: 11, color: "#6b7280", textAlign: "center" },
  breakdownTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 12 },
  breakdownCard: { backgroundColor: "white", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  breakdownLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  breakdownDot: { width: 10, height: 10, borderRadius: 5 },
  breakdownTitle2: { flex: 1, fontSize: 13, fontWeight: "500", color: "#111827" },
  breakdownRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  quizResultBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  quizResultText: { fontSize: 11, fontWeight: "700" },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  modalHeaderTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: "#111827", marginHorizontal: 10 },
  chapterContent: { padding: 20, paddingBottom: 40 },
  chapterDiffBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, alignSelf: "flex-start" },
  chapterDiffText: { fontSize: 12, fontWeight: "700" },
  chapterContentTitle: { fontSize: 24, fontWeight: "800", color: "#111827", marginBottom: 16 },
  chapterContentBody: { fontSize: 15, color: "#374151", lineHeight: 28 },
  completeBtn: { backgroundColor: PRIMARY, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 26 },
  completeBtnText: { fontSize: 16, fontWeight: "700", color: "white" },
  completedBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: PRIMARY + "15", borderRadius: 14, padding: 14, marginTop: 18 },
  completedBannerText: { fontSize: 14, fontWeight: "600", color: PRIMARY },
  progressBg: { height: 6, backgroundColor: "#e5e7eb" },
  progressFill: { height: 6, backgroundColor: PRIMARY },
  quizMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  quizMetaText: { fontSize: 13, color: "#9ca3af" },
  passingBadge: { backgroundColor: "#fff7ed", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  passingBadgeText: { fontSize: 12, fontWeight: "600", color: "#ea580c" },
  questionTopic: { fontSize: 12, fontWeight: "600", color: "#8b5cf6", marginBottom: 10 },
  questionText: { fontSize: 20, fontWeight: "800", color: "#111827", lineHeight: 30, marginBottom: 24 },
  options: { gap: 12 },
  optionBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "white", borderRadius: 16, padding: 16, gap: 14, borderWidth: 1.5, borderColor: "#e5e7eb" },
  optionLetter: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  optionLetterText: { fontSize: 13, fontWeight: "700", color: "#4b5563" },
  optionText: { flex: 1, fontSize: 14, color: "#111827", lineHeight: 22 },
  reportScoreCard: { backgroundColor: "white", borderRadius: 24, padding: 28, alignItems: "center", marginBottom: 20, borderWidth: 2 },
  reportScore: { fontSize: 52, fontWeight: "800", marginTop: 10 },
  reportStatus: { fontSize: 16, fontWeight: "600", color: "#4b5563", marginTop: 6 },
  reportSummary: { fontSize: 14, color: "#6b7280", textAlign: "center", marginTop: 14, lineHeight: 22 },
  reportSection: { marginBottom: 18 },
  reportSectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 10 },
  reportItem: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  reportItemText: { flex: 1, fontSize: 14, color: "#374151", lineHeight: 21 },
  feedbackCard: { backgroundColor: "white", borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 4 },
  feedbackHeader: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  feedbackQ: { flex: 1, fontSize: 13, color: "#111827", lineHeight: 20 },
  feedbackCorrect: { fontSize: 12, color: "#22c55e", marginTop: 5, marginLeft: 24 },
  feedbackTopic: { fontSize: 11, color: "#9ca3af", marginTop: 3, marginLeft: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: "#9ca3af" },
});