import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "@/supabaseConfig";
import { apiGetMyCourses, apiGetProfile } from "@/services/api";

const PRIMARY = "#9cd21f";

interface MoodleCourse {
  id: number;
  fullname: string;
  shortname: string;
  progress: number;
}

interface AICourse {
  id: string;
  title: string;
  subject: string;
  description: string;
  total_chapters: number;
  completed_chapters: number;
  created_at: string;
  course_level?: number;
  course_xp?: number;
  entry_quiz_passed?: boolean;
}

interface Profile {
  full_name: string;
  xp: number;
  level: number;
  streak_days: number;
  study_hours: number;
  energy?: number;
  max_energy?: number;
}

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [moodleCourses, setMoodleCourses] = useState<MoodleCourse[]>([]);
  const [aiCourses, setAiCourses] = useState<AICourse[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [moodleConnected, setMoodleConnected] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAll();
    }
  }, [user]);

  // Refresh when returning to Dashboard (e.g., after adding an AI course from the AI chat).
  useFocusEffect(() => {
    if (!user) return;
    fetchAICourses();
    fetchProfile();
  });

  const fetchAll = async () => {
    await Promise.all([fetchMoodleCourses(), fetchAICourses(), fetchProfile()]);
    setLoading(false);
  };

  const fetchProfile = async () => {
    try {
      const res = await apiGetProfile();
      if (res.data) setProfile(res.data);
    } catch (e) {
      console.error("Profile error:", e);
    }
  };

  const fetchMoodleCourses = async () => {
    try {
      const { data: connection } = await supabase
        .from("moodle_connections")
        .select("moodle_url, moodle_token, moodle_userid")
        .eq("user_id", user?.id)
        .single();

      if (!connection) { setMoodleConnected(false); return; }

      setMoodleConnected(true);
      const url = `${connection.moodle_url}/webservice/rest/server.php?wstoken=${connection.moodle_token}&wsfunction=core_enrol_get_users_courses&moodlewsrestformat=json&userid=${connection.moodle_userid}`;
      const response = await fetch(url);
      const data = await response.json();
      if (Array.isArray(data)) setMoodleCourses(data);
    } catch (e) {
      console.error("Moodle error:", e);
    }
  };

  const fetchAICourses = async () => {
    try {
      const response = await apiGetMyCourses();
      if (response.data) setAiCourses(response.data);
    } catch (e) {
      console.error("AI courses error:", e);
    }
  };

  const getProgressPercent = (course: AICourse) => {
    if (!course.total_chapters || course.total_chapters === 0) return 0;
    return Math.round((course.completed_chapters / course.total_chapters) * 100);
  };

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "Student";
  const totalCourses = moodleCourses.length + aiCourses.length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      <ScrollView style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Welcome back 👋</Text>
            <Text style={styles.name}>{displayName}</Text>
            {profile?.energy != null && profile?.max_energy != null && (
              <View style={styles.energyRow}>
                <Ionicons name="flash" size={14} color="#f97316" />
                <Text style={styles.energyText}>
                  Energy {profile.energy}/{profile.max_energy}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={() => router.push("/(tabs)/profile" as any)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Moodle Banner */}
        {!moodleConnected && !loading && (
          <TouchableOpacity
            style={styles.moodleBanner}
            onPress={() => router.push("/(tabs)/moodle" as any)}
          >
            <View style={styles.moodleBannerLeft}>
              <Ionicons name="school" size={28} color="white" />
              <View style={styles.moodleBannerText}>
                <Text style={styles.moodleBannerTitle}>Connect Moodle</Text>
                <Text style={styles.moodleBannerSubtitle}>Sync your university courses</Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={20} color="white" />
          </TouchableOpacity>
        )}

        {/* Quick Stats — now real data */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <MaterialIcons name="local-fire-department" size={24} color="#f97316" />
            <Text style={styles.statNumber}>{profile?.streak_days ?? 0}</Text>
            <Text style={styles.statLabel}>Streak</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="schedule" size={24} color={PRIMARY} />
            <Text style={styles.statNumber}>{profile?.study_hours ?? 0}h</Text>
            <Text style={styles.statLabel}>Study Time</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="task-alt" size={24} color="#22c55e" />
            <Text style={styles.statNumber}>{totalCourses}</Text>
            <Text style={styles.statLabel}>Courses</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="bolt" size={24} color="#8b5cf6" />
            <Text style={styles.statNumber}>{profile?.xp ?? 0}</Text>
            <Text style={styles.statLabel}>XP</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* Moodle Courses */}
            {moodleConnected && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <Ionicons name="school" size={20} color={PRIMARY} />
                    <Text style={styles.sectionTitle}>University Courses</Text>
                  </View>
                  <TouchableOpacity onPress={() => router.push("/(tabs)/moodle" as any)}>
                    <Text style={styles.seeAll}>Manage</Text>
                  </TouchableOpacity>
                </View>

                {moodleCourses.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No courses found on Moodle</Text>
                  </View>
                ) : (
                  moodleCourses.map((course) => (
                    <TouchableOpacity
                      key={course.id}
                      style={styles.courseCard}
                      onPress={() =>
                        router.push({
                          pathname: "/(tabs)/moodle-course",
                          params: {
                            courseId: course.id.toString(),
                            courseName: course.fullname,
                          },
                        } as any)
                      }
                    >
                      <View style={[styles.courseIconBox, { backgroundColor: "#eff6ff" }]}>
                        <Ionicons name="school" size={24} color="#3b82f6" />
                      </View>
                      <View style={styles.courseInfo}>
                        <View style={styles.courseTitleRow}>
                          <Text style={styles.courseTitle} numberOfLines={1}>
                            {course.fullname}
                          </Text>
                          <View style={styles.moodleBadge}>
                            <Text style={styles.moodleBadgeText}>Moodle</Text>
                          </View>
                        </View>
                        <Text style={styles.courseSubtitle}>{course.shortname}</Text>
                        {course.progress > 0 && (
                          <>
                            <View style={styles.progressBarBg}>
                              <View
                                style={[
                                  styles.progressBarFill,
                                  { width: `${Math.min(course.progress, 100)}%`, backgroundColor: "#3b82f6" },
                                ]}
                              />
                            </View>
                            <Text style={styles.progressText}>{Math.round(course.progress)}% Complete</Text>
                          </>
                        )}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#ccc" />
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {/* AI Courses */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="sparkles" size={20} color={PRIMARY} />
                  <Text style={styles.sectionTitle}>My AI Courses</Text>
                </View>
                <TouchableOpacity onPress={() => router.push("/(tabs)/ai" as any)}>
                  <Text style={styles.seeAll}>+ New</Text>
                </TouchableOpacity>
              </View>

              {aiCourses.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="sparkles-outline" size={48} color="#ccc" />
                  <Text style={styles.emptyText}>No AI courses yet</Text>
                  <Text style={styles.emptySubtext}>Chat with AI to generate your first course</Text>
                  <TouchableOpacity
                    style={styles.generateButton}
                    onPress={() => router.push("/(tabs)/ai" as any)}
                  >
                    <Ionicons name="sparkles" size={16} color="white" />
                    <Text style={styles.generateButtonText}>Generate Course with AI</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                aiCourses.map((course) => {
                  const percent = getProgressPercent(course);
                  return (
                    <TouchableOpacity
                      key={course.id}
                      style={styles.courseCard}
                      onPress={() =>
                        router.push({
                          pathname: "/(tabs)/course",
                          params: { courseId: course.id },
                        } as any)
                      }
                    >
                      <View style={[styles.courseIconBox, { backgroundColor: PRIMARY + "20" }]}>
                        <Ionicons name="sparkles" size={24} color={PRIMARY} />
                      </View>
                      <View style={styles.courseInfo}>
                        <View style={styles.courseTitleRow}>
                          <Text style={styles.courseTitle} numberOfLines={1}>
                            {course.title}
                          </Text>
                          <View style={[styles.moodleBadge, { backgroundColor: PRIMARY + "20" }]}>
                            <Text style={[styles.moodleBadgeText, { color: PRIMARY }]}>AI</Text>
                          </View>
                          {course.course_level != null && course.course_level > 0 && (
                            <View style={[styles.moodleBadge, { backgroundColor: "#8b5cf620" }]}>
                              <Text style={[styles.moodleBadgeText, { color: "#8b5cf6" }]}>
                                Lv.{course.course_level}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.courseSubtitle}>{course.subject}</Text>
                        <View style={styles.progressBarBg}>
                          <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
                        </View>
                        <View style={styles.courseFooter}>
                          <Text style={styles.progressText}>{percent}% Complete</Text>
                          <Text style={styles.chaptersText}>
                            {course.completed_chapters}/{course.total_chapters} chapters
                          </Text>
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#ccc" />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => router.push("/(tabs)/ai" as any)}
                >
                  <Ionicons name="sparkles" size={28} color={PRIMARY} />
                  <Text style={styles.actionLabel}>AI Agents</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => router.push("/(tabs)/explore" as any)}
                >
                  <Ionicons name="compass" size={28} color="#3b82f6" />
                  <Text style={styles.actionLabel}>Explore</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => router.push("/(tabs)/profile" as any)}
                >
                  <Ionicons name="person" size={28} color="#8b5cf6" />
                  <Text style={styles.actionLabel}>Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionCard}
                  onPress={() => router.push("/(tabs)/diagnostic" as any)}
                >
                  <Ionicons name="clipboard" size={28} color="#f97316" />
                  <Text style={styles.actionLabel}>Diagnostic</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f8f6" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 20, backgroundColor: "white",
  },
  greeting: { fontSize: 14, color: "#666" },
  name: { fontSize: 20, fontWeight: "bold", color: "#333", marginTop: 2 },
  energyRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  energyText: { fontSize: 12, color: "#666", fontWeight: "600" },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "white", fontWeight: "bold", fontSize: 18 },
  moodleBanner: {
    backgroundColor: PRIMARY, margin: 16, borderRadius: 16, padding: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  moodleBannerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  moodleBannerText: { marginLeft: 8 },
  moodleBannerTitle: { color: "white", fontWeight: "bold", fontSize: 16 },
  moodleBannerSubtitle: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  statsRow: {
    flexDirection: "row", justifyContent: "space-around", backgroundColor: "white",
    marginHorizontal: 16, borderRadius: 16, padding: 16, marginTop: 16, marginBottom: 16,
  },
  statCard: { alignItems: "center" },
  statNumber: { fontSize: 18, fontWeight: "bold", marginTop: 4, color: "#333" },
  statLabel: { fontSize: 11, color: "#666" },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12,
  },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
  seeAll: { color: PRIMARY, fontSize: 13, fontWeight: "600" },
  emptyState: { alignItems: "center", paddingVertical: 40, backgroundColor: "white", borderRadius: 16 },
  emptyText: { fontSize: 16, fontWeight: "bold", color: "#999", marginTop: 12 },
  emptySubtext: { color: "#bbb", fontSize: 13, marginTop: 4, textAlign: "center", paddingHorizontal: 20 },
  generateButton: {
    backgroundColor: PRIMARY, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 12, marginTop: 16, flexDirection: "row", alignItems: "center", gap: 8,
  },
  generateButtonText: { color: "white", fontWeight: "bold" },
  courseCard: {
    backgroundColor: "white", borderRadius: 14, padding: 14,
    flexDirection: "row", alignItems: "center", marginBottom: 10, elevation: 1,
  },
  courseIconBox: {
    width: 48, height: 48, borderRadius: 14,
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  courseInfo: { flex: 1 },
  courseTitleRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2,
  },
  courseTitle: { fontWeight: "bold", fontSize: 14, color: "#333", flex: 1, marginRight: 8 },
  moodleBadge: { backgroundColor: "#eff6ff", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  moodleBadgeText: { fontSize: 10, fontWeight: "bold", color: "#3b82f6" },
  courseSubtitle: { fontSize: 12, color: "#999", marginBottom: 6 },
  progressBarBg: { height: 6, backgroundColor: "#e5e7eb", borderRadius: 10, marginBottom: 4 },
  progressBarFill: { height: 6, backgroundColor: PRIMARY, borderRadius: 10 },
  courseFooter: { flexDirection: "row", justifyContent: "space-between" },
  progressText: { fontSize: 11, color: "#666" },
  chaptersText: { fontSize: 11, color: "#999" },
  actionsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  actionCard: {
    backgroundColor: "white", borderRadius: 14, padding: 12,
    alignItems: "center", flex: 1, marginHorizontal: 3,
  },
  actionLabel: { marginTop: 6, fontSize: 11, fontWeight: "600", color: "#333", textAlign: "center" },
});
