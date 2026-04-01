import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { apiCompleteChapter, apiSubmitQuiz, apiLogActivity, apiGetCourse } from "@/services/api";
import FileQuizModal from "@/components/FileQuizModal";

const PRIMARY = "#9cd21f";

interface Chapter {
  id: string;
  title: string;
  duration: string;
  is_completed: boolean;
  order_index: number;
  has_quiz: boolean;
  quiz_id: string | null;
  quiz_passed: boolean;
  quiz_score: number | null;
  is_assignment?: boolean;
}

interface Course {
  id: string;
  title: string;
  subject: string;
  description: string;
  total_chapters: number;
  completed_chapters: number;
  type: string;
  chapters: Chapter[];
}

type TabType = "chapters" | "quizzes" | "progress";

export default function CourseDetail() {
  const router = useRouter();
  const { courseId } = useLocalSearchParams<{ courseId: string }>();
  const [activeTab, setActiveTab] = useState<TabType>("chapters");
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingChapter, setLoadingChapter] = useState<string | null>(null);
  const [loadingQuiz, setLoadingQuiz] = useState<string | null>(null);
  const [quizModalVisible, setQuizModalVisible] = useState(false);

  useEffect(() => {
    if (courseId) fetchCourse();
  }, [courseId]);

  const fetchCourse = async () => {
    try {
      setLoading(true);
      const res = await apiGetCourse(courseId!);
      const data = res.data;

      // Normalize chapters
      const chapters: Chapter[] = (data.chapters || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        duration: c.duration || "30 min",
        is_completed: c.is_completed || false,
        order_index: c.order_index,
        has_quiz: c.quizzes && c.quizzes.length > 0,
        quiz_id: c.quizzes?.[0]?.id || null,
        quiz_passed: c.quizzes?.[0]?.passed || false,
        quiz_score: c.quizzes?.[0]?.score || null,
        is_assignment: c.is_assignment || false,
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
      });
    } catch (error: any) {
      Alert.alert("Error", "Could not load course. Please try again.");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteChapter = async (chapterId: string, chapterTitle: string) => {
    if (!course) return;
    try {
      setLoadingChapter(chapterId);
      await apiCompleteChapter(course.id, chapterId);
      await apiLogActivity("chapter_completed", `Completed chapter: ${chapterTitle} ✅`);
      setCourse((prev) =>
        prev
          ? {
              ...prev,
              completed_chapters: prev.completed_chapters + 1,
              chapters: prev.chapters.map((c) =>
                c.id === chapterId ? { ...c, is_completed: true } : c
              ),
            }
          : prev
      );
      Alert.alert("Chapter Complete! 🎉", "Great job! Keep going!");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Could not mark chapter as complete");
    } finally {
      setLoadingChapter(null);
    }
  };

  const submitQuizScore = async (quizId: string, chapterId: string, score: number) => {
    if (!course) return;
    try {
      setLoadingQuiz(quizId);
      await apiSubmitQuiz(course.id, quizId, score);
      const passed = score >= 60;
      await apiLogActivity(
        passed ? "quiz_passed" : "quiz_failed",
        `Quiz score: ${score}% — ${passed ? "Passed ✅" : "Failed ❌"}`
      );
      setCourse((prev) =>
        prev
          ? {
              ...prev,
              chapters: prev.chapters.map((c) =>
                c.id === chapterId
                  ? { ...c, quiz_score: score, quiz_passed: passed }
                  : c
              ),
            }
          : prev
      );
      Alert.alert(
        passed ? "Quiz Passed! 🎉" : "Quiz Failed 😔",
        passed
          ? `Score: ${score}% — You earned 50 XP!`
          : `Score: ${score}% — You need 60% to pass. Try again!`
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Could not submit quiz");
    } finally {
      setLoadingQuiz(null);
    }
  };

  const handleQuizPress = (chapter: Chapter) => {
    if (!chapter.is_completed) {
      Alert.alert("Locked", "Complete the chapter first to unlock the quiz.");
      return;
    }
    if (!chapter.quiz_id) return;
    const quizId = chapter.quiz_id;
    const chapterId = chapter.id;
    Alert.alert("Submit Quiz Score", "Choose your score", [
      { text: "Cancel", style: "cancel" },
      { text: "60%", onPress: () => submitQuizScore(quizId, chapterId, 60) },
      { text: "85%", onPress: () => submitQuizScore(quizId, chapterId, 85) },
      { text: "100%", onPress: () => submitQuizScore(quizId, chapterId, 100) },
    ]);
  };

  const handleChapterPress = (chapter: Chapter) => {
    if (chapter.is_completed) return;
    Alert.alert(chapter.title, "Mark this chapter as complete?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Mark Complete ✅",
        onPress: () => handleCompleteChapter(chapter.id, chapter.title),
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Loading course...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!course) return null;

  const completedChapters = course.chapters.filter((c) => c.is_completed).length;
  const progressPercent = Math.round((completedChapters / course.chapters.length) * 100);
  const passedQuizzes = course.chapters.filter((c) => c.has_quiz && c.quiz_passed).length;
  const totalQuizzes = course.chapters.filter((c) => c.has_quiz).length;
  const scoredChapters = course.chapters.filter((c) => c.quiz_score !== null && c.quiz_score > 0);
  const avgScore =
    scoredChapters.length > 0
      ? Math.round(
          scoredChapters.reduce((acc, c) => acc + (c.quiz_score ?? 0), 0) /
            scoredChapters.length
        )
      : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Course Detail
        </Text>
        {/* Quiz from file button */}
        <TouchableOpacity
          style={styles.quizFromFileBtn}
          onPress={() => setQuizModalVisible(true)}
        >
          <Ionicons name="document-text-outline" size={20} color={PRIMARY} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIconBox}>
            <Ionicons
              name={course.type === "ai" ? "sparkles" : "school"}
              size={36}
              color="white"
            />
          </View>
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: course.type === "ai" ? PRIMARY + "20" : "#eff6ff" },
            ]}
          >
            <Text
              style={[
                styles.typeBadgeText,
                { color: course.type === "ai" ? PRIMARY : "#3b82f6" },
              ]}
            >
              {course.type === "ai" ? "AI Generated" : "Moodle Course"}
            </Text>
          </View>
          <Text style={styles.courseTitle}>{course.title}</Text>
          <Text style={styles.courseSubject}>{course.subject}</Text>
          <Text style={styles.courseDescription}>{course.description}</Text>
        </View>

        {/* Progress Card */}
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
              <Text style={styles.progressStatText}>
                {completedChapters}/{course.chapters.length} Chapters
              </Text>
            </View>
            <View style={styles.progressStat}>
              <MaterialIcons name="quiz" size={18} color="#8b5cf6" />
              <Text style={styles.progressStatText}>
                {passedQuizzes}/{totalQuizzes} Quizzes Passed
              </Text>
            </View>
          </View>
        </View>

        {/* Upload file banner */}
        <TouchableOpacity
          style={styles.uploadBanner}
          onPress={() => setQuizModalVisible(true)}
        >
          <View style={styles.uploadBannerLeft}>
            <Ionicons name="document-text-outline" size={24} color={PRIMARY} />
            <View>
              <Text style={styles.uploadBannerTitle}>Quiz from your notes</Text>
              <Text style={styles.uploadBannerSubtitle}>
                Upload a PDF and AI generates a quiz
              </Text>
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

        {/* Chapters Tab */}
        {activeTab === "chapters" && (
          <View style={styles.section}>
            {course.chapters.map((chapter, index) => (
              <View key={chapter.id}>
                {index < course.chapters.length - 1 && (
                  <View
                    style={[
                      styles.connector,
                      { backgroundColor: chapter.is_completed ? PRIMARY : "#e5e7eb" },
                    ]}
                  />
                )}
                <TouchableOpacity
                  style={[
                    styles.chapterCard,
                    chapter.is_completed && styles.chapterCardDone,
                  ]}
                  onPress={() => handleChapterPress(chapter)}
                >
                  <View
                    style={[
                      styles.stepCircle,
                      { backgroundColor: chapter.is_completed ? PRIMARY : "#e5e7eb" },
                    ]}
                  >
                    {loadingChapter === chapter.id ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : chapter.is_completed ? (
                      <Ionicons name="checkmark" size={16} color="white" />
                    ) : (
                      <Text style={styles.stepNumber}>{chapter.order_index}</Text>
                    )}
                  </View>
                  <View style={styles.chapterInfo}>
                    <Text
                      style={[
                        styles.chapterTitle,
                        !chapter.is_completed && styles.chapterTitleLocked,
                      ]}
                    >
                      {chapter.title}
                    </Text>
                    <View style={styles.chapterMeta}>
                      <Ionicons name="time-outline" size={12} color="#999" />
                      <Text style={styles.chapterDuration}>{chapter.duration}</Text>
                      {chapter.is_assignment === true && (
                        <View style={styles.assignmentBadge}>
                          <Text style={styles.assignmentBadgeText}>Assignment</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.chapterRight}>
                    {chapter.is_completed ? (
                      <View style={styles.doneBadge}>
                        <Text style={styles.doneBadgeText}>Done</Text>
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color="#ccc" />
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Quizzes Tab */}
        {activeTab === "quizzes" && (
          <View style={styles.section}>
            {course.chapters
              .filter((c) => c.has_quiz)
              .map((chapter) => (
                <TouchableOpacity
                  key={chapter.id}
                  style={styles.quizCard}
                  onPress={() => handleQuizPress(chapter)}
                >
                  <View
                    style={[
                      styles.quizIconBox,
                      {
                        backgroundColor: chapter.quiz_passed
                          ? "#22c55e20"
                          : chapter.quiz_score !== null
                          ? "#ef444420"
                          : "#f3f4f6",
                      },
                    ]}
                  >
                    {loadingQuiz === chapter.quiz_id ? (
                      <ActivityIndicator size="small" color="#999" />
                    ) : (
                      <MaterialIcons
                        name="quiz"
                        size={24}
                        color={
                          chapter.quiz_passed
                            ? "#22c55e"
                            : chapter.quiz_score !== null
                            ? "#ef4444"
                            : "#ccc"
                        }
                      />
                    )}
                  </View>
                  <View style={styles.quizInfo}>
                    <Text style={styles.quizTitle}>Quiz: {chapter.title}</Text>
                    {chapter.quiz_score !== null ? (
                      <Text style={styles.quizScore}>Score: {chapter.quiz_score}%</Text>
                    ) : (
                      <Text style={styles.quizLocked}>
                        {chapter.is_completed
                          ? "Tap to attempt quiz"
                          : "Complete chapter first"}
                      </Text>
                    )}
                  </View>
                  <View style={styles.quizRight}>
                    {chapter.quiz_passed ? (
                      <View style={[styles.doneBadge, { backgroundColor: "#22c55e20" }]}>
                        <Text style={[styles.doneBadgeText, { color: "#22c55e" }]}>
                          Passed
                        </Text>
                      </View>
                    ) : chapter.quiz_score !== null ? (
                      <View style={[styles.doneBadge, { backgroundColor: "#ef444420" }]}>
                        <Text style={[styles.doneBadgeText, { color: "#ef4444" }]}>
                          Failed
                        </Text>
                      </View>
                    ) : (
                      <Ionicons name="lock-closed" size={18} color="#ccc" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
          </View>
        )}

        {/* Progress Tab */}
        {activeTab === "progress" && (
          <View style={styles.section}>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: PRIMARY + "15" }]}>
                <Text style={[styles.summaryNumber, { color: PRIMARY }]}>
                  {progressPercent}%
                </Text>
                <Text style={styles.summaryLabel}>Completed</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: "#8b5cf615" }]}>
                <Text style={[styles.summaryNumber, { color: "#8b5cf6" }]}>
                  {passedQuizzes}/{totalQuizzes}
                </Text>
                <Text style={styles.summaryLabel}>Quizzes Passed</Text>
              </View>
              <View style={[styles.summaryCard, { backgroundColor: "#f9731615" }]}>
                <Text style={[styles.summaryNumber, { color: "#f97316" }]}>{avgScore}%</Text>
                <Text style={styles.summaryLabel}>Avg Score</Text>
              </View>
            </View>

            <Text style={styles.breakdownTitle}>Chapter Breakdown</Text>
            {course.chapters.map((chapter) => (
              <View key={chapter.id} style={styles.breakdownCard}>
                <View style={styles.breakdownLeft}>
                  <View
                    style={[
                      styles.breakdownDot,
                      { backgroundColor: chapter.is_completed ? PRIMARY : "#e5e7eb" },
                    ]}
                  />
                  <Text style={styles.breakdownTitle2} numberOfLines={1}>
                    {chapter.title}
                  </Text>
                </View>
                <View style={styles.breakdownRight}>
                  {chapter.is_completed ? (
                    <Ionicons name="checkmark-circle" size={20} color={PRIMARY} />
                  ) : (
                    <Ionicons name="ellipse-outline" size={20} color="#ccc" />
                  )}
                  {chapter.has_quiz && (
                    <View
                      style={[
                        styles.quizResultBadge,
                        {
                          backgroundColor: chapter.quiz_passed
                            ? "#22c55e20"
                            : chapter.quiz_score !== null
                            ? "#ef444420"
                            : "#f3f4f6",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.quizResultText,
                          {
                            color: chapter.quiz_passed
                              ? "#22c55e"
                              : chapter.quiz_score !== null
                              ? "#ef4444"
                              : "#999",
                          },
                        ]}
                      >
                        {chapter.quiz_score !== null ? `${chapter.quiz_score}%` : "Quiz"}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* File Quiz Modal */}
      <FileQuizModal
        visible={quizModalVisible}
        onClose={() => setQuizModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, fontSize: 14, color: "#999" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "white",
    elevation: 2,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  quizFromFileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PRIMARY + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  container: { flex: 1, backgroundColor: "#f7f8f6" },
  hero: {
    backgroundColor: "white",
    padding: 24,
    alignItems: "center",
    marginBottom: 8,
  },
  heroIconBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 12,
  },
  typeBadgeText: { fontSize: 12, fontWeight: "bold" },
  courseTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 4,
  },
  courseSubject: { fontSize: 14, color: "#999", marginBottom: 12 },
  courseDescription: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  progressCard: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    elevation: 1,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressTitle: { fontWeight: "bold", color: "#333" },
  progressPercent: { fontWeight: "bold", color: PRIMARY, fontSize: 18 },
  progressBarBg: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 10,
    marginBottom: 12,
  },
  progressBarFill: { height: 8, backgroundColor: PRIMARY, borderRadius: 10 },
  progressStats: { flexDirection: "row", justifyContent: "space-around" },
  progressStat: { flexDirection: "row", alignItems: "center", gap: 6 },
  progressStatText: { fontSize: 13, color: "#666" },
  uploadBanner: {
    backgroundColor: PRIMARY + "15",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: PRIMARY + "30",
  },
  uploadBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  uploadBannerTitle: { fontSize: 14, fontWeight: "bold", color: "#333" },
  uploadBannerSubtitle: { fontSize: 12, color: "#666", marginTop: 2 },
  tabs: {
    flexDirection: "row",
    marginHorizontal: 16,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  tabActive: { backgroundColor: PRIMARY },
  tabText: { fontWeight: "600", color: "#999", fontSize: 14 },
  tabTextActive: { color: "white" },
  section: { paddingHorizontal: 16, paddingBottom: 40 },
  connector: {
    width: 2,
    height: 12,
    marginLeft: 29,
    marginVertical: -2,
    zIndex: 0,
  },
  chapterCard: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    elevation: 1,
    zIndex: 1,
  },
  chapterCardDone: { borderLeftWidth: 3, borderLeftColor: PRIMARY },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stepNumber: { fontWeight: "bold", color: "#999", fontSize: 14 },
  chapterInfo: { flex: 1 },
  chapterTitle: { fontWeight: "bold", color: "#333", fontSize: 14, marginBottom: 4 },
  chapterTitleLocked: { color: "#999" },
  chapterMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  chapterDuration: { fontSize: 12, color: "#999" },
  assignmentBadge: {
    backgroundColor: "#f9731620",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  assignmentBadgeText: { fontSize: 10, color: "#f97316", fontWeight: "bold" },
  chapterRight: { alignItems: "flex-end" },
  doneBadge: {
    backgroundColor: PRIMARY + "20",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  doneBadgeText: { fontSize: 11, color: PRIMARY, fontWeight: "bold" },
  quizCard: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    elevation: 1,
  },
  quizIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  quizInfo: { flex: 1 },
  quizTitle: { fontWeight: "bold", color: "#333", fontSize: 14, marginBottom: 4 },
  quizScore: { fontSize: 12, color: "#666" },
  quizLocked: { fontSize: 12, color: "#ccc" },
  quizRight: { alignItems: "flex-end" },
  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  summaryNumber: { fontSize: 22, fontWeight: "bold", marginBottom: 4 },
  summaryLabel: { fontSize: 11, color: "#666", textAlign: "center" },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
  },
  breakdownCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  breakdownLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  breakdownDot: { width: 10, height: 10, borderRadius: 5 },
  breakdownTitle2: { fontSize: 13, color: "#333", fontWeight: "500", flex: 1 },
  breakdownRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  quizResultBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  quizResultText: { fontSize: 11, fontWeight: "bold" },
});
