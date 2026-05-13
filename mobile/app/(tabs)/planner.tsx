import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  apiGetTasks, apiCreateTask, apiCompleteTask, apiDeleteTask,
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

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newType, setNewType] = useState("general");
  const [newNotes, setNewNotes] = useState("");
  const [adding, setAdding] = useState(false);

  const todayStr = new Date().toISOString().split("T")[0];

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
      if (filter !== "done") {
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
      } else {
        setTasks((prev) =>
          prev.map((t) => t.id === task.id ? { ...t, is_done: true } : t)
        );
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
      Alert.alert("Error", "Please enter a title");
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
      setNewType("general");
      setNewNotes("");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setAdding(false);
    }
  };

  const isOverdue = (task: Task) =>
    task.due_date && task.due_date < todayStr && !task.is_done;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📅 Planner</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setAddModalVisible(true)}
        >
          <Ionicons name="add" size={22} color="white" />
        </TouchableOpacity>
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
            {filter === "done" ? "No completed tasks yet" : "No plans yet — tap + to add one!"}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          {tasks.map((task) => {
            const meta = TYPE_META[task.type] || TYPE_META.general;
            return (
              <View
                key={task.id}
                style={[styles.taskCard, isOverdue(task) && styles.taskCardOverdue]}
              >
                {/* Complete / done indicator */}
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => !task.is_done && handleComplete(task)}
                >
                  <Ionicons
                    name={task.is_done ? "checkmark-circle" : "ellipse-outline"}
                    size={24}
                    color={task.is_done ? PRIMARY : "#ccc"}
                  />
                </TouchableOpacity>

                {/* Task info */}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.taskTitle, task.is_done && styles.taskTitleDone]}>
                    {task.title}
                  </Text>
                  <View style={styles.taskMeta}>
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
            <Text style={styles.modalTitle}>New Plan</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={styles.label}>What do you want to learn? *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Learn ethics, Review chapter 3..."
              value={newTitle}
              onChangeText={setNewTitle}
              autoFocus
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
              placeholder="Any extra details..."
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
                : <Text style={styles.submitBtnText}>Save Plan</Text>}
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
  addBtn: { backgroundColor: PRIMARY, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
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
  taskMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" },
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
});