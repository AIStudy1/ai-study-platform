import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { apiGetFlashcardsDue, apiReviewFlashcard, apiCompleteReviewSession, apiRecordStudyActivity } from "@/services/api";

const PRIMARY = "#9cd21f";

interface Flashcard {
  id: string; front: string; back: string; card_type: string;
  interval_days: number; total_reviews: number; correct_reviews: number;
  chapters?: { title: string }; ai_courses?: { title: string };
}

// ─── Flip card ────────────────────────────────────────────────────────────────
function FlipCard({
  card, onFlip, flipped,
}: {
  card: Flashcard; onFlip: () => void; flipped: boolean;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: flipped ? 1 : 0,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [flipped]);

  const frontRotate = anim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const backRotate  = anim.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });
  const frontOpacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0, 0] });
  const backOpacity  = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] });

  const cardTypeMeta: Record<string, { label: string; color: string }> = {
    qa:              { label: "Q&A",        color: "#3b82f6" },
    term:            { label: "Term",       color: "#8b5cf6" },
    term_definition: { label: "Definition", color: "#8b5cf6" },
    concept:         { label: "Concept",    color: "#f97316" },
  };
  const meta = cardTypeMeta[card.card_type] || cardTypeMeta.qa;

  return (
    <TouchableOpacity onPress={onFlip} activeOpacity={0.95} style={fc.container}>
      {/* Front */}
      <Animated.View style={[fc.card, fc.front, { transform: [{ rotateY: frontRotate }], opacity: frontOpacity }]}>
        <View style={[fc.typeBadge, { backgroundColor: meta.color + "15" }]}>
          <Text style={[fc.typeLabel, { color: meta.color }]}>{meta.label}</Text>
        </View>
        {card.chapters?.title && (
          <Text style={fc.chapterLabel}>{card.chapters.title}</Text>
        )}
        <Text style={fc.frontText}>{card.front}</Text>
        <View style={fc.tapHint}>
          <Ionicons name="sync-outline" size={16} color="#ccc" />
          <Text style={fc.tapHintText}>Tap to reveal answer</Text>
        </View>
      </Animated.View>

      {/* Back */}
      <Animated.View style={[fc.card, fc.back, { transform: [{ rotateY: backRotate }], opacity: backOpacity }]}>
        <View style={[fc.typeBadge, { backgroundColor: PRIMARY + "15" }]}>
          <Text style={[fc.typeLabel, { color: PRIMARY }]}>Answer</Text>
        </View>
        <Text style={fc.backText}>{card.back}</Text>
        {card.total_reviews > 0 && (
          <Text style={fc.reviewInfo}>
            Reviewed {card.total_reviews}× · {Math.round((card.correct_reviews / card.total_reviews) * 100)}% correct
          </Text>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}
const fc = StyleSheet.create({
  container: { height: 320 },
  card: { position: "absolute", width: "100%", height: "100%", backgroundColor: "white", borderRadius: 24, padding: 28, elevation: 4, backfaceVisibility: "hidden", alignItems: "center", justifyContent: "center" },
  front: { borderWidth: 1.5, borderColor: "#e5e7eb" },
  back:  { borderWidth: 2, borderColor: PRIMARY, backgroundColor: "#f0f9e8" },
  typeBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginBottom: 16 },
  typeLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  chapterLabel: { fontSize: 12, color: "#999", marginBottom: 8 },
  frontText: { fontSize: 20, fontWeight: "700", color: "#333", textAlign: "center", lineHeight: 28 },
  backText: { fontSize: 16, color: "#444", textAlign: "center", lineHeight: 24 },
  tapHint: { flexDirection: "row", alignItems: "center", gap: 4, position: "absolute", bottom: 20 },
  tapHintText: { fontSize: 12, color: "#ccc" },
  reviewInfo: { fontSize: 11, color: "#bbb", position: "absolute", bottom: 20 },
});

// ─── Rating buttons ───────────────────────────────────────────────────────────
function RatingButtons({ onRate }: { onRate: (rating: number) => void }) {
  const ratings = [
    { rating: 1, label: "Again",  emoji: "😟", color: "#ef4444", bg: "#fef2f2" },
    { rating: 2, label: "Hard",   emoji: "😅", color: "#f97316", bg: "#fff7ed" },
    { rating: 4, label: "Good",   emoji: "😊", color: "#3b82f6", bg: "#eff6ff" },
    { rating: 5, label: "Easy",   emoji: "🚀", color: PRIMARY,   bg: "#f0f9e8" },
  ];
  return (
    <View style={rb.row}>
      {ratings.map((r) => (
        <TouchableOpacity
          key={r.rating}
          style={[rb.btn, { backgroundColor: r.bg, borderColor: r.color + "40" }]}
          onPress={() => onRate(r.rating)}
          activeOpacity={0.8}
        >
          <Text style={rb.emoji}>{r.emoji}</Text>
          <Text style={[rb.label, { color: r.color }]}>{r.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const rb = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  btn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 16, borderWidth: 1.5 },
  emoji: { fontSize: 20, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: "700" },
});

// ─── Session complete screen ──────────────────────────────────────────────────
function SessionComplete({
  total, correct, xpEarned, onDone,
}: { total: number; correct: number; xpEarned: number; onDone: () => void }) {
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <View style={sc.container}>
      <Text style={sc.trophy}>🎉</Text>
      <Text style={sc.title}>Session Complete!</Text>
      <View style={sc.statsRow}>
        <View style={sc.stat}>
          <Text style={[sc.statNum, { color: PRIMARY }]}>{total}</Text>
          <Text style={sc.statLabel}>Cards reviewed</Text>
        </View>
        <View style={sc.stat}>
          <Text style={[sc.statNum, { color: "#22c55e" }]}>{correct}</Text>
          <Text style={sc.statLabel}>Correct</Text>
        </View>
        <View style={sc.stat}>
          <Text style={[sc.statNum, { color: "#8b5cf6" }]}>{accuracy}%</Text>
          <Text style={sc.statLabel}>Accuracy</Text>
        </View>
      </View>
      {xpEarned > 0 && (
        <View style={sc.xpBadge}>
          <Text style={sc.xpText}>+{xpEarned} XP earned! ⚡</Text>
        </View>
      )}
      <TouchableOpacity style={sc.doneBtn} onPress={onDone}>
        <Text style={sc.doneBtnText}>Back to Dashboard</Text>
      </TouchableOpacity>
    </View>
  );
}
const sc = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  trophy: { fontSize: 72, marginBottom: 16 },
  title: { fontSize: 26, fontWeight: "900", color: "#333", marginBottom: 32 },
  statsRow: { flexDirection: "row", gap: 20, marginBottom: 24 },
  stat: { alignItems: "center" },
  statNum: { fontSize: 32, fontWeight: "900" },
  statLabel: { fontSize: 12, color: "#999", marginTop: 4 },
  xpBadge: { backgroundColor: PRIMARY + "15", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginBottom: 32, borderWidth: 1, borderColor: PRIMARY + "30" },
  xpText: { fontSize: 16, fontWeight: "700", color: PRIMARY },
  doneBtn: { backgroundColor: PRIMARY, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16, width: "100%" },
  doneBtnText: { color: "white", fontWeight: "bold", fontSize: 16, textAlign: "center" },
});

// ─── Main review screen ───────────────────────────────────────────────────────
export default function FlashcardReview() {
  const router = useRouter();
  const { courseId } = useLocalSearchParams<{ courseId?: string }>();

  const [cards, setCards]           = useState<Flashcard[]>([]);
  const [index, setIndex]           = useState(0);
  const [flipped, setFlipped]       = useState(false);
  const [loading, setLoading]       = useState(true);
  const [done, setDone]             = useState(false);
  const [correct, setCorrect]       = useState(0);
  const [xpEarned, setXpEarned]     = useState(0);

  // Slide-in animation
  const slideX = useRef(new Animated.Value(0)).current;

  useEffect(() => { loadCards(); }, []);

  const loadCards = async () => {
    setLoading(true);
    try {
      const res = await apiGetFlashcardsDue(courseId, 30);
      setCards(res.data || []);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const animateNext = (direction: "left" | "right", then: () => void) => {
    Animated.sequence([
      Animated.timing(slideX, { toValue: direction === "left" ? -400 : 400, duration: 200, useNativeDriver: true }),
      Animated.timing(slideX, { toValue: direction === "left" ? 400 : -400, duration: 0, useNativeDriver: true }),
    ]).start(() => {
      then();
      setFlipped(false);
      Animated.timing(slideX, { toValue: 0, duration: 200, useNativeDriver: true }).start();
    });
  };

  const handleRate = async (rating: number) => {
    const card = cards[index];
    let xpGain = 0;
    try {
      const res = await apiReviewFlashcard(card.id, rating);
      xpGain = res.data.xpGained || 0;
      setXpEarned((x) => x + xpGain);
    } catch {}

    if (rating >= 4) setCorrect((c) => c + 1);

    const nextIndex = index + 1;
    if (nextIndex >= cards.length) {
      // Session done
      try {
        await apiCompleteReviewSession(cards.length, correct + (rating >= 4 ? 1 : 0));
        await apiRecordStudyActivity("flashcard", xpEarned + xpGain);
      } catch {}
      setDone(true);
    } else {
      animateNext("left", () => setIndex(nextIndex));
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={{ marginTop: 12, color: "#666" }}>Loading flashcards…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (cards.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
        <View style={ms.header}>
          <TouchableOpacity onPress={() => router.back()} style={ms.backBtn}>
            <Ionicons name="arrow-back" size={20} color="#333" />
          </TouchableOpacity>
          <Text style={ms.headerTitle}>Flashcards</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <Text style={{ fontSize: 64 }}>✅</Text>
          <Text style={{ fontSize: 22, fontWeight: "bold", color: "#333", marginTop: 16 }}>All caught up!</Text>
          <Text style={{ color: "#999", textAlign: "center", marginTop: 8, lineHeight: 22 }}>
            No cards due for review right now. Come back later or complete more chapters to generate new cards.
          </Text>
          <TouchableOpacity style={[ms.backBtn, { width: "100%", marginTop: 32, borderRadius: 14, height: 52, backgroundColor: PRIMARY }]} onPress={() => router.back()}>
            <Text style={{ color: "white", fontWeight: "bold", fontSize: 16 }}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (done) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
        <SessionComplete
          total={cards.length}
          correct={correct}
          xpEarned={xpEarned}
          onDone={() => router.replace("/(tabs)/dashboard" as any)}
        />
      </SafeAreaView>
    );
  }

  const card = cards[index];
  const progress = (index / cards.length) * 100;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      {/* Header */}
      <View style={ms.header}>
        <TouchableOpacity onPress={() => router.back()} style={ms.backBtn}>
          <Ionicons name="close" size={20} color="#333" />
        </TouchableOpacity>
        <Text style={ms.headerTitle}>Review</Text>
        <Text style={ms.counter}>{index + 1}/{cards.length}</Text>
      </View>

      {/* Progress bar */}
      <View style={ms.progressBg}>
        <View style={[ms.progressFill, { width: `${progress}%` }]} />
      </View>

      <ScrollView contentContainerStyle={ms.body}>
        {/* Card */}
        <Animated.View style={{ transform: [{ translateX: slideX }] }}>
          <FlipCard
            card={card}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
          />
        </Animated.View>

        {/* Rating buttons — shown after flip */}
        {flipped ? (
          <View style={{ marginTop: 24 }}>
            <Text style={ms.ratingLabel}>How well did you know this?</Text>
            <RatingButtons onRate={handleRate} />
          </View>
        ) : (
          <TouchableOpacity style={ms.flipBtn} onPress={() => setFlipped(true)}>
            <Ionicons name="sync-outline" size={18} color={PRIMARY} />
            <Text style={ms.flipBtnText}>Show Answer</Text>
          </TouchableOpacity>
        )}

        {/* Card info */}
        <View style={ms.infoRow}>
          {card.total_reviews > 0 && (
            <Text style={ms.infoText}>
              Reviewed {card.total_reviews}× · next in {card.interval_days}d
            </Text>
          )}
          {card.ai_courses?.title && (
            <Text style={ms.infoText}>📚 {card.ai_courses.title}</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const ms = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "white" },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
  counter: { fontSize: 14, fontWeight: "700", color: "#999", minWidth: 40, textAlign: "right" },
  progressBg: { height: 6, backgroundColor: "#e5e7eb" },
  progressFill: { height: 6, backgroundColor: PRIMARY, borderRadius: 3 },
  body: { padding: 20, paddingBottom: 60 },
  ratingLabel: { fontSize: 14, fontWeight: "600", color: "#666", textAlign: "center", marginBottom: 12 },
  flipBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20, padding: 16, backgroundColor: PRIMARY + "15", borderRadius: 16, borderWidth: 1.5, borderColor: PRIMARY + "30" },
  flipBtnText: { fontSize: 15, fontWeight: "700", color: PRIMARY },
  infoRow: { marginTop: 16, gap: 4, alignItems: "center" },
  infoText: { fontSize: 11, color: "#ccc" },
});
