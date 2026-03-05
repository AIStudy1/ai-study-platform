import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/supabaseConfig";

const PRIMARY = "#9cd21f";

interface UserProfile {
  full_name: string;
  xp: number;
  level: number;
  streak_days: number;
  study_hours: number;
}

export default function Profile() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("users")
      .select("full_name, xp, level, streak_days, study_hours")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data);
      });
  }, [user]);

  const displayName = profile?.full_name || "Student";
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    await signOut();
    router.replace("/");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      <ScrollView style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>
          <Ionicons name="settings-outline" size={24} color="#333" />
        </View>

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{avatarLetter}</Text>
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>LVL {profile?.level ?? 1}</Text>
            </View>
          </View>

          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <Text style={styles.subtitle}>Pro Learner • Mastering STEM</Text>

          {/* XP Progress */}
          <View style={styles.progressContainer}>
            <View style={styles.progressTop}>
              <Text style={styles.levelLabel}>Level {profile?.level ?? 1}</Text>
              <Text style={styles.xpText}>{profile?.xp ?? 0} / 1000 XP</Text>
            </View>
            <View style={styles.progressBarBackground}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min(((profile?.xp ?? 0) / 1000) * 100, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.remainingXP}>
              {1000 - (profile?.xp ?? 0)} XP until Level {(profile?.level ?? 1) + 1}
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <MaterialIcons name="schedule" size={24} color={PRIMARY} />
            <Text style={styles.statNumber}>{profile?.study_hours ?? 0}h</Text>
            <Text style={styles.statLabel}>Study Time</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="local-fire-department" size={24} color="#f97316" />
            <Text style={styles.statNumber}>{profile?.streak_days ?? 0}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="task-alt" size={24} color="#22c55e" />
            <Text style={styles.statNumber}>0</Text>
            <Text style={styles.statLabel}>Courses</Text>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>

          <TouchableOpacity
            style={styles.activityCard}
            onPress={() => router.push("/(tabs)/course" as any)}
          >
            <MaterialIcons name="science" size={24} color={PRIMARY} />
            <View style={styles.activityText}>
              <Text style={styles.activityTitle}>Physics: Quantum Basics</Text>
              <Text style={styles.activitySubtitle}>Completed Quiz • 95%</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>

          <View style={styles.activityCard}>
            <MaterialIcons name="emoji-events" size={24} color="#f97316" />
            <View style={styles.activityText}>
              <Text style={styles.activityTitle}>Daily Goal Reached</Text>
              <Text style={styles.activitySubtitle}>+50 Bonus XP</Text>
            </View>
          </View>
        </View>

        {/* Moodle Connection */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Integrations</Text>
          <TouchableOpacity
            style={styles.activityCard}
            onPress={() => router.push("/(tabs)/moodle" as any)}
          >
            <Ionicons name="school" size={24} color={PRIMARY} />
            <View style={styles.activityText}>
              <Text style={styles.activityTitle}>Moodle Connection</Text>
              <Text style={styles.activitySubtitle}>Manage your university sync</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logout} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="white" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
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
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  avatarSection: {
    alignItems: "center",
    padding: 24,
    backgroundColor: "white",
    marginBottom: 8,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: PRIMARY,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 36,
    color: "white",
    fontWeight: "bold",
  },
  levelBadge: {
    position: "absolute",
    bottom: -5,
    right: -5,
    backgroundColor: PRIMARY,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  levelText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 12,
  },
  name: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 2,
  },
  email: {
    fontSize: 13,
    color: "#999",
    marginBottom: 4,
  },
  subtitle: {
    color: "#666",
    marginBottom: 16,
    fontSize: 13,
  },
  progressContainer: {
    width: "100%",
  },
  progressTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  levelLabel: {
    fontWeight: "bold",
    color: PRIMARY,
  },
  xpText: {
    color: "#666",
  },
  progressBarBackground: {
    height: 10,
    backgroundColor: "#e5e7eb",
    borderRadius: 20,
    marginVertical: 6,
  },
  progressBarFill: {
    height: 10,
    backgroundColor: PRIMARY,
    borderRadius: 20,
  },
  remainingXP: {
    textAlign: "center",
    fontSize: 12,
    color: "#888",
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "white",
    paddingVertical: 20,
    marginBottom: 8,
  },
  statCard: {
    alignItems: "center",
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
  },
  activitySection: {
    padding: 20,
    paddingTop: 0,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    marginTop: 16,
  },
  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
  },
  activityText: {
    marginLeft: 10,
    flex: 1,
  },
  activityTitle: {
    fontWeight: "bold",
  },
  activitySubtitle: {
    fontSize: 12,
    color: "#666",
  },
  logout: {
    backgroundColor: "red",
    margin: 20,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 40,
  },
  logoutText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
});