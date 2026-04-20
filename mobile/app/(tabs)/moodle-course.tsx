import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "@/supabaseConfig";
import { useAuth } from "@/context/AuthContext";
import { PomodoroFloatingPill, PomodoroHeaderButton } from "@/components/PomodoroTimer";
import { usePomodoro } from "@/context/PomodoroContext";

const PRIMARY = "#9cd21f";

interface Module {
  id: number;
  name: string;
  modname: string;
  modicon: string;
  url?: string;
  completion: number;
  completiondata?: { state: number };
}

interface Section {
  id: number;
  name: string;
  summary: string;
  modules: Module[];
}

export default function MoodleCourse() {
  const router = useRouter();
  const navigation = useNavigation();
  const { courseId, courseName } = useLocalSearchParams<{ courseId: string; courseName: string }>();
  const { user } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<number[]>([]);
  const [completionMap, setCompletionMap] = useState<Record<number, number>>({});

  // ── Pomodoro ──────────────────────────────────────────────────────────────
  const { settings: pomodoroSettings, start: pomodoroStart, state: pomodoroState } = usePomodoro();

  useEffect(() => {
    if (courseId) fetchCourseContent();
  }, [courseId]);

  const fetchCourseContent = async () => {
    try {
      setLoading(true);

      const { data: connection } = await supabase
        .from("moodle_connections")
        .select("moodle_url, moodle_token, moodle_userid")
        .eq("user_id", user?.id)
        .single();

      if (!connection) {
        Alert.alert("Error", "Moodle not connected");
        if (navigation && "canGoBack" in navigation && (navigation as any).canGoBack?.()) {
          (navigation as any).goBack?.();
        } else {
          router.replace("/(tabs)/moodle" as any);
        }
        return;
      }

      const { moodle_url, moodle_token, moodle_userid } = connection;

      const contentsUrl = `${moodle_url}/webservice/rest/server.php?wstoken=${moodle_token}&wsfunction=core_course_get_contents&moodlewsrestformat=json&courseid=${courseId}`;
      const contentsRes = await fetch(contentsUrl);
      const contentsData = await contentsRes.json();

      if (contentsData.exception) {
        Alert.alert("Error", contentsData.message || "Could not fetch course content");
        return;
      }

      setSections(contentsData);
      if (contentsData.length > 0) setExpandedSections([contentsData[0].id]);

      try {
        const completionUrl = `${moodle_url}/webservice/rest/server.php?wstoken=${moodle_token}&wsfunction=core_completion_get_activities_completion_status&moodlewsrestformat=json&courseid=${courseId}&userid=${moodle_userid}`;
        const completionRes = await fetch(completionUrl);
        const completionData = await completionRes.json();
        if (completionData.statuses) {
          const map: Record<number, number> = {};
          completionData.statuses.forEach((s: any) => { map[s.cmid] = s.state; });
          setCompletionMap(map);
        }
      } catch {
        console.log("Completion tracking not available");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Could not load course");
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (sectionId: number) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId]
    );
  };

  // Auto-start Pomodoro when user opens a module
  const handleModulePress = (mod: Module) => {
    if (mod.url) {
      Linking.openURL(mod.url);
      // Start Pomodoro if enabled and not already running
      if (pomodoroSettings.enabled && !pomodoroState.isRunning && pomodoroState.phase === "work") {
        pomodoroStart();
      }
    } else {
      Alert.alert(mod.name, "This resource has no direct link.");
    }
  };

  const getModuleIcon = (modname: string) => {
    switch (modname) {
      case "assign":   return { name: "document-text",     color: "#3b82f6" };
      case "quiz":     return { name: "help-circle",        color: "#8b5cf6" };
      case "resource": return { name: "document",           color: "#f97316" };
      case "url":      return { name: "link",               color: "#06b6d4" };
      case "folder":   return { name: "folder",             color: "#f59e0b" };
      case "forum":    return { name: "chatbubbles",        color: "#22c55e" };
      case "video":    return { name: "play-circle",        color: "#ef4444" };
      case "page":     return { name: "reader",             color: "#6366f1" };
      case "label":    return { name: "information-circle", color: "#999"    };
      default:         return { name: "cube",               color: "#9cd21f" };
    }
  };

  const getModuleTypeName = (modname: string) => {
    switch (modname) {
      case "assign":   return "Assignment";
      case "quiz":     return "Quiz";
      case "resource": return "File";
      case "url":      return "Link";
      case "folder":   return "Folder";
      case "forum":    return "Forum";
      case "page":     return "Page";
      case "label":    return "Label";
      default:         return modname;
    }
  };

  const getCompletionStatus = (moduleId: number) => {
    const state = completionMap[moduleId];
    if (state === 1) return "complete";
    if (state === 0) return "incomplete";
    return "unknown";
  };

  const getSectionProgress = (section: Section) => {
    const modules = section.modules.filter((m) => m.modname !== "label");
    if (modules.length === 0) return 0;
    const completed = modules.filter((m) => getCompletionStatus(m.id) === "complete").length;
    return Math.round((completed / modules.length) * 100);
  };

  const totalModules = sections.reduce(
    (acc, s) => acc + s.modules.filter((m) => m.modname !== "label").length, 0
  );
  const completedModules = sections.reduce(
    (acc, s) => acc + s.modules.filter(
      (m) => m.modname !== "label" && getCompletionStatus(m.id) === "complete"
    ).length, 0
  );
  const overallProgress = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (navigation && "canGoBack" in navigation && (navigation as any).canGoBack?.()) {
              (navigation as any).goBack?.();
            } else {
              router.replace("/(tabs)/moodle" as any);
            }
          }}
        >
          <Ionicons name="arrow-back" size={20} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{courseName || "Course"}</Text>
        {/* Pomodoro header button */}
        <PomodoroHeaderButton />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Loading course content...</Text>
        </View>
      ) : (
        <ScrollView style={styles.container}>
          {/* Pomodoro banner — shown when enabled but not started */}
          {pomodoroSettings.enabled && !pomodoroState.isRunning && (
            <TouchableOpacity
              style={styles.pomodoroBanner}
              onPress={pomodoroStart}
            >
              <Ionicons name="timer-outline" size={18} color={PRIMARY} />
              <Text style={styles.pomodoroBannerText}>
                Tap to start a {pomodoroSettings.workMinutes}-min Pomodoro session
              </Text>
              <Ionicons name="play-circle" size={22} color={PRIMARY} />
            </TouchableOpacity>
          )}

          {/* Progress Card */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.progressTitle}>Course Progress</Text>
                <Text style={styles.progressSubtitle}>
                  {completedModules}/{totalModules} activities completed
                </Text>
              </View>
              <Text style={styles.progressPercent}>{overallProgress}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${overallProgress}%` }]} />
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="layers-outline" size={16} color="#666" />
                <Text style={styles.statText}>{sections.length} sections</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#22c55e" />
                <Text style={styles.statText}>{completedModules} done</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="time-outline" size={16} color="#f97316" />
                <Text style={styles.statText}>{totalModules - completedModules} remaining</Text>
              </View>
            </View>
          </View>

          {/* Sections */}
          {sections.map((section) => {
            const isExpanded = expandedSections.includes(section.id);
            const sectionProgress = getSectionProgress(section);
            const visibleModules = section.modules.filter((m) => m.modname !== "label");
            if (visibleModules.length === 0 && !section.name) return null;

            return (
              <View key={section.id} style={styles.sectionContainer}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection(section.id)}
                >
                  <View style={styles.sectionLeft}>
                    <View style={[styles.sectionDot, { backgroundColor: sectionProgress === 100 ? PRIMARY : "#e5e7eb" }]}>
                      {sectionProgress === 100 && <Ionicons name="checkmark" size={12} color="white" />}
                    </View>
                    <View style={styles.sectionInfo}>
                      <Text style={styles.sectionName} numberOfLines={2}>
                        {section.name || `Section ${section.id}`}
                      </Text>
                      <Text style={styles.sectionMeta}>
                        {visibleModules.length} activities
                        {sectionProgress > 0 && ` • ${sectionProgress}% done`}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color="#999" />
                </TouchableOpacity>

                {visibleModules.length > 0 && (
                  <View style={styles.sectionProgressBg}>
                    <View style={[styles.sectionProgressFill, { width: `${sectionProgress}%` }]} />
                  </View>
                )}

                {isExpanded && (
                  <View style={styles.modulesContainer}>
                    {visibleModules.map((mod) => {
                      const icon = getModuleIcon(mod.modname);
                      const status = getCompletionStatus(mod.id);
                      return (
                        <TouchableOpacity
                          key={mod.id}
                          style={styles.moduleCard}
                          onPress={() => handleModulePress(mod)}
                        >
                          <View style={[styles.moduleIconBox, { backgroundColor: icon.color + "20" }]}>
                            <Ionicons name={icon.name as any} size={20} color={icon.color} />
                          </View>
                          <View style={styles.moduleInfo}>
                            <Text style={styles.moduleName} numberOfLines={2}>{mod.name}</Text>
                            <Text style={styles.moduleType}>{getModuleTypeName(mod.modname)}</Text>
                          </View>
                          <View style={styles.moduleRight}>
                            {status === "complete" ? (
                              <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
                            ) : status === "incomplete" ? (
                              <Ionicons name="ellipse-outline" size={22} color="#ccc" />
                            ) : (
                              <Ionicons name="chevron-forward" size={18} color="#ccc" />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}

          <View style={{ height: 120 }} />
        </ScrollView>
      )}

      {/* Pomodoro floating pill */}
      <PomodoroFloatingPill />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, backgroundColor: "white", elevation: 2 },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "bold", color: "#333", flex: 1, textAlign: "center", marginHorizontal: 8 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: "#999", fontSize: 14 },
  container: { flex: 1, backgroundColor: "#f7f8f6" },
  // Pomodoro banner
  pomodoroBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: PRIMARY + "15", marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: PRIMARY + "30" },
  pomodoroBannerText: { flex: 1, fontSize: 13, color: "#444", fontWeight: "500" },
  // Progress
  progressCard: { backgroundColor: "white", margin: 16, borderRadius: 16, padding: 16, elevation: 1 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  progressTitle: { fontSize: 16, fontWeight: "bold", color: "#333" },
  progressSubtitle: { fontSize: 12, color: "#999", marginTop: 2 },
  progressPercent: { fontSize: 28, fontWeight: "bold", color: PRIMARY },
  progressBarBg: { height: 8, backgroundColor: "#e5e7eb", borderRadius: 10, marginBottom: 12 },
  progressBarFill: { height: 8, backgroundColor: PRIMARY, borderRadius: 10 },
  statsRow: { flexDirection: "row", justifyContent: "space-around" },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontSize: 12, color: "#666" },
  // Sections
  sectionContainer: { marginHorizontal: 16, marginBottom: 10, borderRadius: 14, backgroundColor: "white", overflow: "hidden", elevation: 1 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  sectionLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  sectionDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#e5e7eb", alignItems: "center", justifyContent: "center" },
  sectionInfo: { flex: 1 },
  sectionName: { fontSize: 14, fontWeight: "bold", color: "#333" },
  sectionMeta: { fontSize: 12, color: "#999", marginTop: 2 },
  sectionProgressBg: { height: 3, backgroundColor: "#f3f4f6", marginHorizontal: 14, borderRadius: 10 },
  sectionProgressFill: { height: 3, backgroundColor: PRIMARY, borderRadius: 10 },
  modulesContainer: { paddingHorizontal: 14, paddingBottom: 8, paddingTop: 8 },
  moduleCard: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f3f4f6", gap: 12 },
  moduleIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  moduleInfo: { flex: 1 },
  moduleName: { fontSize: 13, fontWeight: "600", color: "#333" },
  moduleType: { fontSize: 11, color: "#999", marginTop: 2 },
  moduleRight: { alignItems: "center", justifyContent: "center" },
});
