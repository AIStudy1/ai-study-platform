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
import { Ionicons } from "@expo/vector-icons";
import { apiSubmitEntryQuiz } from "@/services/api";

const PRIMARY = "#9cd21f";

export type EntryQuestion = {
  question: string;
  options: string[];
  answer: string;
};

type Props = {
  courseId: string;
  title: string;
  questions: EntryQuestion[];
  onPassed: () => void;
};

export default function EntryQuizGate({ courseId, title, questions, onPassed }: Props) {
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const toggle = (qIndex: number, option: string) => {
    setSelected((prev) => ({ ...prev, [qIndex]: option }));
  };

  const submit = async () => {
    const missing = questions.findIndex((_, i) => !selected[i]?.trim());
    if (missing !== -1) {
      Alert.alert("Almost there", `Please answer question ${missing + 1}.`);
      return;
    }
    const answers = questions.map((_, i) => selected[i]);
    setSubmitting(true);
    try {
      const res = await apiSubmitEntryQuiz(courseId, answers);
      const { passed, score, energy } = res.data as {
        passed: boolean;
        score: number;
        energy?: number;
      };
      if (passed) {
        Alert.alert("Great job!", `You scored ${score}%. Chapters are now unlocked.`, [
          { text: "Continue", onPress: onPassed },
        ]);
      } else {
        Alert.alert(
          "Not quite yet",
          `Score: ${score}%. You need 60% to continue.${energy != null ? ` Energy: ${energy}` : ""}`,
          [{ text: "Try again", onPress: () => setSelected({}) }]
        );
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not submit placement quiz.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.banner}>
        <Ionicons name="school" size={28} color={PRIMARY} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Placement quiz</Text>
          <Text style={styles.bannerSub}>
            {title}. Pass with 60%+ to unlock all chapters (Duolingo-style: a failed attempt costs 1 energy).
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner}>
        {questions.map((q, qi) => (
          <View key={qi} style={styles.card}>
            <Text style={styles.qIndex}>Question {qi + 1}</Text>
            <Text style={styles.qText}>{q.question}</Text>
            {(q.options || []).map((opt) => {
              const picked = selected[qi] === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[styles.opt, picked && styles.optPicked]}
                  onPress={() => toggle(qi, opt)}
                >
                  <View style={[styles.radio, picked && styles.radioOn]} />
                  <Text style={styles.optText}>{opt}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={[styles.cta, submitting && { opacity: 0.6 }]}
        onPress={submit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.ctaText}>Submit placement quiz</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#f7f8f6" },
  banner: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    alignItems: "flex-start",
  },
  bannerTitle: { fontSize: 17, fontWeight: "bold", color: "#333" },
  bannerSub: { fontSize: 13, color: "#666", marginTop: 4, lineHeight: 18 },
  scroll: { flex: 1 },
  scrollInner: { padding: 16, paddingBottom: 24 },
  card: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
  },
  qIndex: { fontSize: 12, color: PRIMARY, fontWeight: "bold", marginBottom: 6 },
  qText: { fontSize: 15, color: "#333", fontWeight: "600", marginBottom: 12, lineHeight: 22 },
  opt: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
    backgroundColor: "#f9fafb",
  },
  optPicked: { backgroundColor: PRIMARY + "18", borderWidth: 1, borderColor: PRIMARY },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#ccc",
    marginRight: 10,
  },
  radioOn: { borderColor: PRIMARY, backgroundColor: PRIMARY },
  optText: { flex: 1, fontSize: 14, color: "#333" },
  cta: {
    margin: 16,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: "center",
  },
  ctaText: { color: "white", fontWeight: "bold", fontSize: 16 },
});
