import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { apiCompleteChapter, apiSubmitQuiz, apiLogActivity, apiGetCourse } from "@/services/api";
import FileQuizModal from "@/components/FileQuizModal";

const PRIMARY = "#9cd21f";
const PASSING_GRADE = 80;

interface Question { question: string; options: string[]; answer: string; }
interface Quiz { id: string; title: string; questions: Question[]; score: number | null; passed: boolean; }
interface Chapter {
  id: string; title: string; content: string; duration: string;
  is_completed: boolean; order_index: number;
  has_quiz: boolean; quiz: Quiz | null; is_assignment?: boolean;
}
interface Course {
  id: string; title: string; subject: string; description: string;
  total_chapters: number; completed_chapters: number; type: string; chapters: Chapter[];
}
interface AIReport {
  summary: string; strengths: string[]; improvements: string[];
  recommendation: string; passed: boolean;
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

  // Chapter reader modal
  const [chapterModal, setChapterModal] = useState<Chapter | null>(null);

  // Quiz modal
  const [activeQuiz, setActiveQuiz] = useState<{ chapter: Chapter; quiz: Quiz } | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizSubmitting, setQuizSubmitting] = useState(false);

  // Report modal
  const [report, setReport] = useState<{ score: number; report: AIReport; chapterTitle: string } | null>(null);

  useEffect(() => { if (courseId) fetchCourse(); }, [courseId]);

  const fetchCourse = async () => {
    try {
      setLoading(true);
      const res = await apiGetCourse(courseId!);
      const data = res.data;
      const chapters: Chapter[] = (data.chapters || []).map((c: any) => ({
        id: c.id, title: c.title, content: c.content || "",
        duration: c.duration || "30 min",
        is_completed: c.is_completed || false,
        order_index: c.order_index,
        has_quiz: c.quizzes && c.quizzes.length > 0,
        quiz: c.quizzes?.[0] ? {
          id: c.quizzes[0].id,
          title: c.quizzes[0].title,
          questions: c.quizzes[0].questions || [],
          score: c.quizzes[0].score ?? null,
          passed: c.quizzes[0].passed || false,
        } : null,
        is_assignment: c.is_assignment || false,
      }));
      setCourse({ id: data.id, title: data.title, subject: data.subject, description: data.description, total_chapters: data.total_chapters, completed_chapters: data.completed_chapters, type: data.type || "ai", chapters });
    } catch (error: any) {
      Alert.alert("Error", "Could not load course.");
      router.replace("/(tabs)/dashboard" as any);
    } finally {
      setLoading(false);
    }
  };

  const handleChapterPress = (chapter: Chapter) => {
    // Always open chapter content
    setChapterModal(chapter);
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
      Alert.alert("Chapter Complete! 🎉", chapter.has_quiz ? "Quiz is now unlocked!" : "Great job!");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoadingChapter(null);
    }
  };

  const openQuiz = (chapter: Chapter) => {
    if (!chapter.is_completed) {
      Alert.alert("Locked 🔒", "Complete the chapter first to unlock the quiz.");
      return;
    }
    if (!chapter.quiz) return;
    if (!chapter.quiz.questions || chapter.quiz.questions.length === 0) {
      Alert.alert("No questions", "This quiz has no questions yet.");
      return;
    }
    setActiveQuiz({ chapter, quiz: chapter.quiz });
    setQuizAnswers({});
    setQuizIndex(0);
  };

  const handleQuizAnswer = (option: string) => {
    if (!activeQuiz) return;
    const newAnswers = { ...quizAnswers, [quizIndex]: option };
    setQuizAnswers(newAnswers);
    if (quizIndex < activeQuiz.quiz.questions.length - 1) {
      setQuizIndex((prev) => prev + 1);
    } else {
      finishQuiz(newAnswers);
    }
  };

  const finishQuiz = async (answers: Record<number, string>) => {
    if (!activeQuiz || !course) return;
    const { chapter, quiz } = activeQuiz;
    const correct = quiz.questions.filter((q, i) => answers[i] === q.answer).length;
    const score = Math.round((correct / quiz.questions.length) * 100);
    const userAnswers = quiz.questions.map((_, i) => answers[i] || "");

    setQuizSubmitting(true);
    try {
      const res = await apiSubmitQuiz(course.id, quiz.id, score, chapter.title, quiz.questions, userAnswers);
      const passed = score >= PASSING_GRADE;

      setCourse((prev) => prev ? {
        ...prev,
        chapters: prev.chapters.map((c) => c.id === chapter.id ? {
          ...c, quiz: c.quiz ? { ...c.quiz, score, passed } : null,
        } : c),
      } : prev);

      setActiveQuiz(null);
      setReport({ score, report: res.data.report, chapterTitle: chapter.title });
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setQuizSubmitting(false);
    }
  };

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      <View style={styles.centered}><ActivityIndicator size="large" color={PRIMARY} /><Text style={styles.loadingText}>Loading course...</Text></View>
    </SafeAreaView>
  );
  if (!course) return null;

  const completedChapters = course.chapters.filter((c) => c.is_completed).length;
  const progressPercent = course.chapters.length > 0 ? Math.round((completedChapters / course.chapters.length) * 100) : 0;
  const passedQuizzes = course.chapters.filter((c) => c.has_quiz && c.quiz?.passed).length;
  const totalQuizzes = course.chapters.filter((c) => c.has_quiz).length;
  const scoredChapters = course.chapters.filter((c) => c.quiz?.score !== null && (c.quiz?.score ?? 0) > 0);
  const avgScore = scoredChapters.length > 0 ? Math.round(scoredChapters.reduce((acc, c) => acc + (c.quiz?.score ?? 0), 0) / scoredChapters.length) : 0;

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
          <View style={[styles.typeBadge, { backgroundColor: course.type === "ai" ? PRIMARY + "20" : "#eff6ff" }]}>
            <Text style={[styles.typeBadgeText, { color: course.type === "ai" ? PRIMARY : "#3b82f6" }]}>
              {course.type === "ai" ? "AI Generated" : "Moodle Course"}
            </Text>
          </View>
          <Text style={styles.courseTitle}>{course.title}</Text>
          <Text style={styles.courseSubject}>{course.subject}</Text>
          <Text style={styles.courseDescription}>{course.description}</Text>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Overall Progress</Text>
            <Text style={styles.progressPercent}>{progressPercent}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
          <View style={styles.progressStats}>
            <View style={styles.progressStat}><MaterialIcons name="menu-book" size={18} color={PRIMARY} /><Text style={styles.progressStatText}>{completedChapters}/{course.chapters.length} Chapters</Text></View>
            <View style={styles.progressStat}><MaterialIcons name="quiz" size={18} color="#8b5cf6" /><Text style={styles.progressStatText}>{passedQuizzes}/{totalQuizzes} Quizzes Passed</Text></View>
          </View>
        </View>

        <TouchableOpacity style={styles.uploadBanner} onPress={() => setQuizModalVisible(true)}>
          <View style={styles.uploadBannerLeft}>
            <Ionicons name="document-text-outline" size={24} color={PRIMARY} />
            <View><Text style={styles.uploadBannerTitle}>Quiz from your notes</Text><Text style={styles.uploadBannerSubtitle}>Upload a PDF and AI generates a quiz</Text></View>
          </View>
          <Ionicons name="arrow-forward" size={18} color={PRIMARY} />
        </TouchableOpacity>

        <View style={styles.tabs}>
          {(["chapters", "quizzes", "progress"] as TabType[]).map((tab) => (
            <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab.charAt(0).toUpperCase() + tab.slice(1)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === "chapters" && (
          <View style={styles.section}>
            {course.chapters.map((chapter, index) => (
              <View key={chapter.id}>
                {index < course.chapters.length - 1 && (
                  <View style={[styles.connector, { backgroundColor: chapter.is_completed ? PRIMARY : "#e5e7eb" }]} />
                )}
                <TouchableOpacity style={[styles.chapterCard, chapter.is_completed && styles.chapterCardDone]} onPress={() => handleChapterPress(chapter)}>
                  <View style={[styles.stepCircle, { backgroundColor: chapter.is_completed ? PRIMARY : "#e5e7eb" }]}>
                    {loadingChapter === chapter.id ? <ActivityIndicator size="small" color="white" /> :
                      chapter.is_completed ? <Ionicons name="checkmark" size={16} color="white" /> :
                      <Text style={styles.stepNumber}>{chapter.order_index}</Text>}
                  </View>
                  <View style={styles.chapterInfo}>
                    <Text style={[styles.chapterTitle, !chapter.is_completed && styles.chapterTitleLocked]}>{chapter.title}</Text>
                    <View style={styles.chapterMeta}>
                      <Ionicons name="time-outline" size={12} color="#999" />
                      <Text style={styles.chapterDuration}>{chapter.duration}</Text>
                      {chapter.has_quiz && chapter.is_completed && (
                        <View style={[styles.assignmentBadge, { backgroundColor: "#8b5cf620" }]}>
                          <Text style={[styles.assignmentBadgeText, { color: "#8b5cf6" }]}>Quiz ready</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.chapterRight}>
                    {chapter.is_completed ? <View style={styles.doneBadge}><Text style={styles.doneBadgeText}>Done</Text></View> :
                      <Ionicons name="chevron-forward" size={18} color="#ccc" />}
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {activeTab === "quizzes" && (
          <View style={styles.section}>
            <View style={styles.passingGradeBanner}>
              <Ionicons name="ribbon-outline" size={16} color="#f97316" />
              <Text style={styles.passingGradeText}>Passing grade: {PASSING_GRADE}%</Text>
            </View>
            {course.chapters.filter((c) => c.has_quiz).map((chapter) => (
              <TouchableOpacity key={chapter.id} style={styles.quizCard} onPress={() => openQuiz(chapter)}>
                <View style={[styles.quizIconBox, { backgroundColor: chapter.quiz?.passed ? "#22c55e20" : chapter.quiz?.score !== null ? "#ef444420" : "#f3f4f6" }]}>
                  <MaterialIcons name="quiz" size={24} color={chapter.quiz?.passed ? "#22c55e" : chapter.quiz?.score !== null ? "#ef4444" : "#ccc"} />
                </View>
                <View style={styles.quizInfo}>
                  <Text style={styles.quizTitle}>Quiz: {chapter.title}</Text>
                  {chapter.quiz?.score !== null ? (
                    <Text style={styles.quizScore}>Score: {chapter.quiz?.score}% {chapter.quiz?.passed ? "✅" : "❌"}</Text>
                  ) : (
                    <Text style={styles.quizLocked}>{chapter.is_completed ? "Tap to attempt" : "Complete chapter first"}</Text>
                  )}
                </View>
                <View style={styles.quizRight}>
                  {chapter.quiz?.passed ? (
                    <View style={[styles.doneBadge, { backgroundColor: "#22c55e20" }]}><Text style={[styles.doneBadgeText, { color: "#22c55e" }]}>Passed</Text></View>
                  ) : chapter.quiz?.score !== null ? (
                    <View style={[styles.doneBadge, { backgroundColor: "#ef444420" }]}><Text style={[styles.doneBadgeText, { color: "#ef4444" }]}>Failed</Text></View>
                  ) : (
                    <Ionicons name="lock-closed" size={18} color="#ccc" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === "progress" && (
          <View style={styles.section}>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryCard, { backgroundColor: PRIMARY + "15" }]}><Text style={[styles.summaryNumber, { color: PRIMARY }]}>{progressPercent}%</Text><Text style={styles.summaryLabel}>Completed</Text></View>
              <View style={[styles.summaryCard, { backgroundColor: "#8b5cf615" }]}><Text style={[styles.summaryNumber, { color: "#8b5cf6" }]}>{passedQuizzes}/{totalQuizzes}</Text><Text style={styles.summaryLabel}>Quizzes Passed</Text></View>
              <View style={[styles.summaryCard, { backgroundColor: "#f9731615" }]}><Text style={[styles.summaryNumber, { color: "#f97316" }]}>{avgScore}%</Text><Text style={styles.summaryLabel}>Avg Score</Text></View>
            </View>
            <Text style={styles.breakdownTitle}>Chapter Breakdown</Text>
            {course.chapters.map((chapter) => (
              <View key={chapter.id} style={styles.breakdownCard}>
                <View style={styles.breakdownLeft}>
                  <View style={[styles.breakdownDot, { backgroundColor: chapter.is_completed ? PRIMARY : "#e5e7eb" }]} />
                  <Text style={styles.breakdownTitle2} numberOfLines={1}>{chapter.title}</Text>
                </View>
                <View style={styles.breakdownRight}>
                  {chapter.is_completed ? <Ionicons name="checkmark-circle" size={20} color={PRIMARY} /> : <Ionicons name="ellipse-outline" size={20} color="#ccc" />}
                  {chapter.has_quiz && (
                    <View style={[styles.quizResultBadge, { backgroundColor: chapter.quiz?.passed ? "#22c55e20" : chapter.quiz?.score !== null ? "#ef444420" : "#f3f4f6" }]}>
                      <Text style={[styles.quizResultText, { color: chapter.quiz?.passed ? "#22c55e" : chapter.quiz?.score !== null ? "#ef4444" : "#999" }]}>
                        {chapter.quiz?.score !== null ? `${chapter.quiz?.score}%` : "Quiz"}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Chapter Reader Modal ─────────────────────────────────── */}
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
              <Text style={styles.chapterContentTitle}>{chapterModal.title}</Text>
              <Text style={styles.chapterContentBody}>{chapterModal.content || "No content available for this chapter."}</Text>

              {!chapterModal.is_completed && (
                <TouchableOpacity
                  style={styles.completeBtn}
                  onPress={() => handleCompleteChapter(chapterModal)}
                  disabled={loadingChapter === chapterModal.id}
                >
                  {loadingChapter === chapterModal.id ? <ActivityIndicator color="white" /> : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="white" />
                      <Text style={styles.completeBtnText}>Mark as Complete</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {chapterModal.is_completed && chapterModal.has_quiz && (
                <TouchableOpacity
                  style={[styles.completeBtn, { backgroundColor: "#8b5cf6" }]}
                  onPress={() => { setChapterModal(null); openQuiz(chapterModal); }}
                >
                  <Ionicons name="help-circle" size={20} color="white" />
                  <Text style={styles.completeBtnText}>Take Quiz</Text>
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

      {/* ── Quiz Modal ───────────────────────────────────────────── */}
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
              <View style={[styles.progressFill, { width: `${(quizIndex / activeQuiz.quiz.questions.length) * 100}%` }]} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
              <View style={styles.quizMeta}>
                <Text style={styles.quizMetaText}>{quizIndex + 1} / {activeQuiz.quiz.questions.length}</Text>
                <View style={styles.passingBadge}><Text style={styles.passingBadgeText}>Pass: {PASSING_GRADE}%</Text></View>
              </View>

              <Text style={styles.questionText}>{activeQuiz.quiz.questions[quizIndex].question}</Text>

              {quizSubmitting ? (
                <View style={styles.centered}><ActivityIndicator size="large" color={PRIMARY} /><Text style={{ marginTop: 12, color: "#666" }}>Generating AI report...</Text></View>
              ) : (
                <View style={styles.options}>
                  {activeQuiz.quiz.questions[quizIndex].options.map((opt, i) => (
                    <TouchableOpacity key={i} style={styles.optionBtn} onPress={() => handleQuizAnswer(opt)}>
                      <View style={styles.optionLetter}><Text style={styles.optionLetterText}>{["A","B","C","D"][i]}</Text></View>
                      <Text style={styles.optionText}>{opt}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>

      {/* ── AI Report Modal ──────────────────────────────────────── */}
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
              {/* Score card */}
              <View style={[styles.reportScoreCard, { borderColor: report.report.passed ? PRIMARY : "#ef4444" }]}>
                <Ionicons name={report.report.passed ? "trophy" : "refresh"} size={44} color={report.report.passed ? PRIMARY : "#ef4444"} />
                <Text style={[styles.reportScore, { color: report.report.passed ? PRIMARY : "#ef4444" }]}>{report.score}%</Text>
                <Text style={styles.reportStatus}>{report.report.passed ? "Passed ✅" : `Failed — need ${PASSING_GRADE}%`}</Text>
                <Text style={styles.reportSummary}>{report.report.summary}</Text>
              </View>

              {/* Strengths */}
              <View style={styles.reportSection}>
                <Text style={styles.reportSectionTitle}>💪 Strengths</Text>
                {report.report.strengths.map((s, i) => (
                  <View key={i} style={styles.reportItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
                    <Text style={styles.reportItemText}>{s}</Text>
                  </View>
                ))}
              </View>

              {/* Improvements */}
              <View style={styles.reportSection}>
                <Text style={styles.reportSectionTitle}>📖 Areas to Improve</Text>
                {report.report.improvements.map((s, i) => (
                  <View key={i} style={styles.reportItem}>
                    <Ionicons name="alert-circle" size={16} color="#f97316" />
                    <Text style={styles.reportItemText}>{s}</Text>
                  </View>
                ))}
              </View>

              {/* Recommendation */}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 12, fontSize: 14, color: "#999" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "white", elevation: 2 },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#333", flex: 1, textAlign: "center", marginHorizontal: 8 },
  quizFromFileBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: PRIMARY + "20", alignItems: "center", justifyContent: "center" },
  container: { flex: 1, backgroundColor: "#f7f8f6" },
  hero: { backgroundColor: "white", padding: 24, alignItems: "center", marginBottom: 8 },
  heroIconBox: { width: 80, height: 80, borderRadius: 20, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  typeBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 12 },
  typeBadgeText: { fontSize: 12, fontWeight: "bold" },
  courseTitle: { fontSize: 22, fontWeight: "bold", color: "#333", textAlign: "center", marginBottom: 4 },
  courseSubject: { fontSize: 14, color: "#999", marginBottom: 12 },
  courseDescription: { fontSize: 14, color: "#666", textAlign: "center", lineHeight: 22 },
  progressCard: { backgroundColor: "white", marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 16, elevation: 1 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  progressTitle: { fontWeight: "bold", color: "#333" },
  progressPercent: { fontWeight: "bold", color: PRIMARY, fontSize: 18 },
  progressBarBg: { height: 8, backgroundColor: "#e5e7eb", borderRadius: 10, marginBottom: 12 },
  progressBarFill: { height: 8, backgroundColor: PRIMARY, borderRadius: 10 },
  progressStats: { flexDirection: "row", justifyContent: "space-around" },
  progressStat: { flexDirection: "row", alignItems: "center", gap: 6 },
  progressStatText: { fontSize: 13, color: "#666" },
  uploadBanner: { backgroundColor: PRIMARY + "15", marginHorizontal: 16, marginBottom: 12, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: PRIMARY + "30" },
  uploadBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  uploadBannerTitle: { fontSize: 14, fontWeight: "bold", color: "#333" },
  uploadBannerSubtitle: { fontSize: 12, color: "#666", marginTop: 2 },
  tabs: { flexDirection: "row", marginHorizontal: 16, backgroundColor: "white", borderRadius: 12, padding: 4, marginBottom: 16 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: PRIMARY },
  tabText: { fontWeight: "600", color: "#999", fontSize: 14 },
  tabTextActive: { color: "white" },
  section: { paddingHorizontal: 16, paddingBottom: 40 },
  passingGradeBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff7ed", borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: "#fed7aa" },
  passingGradeText: { fontSize: 13, color: "#f97316", fontWeight: "600" },
  connector: { width: 2, height: 12, marginLeft: 29, marginVertical: -2, zIndex: 0 },
  chapterCard: { backgroundColor: "white", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 8, elevation: 1, zIndex: 1 },
  chapterCardDone: { borderLeftWidth: 3, borderLeftColor: PRIMARY },
  stepCircle: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginRight: 12 },
  stepNumber: { fontWeight: "bold", color: "#999", fontSize: 14 },
  chapterInfo: { flex: 1 },
  chapterTitle: { fontWeight: "bold", color: "#333", fontSize: 14, marginBottom: 4 },
  chapterTitleLocked: { color: "#999" },
  chapterMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  chapterDuration: { fontSize: 12, color: "#999" },
  assignmentBadge: { backgroundColor: "#f9731620", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginLeft: 4 },
  assignmentBadgeText: { fontSize: 10, color: "#f97316", fontWeight: "bold" },
  chapterRight: { alignItems: "flex-end" },
  doneBadge: { backgroundColor: PRIMARY + "20", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  doneBadgeText: { fontSize: 11, color: PRIMARY, fontWeight: "bold" },
  quizCard: { backgroundColor: "white", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 10, elevation: 1 },
  quizIconBox: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 12 },
  quizInfo: { flex: 1 },
  quizTitle: { fontWeight: "bold", color: "#333", fontSize: 14, marginBottom: 4 },
  quizScore: { fontSize: 12, color: "#666" },
  quizLocked: { fontSize: 12, color: "#ccc" },
  quizRight: { alignItems: "flex-end" },
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
  // Modal
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "white", elevation: 2 },
  modalHeaderTitle: { fontSize: 16, fontWeight: "bold", color: "#333", flex: 1, textAlign: "center", marginHorizontal: 8 },
  chapterContent: { padding: 20, paddingBottom: 40 },
  chapterContentTitle: { fontSize: 22, fontWeight: "bold", color: "#333", marginBottom: 16 },
  chapterContentBody: { fontSize: 15, color: "#444", lineHeight: 26 },
  completeBtn: { backgroundColor: PRIMARY, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 24 },
  completeBtnText: { color: "white", fontWeight: "bold", fontSize: 16 },
  completedBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: PRIMARY + "15", borderRadius: 12, padding: 12, marginTop: 16 },
  completedBannerText: { color: PRIMARY, fontWeight: "600", fontSize: 14 },
  // Quiz
  progressBg: { height: 6, backgroundColor: "#e5e7eb" },
  progressFill: { height: 6, backgroundColor: PRIMARY },
  quizMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  quizMetaText: { fontSize: 13, color: "#999" },
  passingBadge: { backgroundColor: "#fff7ed", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  passingBadgeText: { fontSize: 12, color: "#f97316", fontWeight: "600" },
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
});