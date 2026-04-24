import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  apiGetTasks, apiCreateTask, apiCompleteTask,
  apiDeleteTask, apiGenerateTasksWithAI,
} from "@/services/api";

const PRIMARY = "#9cd21f";

const TYPE_META: Record<string, { icon: string; color: string; bg: string }> = {
  study:    { icon: "📚", color: "#3b82f6", bg: "#eff6ff" },
  revision: { icon: "🔁", color: "#8b5cf6", bg: "#f5f3ff" },
  quiz:     { icon: "📝", color: "#f97316", bg: "#fff7ed" },
  reading:  { icon: "📖", color: "#22c55e", bg: "#f0fdf4" },
  practice: { icon: "💪", color: "#ef4444", bg: "#fef2f2" },
  general:  { icon: "✅", color: "#6b7280", bg: "#f3f4f6" },
};

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  type: string;
  notes: string | null;
  is_done: boolean;
  completed_at: string | null;
}

type FilterType = "all" | "today" | "done";

export default function Planner() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");

  // Add task modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newType, setNewType] = useState("study");
  const [newNotes, setNewNotes] = useState("");
  const [adding, setAdding] = useState(false);

  // AI generate modal
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiGoal, setAiGoal] = useState("");
  const [aiDays, setAiDays] = useState("7");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await apiGetTasks(filter);
      setTasks(res.data || []);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async (task: Task) => {
    try {
      await apiCompleteTask(task.id);
      setTasks((prev) =>
        prev.map((t) => t.id === task.id ? { ...t, is_done: true } : t)
      );
      if (filter !== "done") {
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const handleDelete = (task: Task) => {
    Alert.alert("Delete task", `Delete "${task.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          try {
            await apiDeleteTask(task.id);
            setTasks((prev) => prev.filter((t) => t.id !== task.id));
          } catch (e: any) {
            Alert.alert("Error", e.message);
          }
        },
      },
    ]);
  };

  const handleAddTask = async () => {
    if (!newTitle.trim()) {
      Alert.alert("Error", "Please enter a task title");
      return;
    }
    setAdding(true);
    try {
      const res = await apiCreateTask({
        title: newTitle.trim(),
        due_date: newDate || undefined,
        type: newType,
        notes: newNotes || undefined,
      });
      setTasks((prev) => [res.data, ...prev]);
      setAddModalVisible(false);
      setNewTitle("");
      setNewDate("");
      setNewType("study");
      setNewNotes("");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setAdding(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiGoal.trim()) {
      Alert.alert("Error", "Please enter your study goal");
      return;
    }
    setAiLoading(true);
    try {
      const res = await apiGenerateTasksWithAI(aiGoal.trim(), parseInt(aiDays) || 7);
      Alert.alert("✅ Done!", res.message);
      setAiModalVisible(false);
      setAiGoal("");
      setAiDays("7");
      fetchTasks();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  const isOverdue = (task: Task) =>
    task.due_date && task.due_date < todayStr && !task.is_done;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📅 Planner</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TouchableOpacity
            style={styles.aiBtn}
            onPress={() => setAiModalVisible(true)}
          >
            <Ionicons name="sparkles" size={16} color={PRIMARY} />
            <Text style={styles.aiBtnText}>AI Plan</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setAddModalVisible(true)}
          >
            <Ionicons name="add" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterRow}>
        {(["all", "today", "done"] as FilterType[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f === "all" ? "Pending" : f === "today" ? "Today" : "Done"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tasks list */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📭</Text>
          <Text style={styles.emptyText}>
            {filter === "done" ? "No completed tasks yet" : "No tasks — add one or let AI plan for you!"}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {tasks.map((task) => {
            const meta = TYPE_META[task.type] || TYPE_META.general;
            return (
              <View key={task.id} style={[styles.taskCard, isOverdue(task) && styles.taskCardOverdue]}>
                {/* Complete button */}
                {!task.is_done && (
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => handleComplete(task)}
                  >
                    <Ionicons name="ellipse-outline" size={24} color="#ccc" />
                  </TouchableOpacity>
                )}
                {task.is_done && (
                  <View style={styles.checkbox}>
                    <Ionicons name="checkmark-circle" size={24} color={PRIMARY} />
                  </View>
                )}

                {/* Task info */}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.taskTitle, task.is_done && styles.taskTitleDone]}>
                    {task.title}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                    <View style={[styles.typeBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.typeBadgeText, { color: meta.color }]}>
                        {meta.icon} {task.type}
                      </Text>
                    </View>
                    {task.due_date && (
                      <Text style={[styles.dueDate, isOverdue(task) && { color: "#ef4444" }]}>
                        {isOverdue(task) ? "⚠️ " : "📅 "}
                        {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-GB", {
                          day: "2-digit", month: "short",
                        })}
                      </Text>
                    )}
                  </View>
                  {task.notes && (
                    <Text style={styles.taskNotes}>{task.notes}</Text>
                  )}
                </View>

                {/* Delete */}
                {!task.is_done && (
                  <TouchableOpacity onPress={() => handleDelete(task)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={18} color="#ccc" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ══ Add Task Modal ══════════════════════════════════════════════════ */}
      <Modal visible={addModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setAddModalVisible(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Task</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Review chapter 3"
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <Text style={styles.label}>Due Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder={todayStr}
              value={newDate}
              onChangeText={setNewDate}
            />

            <Text style={styles.label}>Type</Text>
            <View style={styles.typeRow}>
              {Object.keys(TYPE_META).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeChip, newType === t && { backgroundColor: PRIMARY }]}
                  onPress={() => setNewType(t)}
                >
                  <Text style={[styles.typeChipText, newType === t && { color: "white" }]}>
                    {TYPE_META[t].icon} {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="Any notes or context..."
              value={newNotes}
              onChangeText={setNewNotes}
              multiline
            />

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleAddTask}
              disabled={adding}
            >
              {adding
                ? <ActivityIndicator color="white" />
                : <Text style={styles.submitBtnText}>Add Task</Text>}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* ══ AI Generate Modal ══════════════════════════════════════════════ */}
      <Modal visible={aiModalVisible} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setAiModalVisible(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>✨ AI Study Plan</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <View style={styles.aiInfoBox}>
              <Ionicons name="sparkles" size={20} color={PRIMARY} />
              <Text style={styles.aiInfoText}>
                Tell the AI your study goal and it will generate a personalized task list based on your active courses.
              </Text>
            </View>

            <Text style={styles.label}>Your Goal *</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              placeholder="e.g. Prepare for my Python exam in 2 weeks"
              value={aiGoal}
              onChangeText={setAiGoal}
              multiline
            />

            <Text style={styles.label}>Number of Days</Text>
            <TextInput
              style={styles.input}
              placeholder="7"
              value={aiDays}
              onChangeText={setAiDays}
              keyboardType="numeric"
            />

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: "#8b5cf6" }]}
              onPress={handleAIGenerate}
              disabled={aiLoading}
            >
              {aiLoading ? (
                <>
                  <ActivityIndicator color="white" />
                  <Text style={styles.submitBtnText}>Generating...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="sparkles" size={18} color="white" />
                  <Text style={styles.submitBtnText}>Generate Plan</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "white", elevation: 2 },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },
  aiBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: PRIMARY + "20", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  aiBtnText: { color: PRIMARY, fontWeight: "bold", fontSize: 13 },
  addBtn: { backgroundColor: PRIMARY, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  filterRow: { flexDirection: "row", margin: 16, backgroundColor: "white", borderRadius: 12, padding: 4 },
  filterTab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  filterTabActive: { backgroundColor: PRIMARY },
  filterTabText: { fontWeight: "600", color: "#999", fontSize: 14 },
  filterTabTextActive: { color: "white" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  emptyText: { fontSize: 14, color: "#999", textAlign: "center", lineHeight: 22 },
  taskCard: { backgroundColor: "white", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10, elevation: 1 },
  taskCardOverdue: { borderLeftWidth: 3, borderLeftColor: "#ef4444" },
  checkbox: { marginTop: 2 },
  taskTitle: { fontSize: 15, fontWeight: "600", color: "#333" },
  taskTitleDone: { textDecorationLine: "line-through", color: "#999" },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  typeBadgeText: { fontSize: 11, fontWeight: "600" },
  dueDate: { fontSize: 11, color: "#999" },
  taskNotes: { fontSize: 12, color: "#999", marginTop: 6, lineHeight: 18 },
  deleteBtn: { padding: 4 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "white", elevation: 2 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 16, fontWeight: "bold", color: "#333" },
  label: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: "white", borderRadius: 12, padding: 14, fontSize: 14, color: "#333", borderWidth: 1, borderColor: "#e5e7eb" },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: "#f3f4f6" },
  typeChipText: { fontSize: 12, fontWeight: "600", color: "#555" },
  submitBtn: { backgroundColor: PRIMARY, borderRadius: 14, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 24 },
  submitBtnText: { color: "white", fontWeight: "bold", fontSize: 16 },
  aiInfoBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: PRIMARY + "15", borderRadius: 12, padding: 14, marginBottom: 8 },
  aiInfoText: { fontSize: 13, color: "#444", flex: 1, lineHeight: 20 },
});