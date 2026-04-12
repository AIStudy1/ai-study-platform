import React, { useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { apiSubmitQuiz } from "@/services/api";

const PRIMARY = "#9cd21f";

export type ChapterQuizQuestion = {
  question: string;
  options: string[];
  answer: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  courseId: string;
  quizId: string;
  chapterTitle: string;
  questions: ChapterQuizQuestion[];
  onGraded: (payload: {
    score: number;
    passed: boolean;
    energy?: number;
    course_xp?: number;
    course_level?: number;
  }) => void;
};

export default function ChapterQuizModal({
  visible,
  onClose,
  courseId,
  quizId,
  chapterTitle,
  questions,
  onGraded,
}: Props) {
  const [selected, setSelected] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const reset = () => setSelected({});

  const handleClose = () => {
    reset();
    onClose();
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
      const res = await apiSubmitQuiz(courseId, quizId, { answers });
      const data = res.data as {
        score: number;
        passed: boolean;
        energy?: number;
        course_xp?: number;
        course_level?: number;
      };
      onGraded(data);
      handleClose();
      Alert.alert(
        data.passed ? "Quiz passed" : "Keep trying",
        data.passed
          ? `Score: ${data.score}% — +50 XP · +40 course XP${data.energy != null ? ` · Energy ${data.energy}` : ""}`
          : `Score: ${data.score}% — Need 60% to pass.${data.energy != null ? ` Energy: ${data.energy}` : ""}`
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not submit quiz.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible || questions.length === 0) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.iconBtn}>
            <Ionicons name="close" size={22} color="#333" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Chapter quiz
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {chapterTitle}
            </Text>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollInner}>
          <Text style={styles.hint}>Answer all questions. Pass at 60% or higher.</Text>
          {questions.map((q, qi) => (
            <View key={qi} style={styles.card}>
              <Text style={styles.qLabel}>Q{qi + 1}</Text>
              <Text style={styles.qText}>{q.question}</Text>
              {(q.options || []).map((opt) => {
                const picked = selected[qi] === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.opt, picked && styles.optPicked]}
                    onPress={() => setSelected((prev) => ({ ...prev, [qi]: opt }))}
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
            <Text style={styles.ctaText}>Submit answers</Text>
          )}
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f8f6" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    gap: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "bold", color: "#333" },
  headerSub: { fontSize: 13, color: "#888", marginTop: 2 },
  scroll: { flex: 1 },
  scrollInner: { padding: 16, paddingBottom: 24 },
  hint: { fontSize: 13, color: "#666", marginBottom: 12 },
  card: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    elevation: 1,
  },
  qLabel: { fontSize: 12, color: PRIMARY, fontWeight: "bold", marginBottom: 6 },
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
