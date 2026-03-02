import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { supabase } from "@/supabaseConfig";

const PRIMARY = "#9cd21f";

interface MoodleCourse {
  id: number;
  fullname: string;
  shortname: string;
  progress: number;
}

export default function Dashboard() {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [courses, setCourses] = useState<MoodleCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [moodleConnected, setMoodleConnected] = useState(false);

  useEffect(() => {
    if (user) fetchMoodleCourses();
  }, [user]);

  const fetchMoodleCourses = async () => {
    try {
      setLoading(true);

      const { data: connection, error: connectionError } = await supabase
        .from("moodle_connections")
        .select("moodle_url, moodle_token, moodle_userid")
        .eq("user_id", user?.id)
        .single();

      if (!connection) {
        setMoodleConnected(false);
        return;
      }

      setMoodleConnected(true);

      const url = `${connection.moodle_url}/webservice/rest/server.php?wstoken=${connection.moodle_token}&wsfunction=core_enrol_get_users_courses&moodlewsrestformat=json&userid=${connection.moodle_userid}`;

      const response = await fetch(url);
      const data = await response.json();

      if (Array.isArray(data)) {
        setCourses(data);
      }
    } catch (error) {
      console.error("Error fetching Moodle courses:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.replace("/");
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back 👋</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/(tabs)/profile" as any)}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.email?.charAt(0).toUpperCase()}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Moodle Banner — show only if not connected */}
      {!moodleConnected && !loading && (
        <TouchableOpacity
          style={styles.moodleBanner}
          onPress={() => router.push("/(tabs)/moodle" as any)}
        >
          <View style={styles.moodleBannerLeft}>
            <Ionicons name="school" size={28} color="white" />
            <View style={styles.moodleBannerText}>
              <Text style={styles.moodleBannerTitle}>Connect Moodle</Text>
              <Text style={styles.moodleBannerSubtitle}>
                Sync your university courses
              </Text>
            </View>
          </View>
          <Ionicons name="arrow-forward" size={20} color="white" />
        </TouchableOpacity>
      )}

      {/* Quick Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <MaterialIcons name="local-fire-department" size={24} color="#f97316" />
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>Streak</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialIcons name="schedule" size={24} color={PRIMARY} />
          <Text style={styles.statNumber}>0h</Text>
          <Text style={styles.statLabel}>Study Time</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialIcons name="task-alt" size={24} color="#22c55e" />
          <Text style={styles.statNumber}>{courses.length}</Text>
          <Text style={styles.statLabel}>Courses</Text>
        </View>
      </View>

      {/* My Courses */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Courses</Text>
          {moodleConnected && (
            <TouchableOpacity onPress={() => router.push("/(tabs)/moodle" as any)}>
              <Text style={styles.seeAll}>Manage Moodle</Text>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 20 }} />
        ) : !moodleConnected ? (
          <View style={styles.emptyState}>
            <Ionicons name="school-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No courses yet</Text>
            <Text style={styles.emptySubtext}>
              Connect your Moodle to import your courses
            </Text>
            <TouchableOpacity
              style={styles.connectButton}
              onPress={() => router.push("/(tabs)/moodle" as any)}
            >
              <Text style={styles.connectButtonText}>Connect Moodle</Text>
            </TouchableOpacity>
          </View>
        ) : courses.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No courses found</Text>
          </View>
        ) : (
          courses.map((course) => (
            <TouchableOpacity
              key={course.id}
              style={styles.courseCard}
              onPress={() => router.push("/(tabs)/course" as any)}
            >
              <View style={styles.courseIcon}>
                <MaterialIcons name="book" size={24} color={PRIMARY} />
              </View>
              <View style={styles.courseInfo}>
                <Text style={styles.courseTitle} numberOfLines={2}>
                  {course.fullname}
                </Text>
                <Text style={styles.courseShort}>{course.shortname}</Text>
                {course.progress > 0 && (
                  <>
                    <View style={styles.progressBarBg}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${Math.min(course.progress, 100)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {Math.round(course.progress)}% Complete
                    </Text>
                  </>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
          ))
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
            <Text style={styles.actionLabel}>AI Assistant</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/(tabs)/explore" as any)}
          >
            <Ionicons name="compass" size={28} color={PRIMARY} />
            <Text style={styles.actionLabel}>Explore</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/(tabs)/profile" as any)}
          >
            <Ionicons name="person" size={28} color={PRIMARY} />
            <Text style={styles.actionLabel}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logout} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f8f6",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "white",
  },
  greeting: {
    fontSize: 20,
    fontWeight: "bold",
  },
  email: {
    color: "#666",
    fontSize: 13,
    marginTop: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 18,
  },
  moodleBanner: {
    backgroundColor: PRIMARY,
    margin: 16,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  moodleBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  moodleBannerText: {
    marginLeft: 8,
  },
  moodleBannerTitle: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  moodleBannerSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "white",
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    marginTop: 16,
  },
  statCard: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  seeAll: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
    backgroundColor: "white",
    borderRadius: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#999",
    marginTop: 12,
  },
  emptySubtext: {
    color: "#bbb",
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  connectButton: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  connectButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  courseCard: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    elevation: 1,
  },
  courseIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f0f9e8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  courseInfo: {
    flex: 1,
  },
  courseTitle: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#333",
    marginBottom: 2,
  },
  courseShort: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 10,
    marginBottom: 4,
  },
  progressBarFill: {
    height: 6,
    backgroundColor: PRIMARY,
    borderRadius: 10,
  },
  progressText: {
    fontSize: 11,
    color: "#666",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionCard: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    flex: 1,
    marginHorizontal: 4,
  },
  actionLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
  },
  logout: {
    backgroundColor: "red",
    margin: 16,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 40,
  },
  logoutText: {
    color: "white",
    fontWeight: "bold",
  },
});