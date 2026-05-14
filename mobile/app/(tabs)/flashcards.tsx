import React, { useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, Animated, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { apiGetAllFlashcards, apiGetFlashcardsDue, apiReviewFlashcard, apiCompleteReviewSession, apiRecordStudyActivity } from "@/services/api";
import { useRef } from "react";

const PRIMARY = "#9cd21f";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Card {
  id: string; front: string; back: string; card_type: string;
  interval_days: number; total_reviews: number; correct_reviews: number;
  next_review_at: string;
}
interface ChapterGroup {
  chapterId: string; chapterTitle: string; orderIndex: number; cards: Card[];
}
interface CourseGroup {
  courseId: string; courseTitle: string; courseSubject: string;
  chapters: ChapterGroup[];
}

// ─── Flip Card ────────────────────────────────────────────────────────────────
function FlipCard({ card, flipped, onFlip }: { card: Card; flipped: boolean; onFlip: () => void }) {
  const anim = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.spring(anim, { toValue: flipped ? 1 : 0, friction: 8, tension: 40, useNativeDriver: true }).start();
  }, [flipped]);

  const frontRotate  = anim.interpolate({ inputRange: [0,1], outputRange: ["0deg","180deg"] });
  const backRotate   = anim.interpolate({ inputRange: [0,1], outputRange: ["180deg","360deg"] });
  const frontOpacity = anim.interpolate({ inputRange: [0,0.5,1], outputRange: [1,0,0] });
  const backOpacity  = anim.interpolate({ inputRange: [0,0.5,1], outputRange: [0,0,1] });

  const typeColor: Record<string,string> = { qa: "#3b82f6", term: "#8b5cf6", concept: "#f97316" };
  const typeLabel: Record<string,string> = { qa: "Q&A", term: "Term", concept: "Concept" };
  const color = typeColor[card.card_type] || "#3b82f6";
  const label = typeLabel[card.card_type] || "Q&A";
  const isDue = new Date(card.next_review_at) <= new Date();

  return (
    <TouchableOpacity onPress={onFlip} activeOpacity={0.95} style={fc.container}>
      <Animated.View style={[fc.card, fc.front, { transform: [{ rotateY: frontRotate }], opacity: frontOpacity }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", width: "100%", marginBottom: 16 }}>
          <View style={[fc.badge, { backgroundColor: color + "15" }]}>
            <Text style={[fc.badgeText, { color }]}>{label}</Text>
          </View>
          {isDue && (
            <View style={[fc.badge, { backgroundColor: "#fef3c7" }]}>
              <Text style={[fc.badgeText, { color: "#d97706" }]}>Due</Text>
            </View>
          )}
        </View>
        <Text style={fc.frontText}>{card.front}</Text>
        <View style={fc.hint}>
          <Ionicons name="sync-outline" size={14} color="#ccc" />
          <Text style={fc.hintText}>Tap to flip</Text>
        </View>
      </Animated.View>

      <Animated.View style={[fc.card, fc.back, { transform: [{ rotateY: backRotate }], opacity: backOpacity }]}>
        <View style={[fc.badge, { backgroundColor: PRIMARY + "15", marginBottom: 16 }]}>
          <Text style={[fc.badgeText, { color: PRIMARY }]}>Answer</Text>
        </View>
        <Text style={fc.backText}>{card.back}</Text>
        {card.total_reviews > 0 && (
          <Text style={fc.reviewInfo}>
            {card.total_reviews} reviews · {Math.round((card.correct_reviews / card.total_reviews) * 100)}% correct · next in {card.interval_days}d
          </Text>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}
const fc = StyleSheet.create({
  container: { height: 240, marginBottom: 12 },
  card: { position: "absolute", width: "100%", height: "100%", backgroundColor: "white", borderRadius: 20, padding: 24, backfaceVisibility: "hidden", alignItems: "center", justifyContent: "center" },
  front: { borderWidth: 1.5, borderColor: "#e5e7eb" },
  back:  { borderWidth: 2, borderColor: PRIMARY, backgroundColor: "#f0f9e8" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  frontText: { fontSize: 17, fontWeight: "700", color: "#333", textAlign: "center", lineHeight: 26 },
  backText:  { fontSize: 15, color: "#444", textAlign: "center", lineHeight: 24 },
  hint: { flexDirection: "row", alignItems: "center", gap: 4, position: "absolute", bottom: 16 },
  hintText: { fontSize: 11, color: "#ccc" },
  reviewInfo: { fontSize: 10, color: "#bbb", position: "absolute", bottom: 16, textAlign: "center" },
});

// ─── Rating Buttons ───────────────────────────────────────────────────────────
function RatingButtons({ onRate }: { onRate: (r: number) => void }) {
  const btns = [
    { r: 1, label: "Again", emoji: "😟", color: "#ef4444", bg: "#fef2f2" },
    { r: 2, label: "Hard",  emoji: "😅", color: "#f97316", bg: "#fff7ed" },
    { r: 4, label: "Good",  emoji: "😊", color: "#3b82f6", bg: "#eff6ff" },
    { r: 5, label: "Easy",  emoji: "🚀", color: PRIMARY,   bg: "#f0f9e8" },
  ];
  return (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
      {btns.map((b) => (
        <TouchableOpacity key={b.r} onPress={() => onRate(b.r)} activeOpacity={0.8}
          style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 14, backgroundColor: b.bg, borderWidth: 1.5, borderColor: b.color + "40" }}>
          <Text style={{ fontSize: 20, marginBottom: 4 }}>{b.emoji}</Text>
          <Text style={{ fontSize: 12, fontWeight: "700", color: b.color }}>{b.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Review Session Modal ─────────────────────────────────────────────────────
function ReviewModal({
  visible, cards, onClose, courseTitle, chapterTitle,
}: {
  visible: boolean; cards: Card[]; onClose: (xp: number, correct: number) => void;
  courseTitle: string; chapterTitle: string;
}) {
  const [index,   setIndex]   = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [xp,      setXp]      = useState(0);
  const [done,    setDone]    = useState(false);
  const slideX = useRef(new Animated.Value(0)).current;

  // Reset when opened
  React.useEffect(() => {
    if (visible) { setIndex(0); setFlipped(false); setCorrect(0); setXp(0); setDone(false); }
  }, [visible]);

  const animNext = (then: () => void) => {
    Animated.sequence([
      Animated.timing(slideX, { toValue: -400, duration: 180, useNativeDriver: true }),
      Animated.timing(slideX, { toValue:  400, duration: 0,   useNativeDriver: true }),
    ]).start(() => {
      then(); setFlipped(false);
      Animated.timing(slideX, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    });
  };

  const handleRate = async (rating: number) => {
    const card = cards[index];
    let xpGain = 0;
    try {
      const res = await apiReviewFlashcard(card.id, rating);
      xpGain = res.data.xpGained || 0;
      setXp((x) => x + xpGain);
    } catch {}

    const newCorrect = correct + (rating >= 4 ? 1 : 0);
    if (rating >= 4) setCorrect(newCorrect);

    if (index + 1 >= cards.length) {
      try {
        await apiCompleteReviewSession(cards.length, newCorrect);
        await apiRecordStudyActivity("flashcard", xp + xpGain);
      } catch {}
      setDone(true);
    } else {
      animNext(() => setIndex((i) => i + 1));
    }
  };

  if (!visible) return null;
  const progress = cards.length > 0 ? (index / cards.length) * 100 : 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
        {done ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
            <Text style={{ fontSize: 72, marginBottom: 16 }}>🎉</Text>
            <Text style={{ fontSize: 24, fontWeight: "900", color: "#333", marginBottom: 8 }}>Session Complete!</Text>
            <Text style={{ color: "#999", marginBottom: 24 }}>{chapterTitle}</Text>
            <View style={{ flexDirection: "row", gap: 24, marginBottom: 24 }}>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 32, fontWeight: "900", color: PRIMARY }}>{cards.length}</Text>
                <Text style={{ fontSize: 12, color: "#999" }}>Reviewed</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 32, fontWeight: "900", color: "#22c55e" }}>{correct}</Text>
                <Text style={{ fontSize: 12, color: "#999" }}>Correct</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 32, fontWeight: "900", color: "#8b5cf6" }}>
                  {cards.length > 0 ? Math.round((correct / cards.length) * 100) : 0}%
                </Text>
                <Text style={{ fontSize: 12, color: "#999" }}>Accuracy</Text>
              </View>
            </View>
            {xp > 0 && (
              <View style={{ backgroundColor: PRIMARY + "15", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginBottom: 24, borderWidth: 1, borderColor: PRIMARY + "30" }}>
                <Text style={{ fontSize: 15, fontWeight: "700", color: PRIMARY }}>+{xp} XP earned! ⚡</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => onClose(xp, correct)}
              style={{ backgroundColor: PRIMARY, paddingVertical: 16, paddingHorizontal: 32, borderRadius: 16, width: "100%", alignItems: "center" }}>
              <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>Done</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "white" }}>
              <TouchableOpacity onPress={() => onClose(xp, correct)}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={18} color="#333" />
              </TouchableOpacity>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#333" }} numberOfLines={1}>{chapterTitle}</Text>
                <Text style={{ fontSize: 11, color: "#999" }}>{courseTitle}</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: "700", color: "#999" }}>{index + 1}/{cards.length}</Text>
            </View>

            <View style={{ height: 5, backgroundColor: "#e5e7eb" }}>
              <View style={{ height: 5, backgroundColor: PRIMARY, width: `${progress}%` }} />
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              <Animated.View style={{ transform: [{ translateX: slideX }] }}>
                <FlipCard card={cards[index]} flipped={flipped} onFlip={() => setFlipped((f) => !f)} />
              </Animated.View>

              {flipped ? (
                <>
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#999", textAlign: "center", marginTop: 8 }}>
                    How well did you know this?
                  </Text>
                  <RatingButtons onRate={handleRate} />
                </>
              ) : (
                <TouchableOpacity onPress={() => setFlipped(true)}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16, padding: 16, backgroundColor: PRIMARY + "15", borderRadius: 16, borderWidth: 1.5, borderColor: PRIMARY + "30" }}>
                  <Ionicons name="sync-outline" size={18} color={PRIMARY} />
                  <Text style={{ fontSize: 15, fontWeight: "700", color: PRIMARY }}>Show Answer</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function FlashcardsLibrary() {
  const router = useRouter();
  const [courses,     setCourses]     = useState<CourseGroup[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [dueCount,    setDueCount]    = useState(0);
  const [expandedCourse,  setExpandedCourse]  = useState<string | null>(null);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);

  // Review modal state
  const [reviewCards,   setReviewCards]   = useState<Card[]>([]);
  const [reviewTitle,   setReviewTitle]   = useState({ course: "", chapter: "" });
  const [reviewVisible, setReviewVisible] = useState(false);

  const load = async () => {
    try {
      const [libRes, dueRes] = await Promise.all([
        apiGetAllFlashcards(),
        apiGetFlashcardsDue(undefined, 1),
      ]);
      setCourses(libRes.data || []);
      setDueCount(dueRes.totalDue || 0);

      // Auto-expand the first course
      if (libRes.data?.length > 0 && !expandedCourse) {
        setExpandedCourse(libRes.data[0].courseId);
      }
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, []));

  const onRefresh = () => { setRefreshing(true); load(); };

  const startReview = (cards: Card[], courseTitle: string, chapterTitle: string) => {
    setReviewCards(cards);
    setReviewTitle({ course: courseTitle, chapter: chapterTitle });
    setReviewVisible(true);
  };

  const totalCards = courses.reduce((sum, c) => sum + c.chapters.reduce((s, ch) => s + ch.cards.length, 0), 0);

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={{ marginTop: 12, color: "#666" }}>Loading flashcards…</Text>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Flashcards 🃏</Text>
          <Text style={s.headerSub}>{totalCards} cards across {courses.length} courses</Text>
        </View>
        {dueCount > 0 && (
          <TouchableOpacity
            style={s.dueBtn}
            onPress={() => router.push({ pathname: "/(tabs)/flashcard-review" } as any)}
          >
            <Text style={s.dueBtnText}>{dueCount} due</Text>
            <Ionicons name="arrow-forward" size={14} color="white" />
          </TouchableOpacity>
        )}
      </View>

      {/* Stats bar */}
      <View style={s.statsRow}>
        <View style={s.statCard}>
          <Text style={[s.statNum, { color: PRIMARY }]}>{totalCards}</Text>
          <Text style={s.statLabel}>Total Cards</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statNum, { color: "#f97316" }]}>{dueCount}</Text>
          <Text style={s.statLabel}>Due Today</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statNum, { color: "#8b5cf6" }]}>{courses.length}</Text>
          <Text style={s.statLabel}>Courses</Text>
        </View>
        <View style={s.statCard}>
          <Text style={[s.statNum, { color: "#3b82f6" }]}>
            {courses.reduce((sum, c) => sum + c.chapters.length, 0)}
          </Text>
          <Text style={s.statLabel}>Chapters</Text>
        </View>
      </View>

      {courses.length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Text style={{ fontSize: 64, marginBottom: 16 }}>🃏</Text>
          <Text style={{ fontSize: 20, fontWeight: "bold", color: "#333", marginBottom: 8 }}>No flashcards yet</Text>
          <Text style={{ color: "#999", textAlign: "center", lineHeight: 22 }}>
            Complete a chapter in any course and flashcards will be automatically generated for you.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
        >
          {courses.map((course) => {
            const isExpanded = expandedCourse === course.courseId;
            const courseDue  = course.chapters.reduce((sum, ch) =>
              sum + ch.cards.filter((c) => new Date(c.next_review_at) <= new Date()).length, 0);
            const courseTotal = course.chapters.reduce((sum, ch) => sum + ch.cards.length, 0);

            return (
              <View key={course.courseId} style={s.courseBlock}>
                {/* Course header */}
                <TouchableOpacity
                  style={s.courseHeader}
                  onPress={() => setExpandedCourse(isExpanded ? null : course.courseId)}
                  activeOpacity={0.8}
                >
                  <View style={s.courseIconBox}>
                    <Ionicons name="sparkles" size={20} color={PRIMARY} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.courseTitle} numberOfLines={1}>{course.courseTitle}</Text>
                    <Text style={s.courseSub}>{courseTotal} cards · {course.chapters.length} chapters</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {courseDue > 0 && (
                      <View style={s.duePill}>
                        <Text style={s.duePillText}>{courseDue} due</Text>
                      </View>
                    )}
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={18} color="#999"
                    />
                  </View>
                </TouchableOpacity>

                {isExpanded && (
                  <View style={s.chaptersContainer}>
                    {course.chapters.map((chapter) => {
                      const chapterKey    = `${course.courseId}-${chapter.chapterId}`;
                      const isChExpanded  = expandedChapter === chapterKey;
                      const chDue         = chapter.cards.filter((c) => new Date(c.next_review_at) <= new Date()).length;
                      const chTotal       = chapter.cards.length;
                      const avgAccuracy   = chapter.cards.filter((c) => c.total_reviews > 0).length > 0
                        ? Math.round(
                            chapter.cards.filter((c) => c.total_reviews > 0)
                              .reduce((sum, c) => sum + (c.correct_reviews / c.total_reviews) * 100, 0) /
                            chapter.cards.filter((c) => c.total_reviews > 0).length
                          )
                        : null;

                      return (
                        <View key={chapter.chapterId} style={s.chapterBlock}>
                          {/* Chapter header */}
                          <TouchableOpacity
                            style={s.chapterHeader}
                            onPress={() => setExpandedChapter(isChExpanded ? null : chapterKey)}
                            activeOpacity={0.8}
                          >
                            <View style={s.chapterNum}>
                              <Text style={s.chapterNumText}>{chapter.orderIndex}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={s.chapterTitle} numberOfLines={1}>{chapter.chapterTitle}</Text>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
                                <Text style={s.chapterSub}>{chTotal} cards</Text>
                                {avgAccuracy !== null && (
                                  <Text style={s.chapterSub}>· {avgAccuracy}% avg accuracy</Text>
                                )}
                              </View>
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                              {chDue > 0 && (
                                <View style={[s.duePill, { backgroundColor: "#fff7ed" }]}>
                                  <Text style={[s.duePillText, { color: "#f97316" }]}>{chDue} due</Text>
                                </View>
                              )}
                              {/* Review button */}
                              <TouchableOpacity
                                style={s.reviewBtn}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  startReview(chapter.cards, course.courseTitle, chapter.chapterTitle);
                                }}
                              >
                                <Ionicons name="play" size={12} color="white" />
                              </TouchableOpacity>
                              <Ionicons
                                name={isChExpanded ? "chevron-up" : "chevron-down"}
                                size={16} color="#ccc"
                              />
                            </View>
                          </TouchableOpacity>

                          {/* Cards list */}
                          {isChExpanded && (
                            <View style={s.cardsList}>
                              {chapter.cards.map((card) => {
                                const isDue = new Date(card.next_review_at) <= new Date();
                                const typeColor: Record<string,string> = { qa: "#3b82f6", term: "#8b5cf6", concept: "#f97316" };
                                const typeLabel: Record<string,string> = { qa: "Q&A", term: "Term", concept: "Concept" };
                                const color = typeColor[card.card_type] || "#3b82f6";

                                return (
                                  <View key={card.id} style={s.cardRow}>
                                    <View style={{ flex: 1 }}>
                                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                        <View style={[s.typeTag, { backgroundColor: color + "15" }]}>
                                          <Text style={[s.typeTagText, { color }]}>{typeLabel[card.card_type] || "Q&A"}</Text>
                                        </View>
                                        {isDue && (
                                          <View style={[s.typeTag, { backgroundColor: "#fef3c7" }]}>
                                            <Text style={[s.typeTagText, { color: "#d97706" }]}>Due</Text>
                                          </View>
                                        )}
                                      </View>
                                      <Text style={s.cardFront} numberOfLines={2}>{card.front}</Text>
                                      <Text style={s.cardBack} numberOfLines={2}>{card.back}</Text>
                                    </View>
                                    <View style={s.cardStats}>
                                      {card.total_reviews > 0 ? (
                                        <>
                                          <Text style={s.cardStatNum}>{card.total_reviews}×</Text>
                                          <Text style={s.cardStatSub}>reviewed</Text>
                                          <Text style={[s.cardStatNum, { color: "#22c55e", marginTop: 4 }]}>
                                            {Math.round((card.correct_reviews / card.total_reviews) * 100)}%
                                          </Text>
                                        </>
                                      ) : (
                                        <Text style={s.cardStatSub}>New</Text>
                                      )}
                                    </View>
                                  </View>
                                );
                              })}

                              {/* Start review button at bottom of chapter */}
                              <TouchableOpacity
                                style={s.startReviewBtn}
                                onPress={() => startReview(chapter.cards, course.courseTitle, chapter.chapterTitle)}
                              >
                                <Ionicons name="play-circle" size={18} color="white" />
                                <Text style={s.startReviewBtnText}>
                                  Review all {chTotal} cards
                                  {chDue > 0 ? ` (${chDue} due)` : ""}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })}

                    {/* Review all cards in course */}
                    <TouchableOpacity
                      style={[s.startReviewBtn, { margin: 12, marginTop: 4, backgroundColor: "#8b5cf6" }]}
                      onPress={() => startReview(
                        course.chapters.flatMap((ch) => ch.cards),
                        course.courseTitle, "All chapters"
                      )}
                    >
                      <Ionicons name="albums" size={18} color="white" />
                      <Text style={s.startReviewBtnText}>Review entire course ({courseTotal} cards)</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Review Modal */}
      <ReviewModal
        visible={reviewVisible}
        cards={reviewCards}
        courseTitle={reviewTitle.course}
        chapterTitle={reviewTitle.chapter}
        onClose={(xp, correct) => {
          setReviewVisible(false);
          // Refresh due count after review
          apiGetFlashcardsDue(undefined, 1)
            .then((r) => setDueCount(r.totalDue || 0))
            .catch(() => {});
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 20, backgroundColor: "white" },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#333" },
  headerSub:   { fontSize: 12, color: "#999", marginTop: 2 },
  dueBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#f97316", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  dueBtnText: { color: "white", fontWeight: "700", fontSize: 13 },
  statsRow: { flexDirection: "row", backgroundColor: "white", marginHorizontal: 16, marginBottom: 16, borderRadius: 16, padding: 16, marginTop: 8 },
  statCard: { flex: 1, alignItems: "center" },
  statNum:  { fontSize: 20, fontWeight: "800" },
  statLabel:{ fontSize: 10, color: "#999", marginTop: 2 },
  courseBlock: { backgroundColor: "white", borderRadius: 18, marginBottom: 12, overflow: "hidden" },
  courseHeader: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  courseIconBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: PRIMARY + "15", alignItems: "center", justifyContent: "center" },
  courseTitle: { fontSize: 15, fontWeight: "700", color: "#333" },
  courseSub:   { fontSize: 11, color: "#999", marginTop: 2 },
  duePill: { backgroundColor: PRIMARY + "20", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  duePillText: { fontSize: 10, fontWeight: "700", color: PRIMARY },
  chaptersContainer: { borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  chapterBlock: { borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  chapterHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, gap: 12, backgroundColor: "#fafafa" },
  chapterNum: { width: 28, height: 28, borderRadius: 8, backgroundColor: "#e5e7eb", alignItems: "center", justifyContent: "center" },
  chapterNumText: { fontSize: 12, fontWeight: "700", color: "#666" },
  chapterTitle: { fontSize: 13, fontWeight: "700", color: "#333" },
  chapterSub:   { fontSize: 11, color: "#999" },
  reviewBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" },
  cardsList: { paddingHorizontal: 16, paddingBottom: 8 },
  cardRow: { flexDirection: "row", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", gap: 12 },
  typeTag: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  typeTagText: { fontSize: 10, fontWeight: "700" },
  cardFront: { fontSize: 13, fontWeight: "600", color: "#333", lineHeight: 18, marginBottom: 3 },
  cardBack:  { fontSize: 12, color: "#777", lineHeight: 17 },
  cardStats: { alignItems: "center", justifyContent: "center", minWidth: 44 },
  cardStatNum: { fontSize: 13, fontWeight: "700", color: "#666" },
  cardStatSub: { fontSize: 10, color: "#bbb" },
  startReviewBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 12, marginTop: 8, marginBottom: 8 },
  startReviewBtnText: { color: "white", fontWeight: "700", fontSize: 13 },
});

