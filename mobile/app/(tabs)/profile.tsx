import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth } from "/Users/mac/AiStudy/mobile/firebaseConfig.ts"; 
import { useEffect, useState } from "react";

export default function Profile() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserName(user.displayName || "Student");
      }
    });
  
    return unsubscribe;
  }, []);
  
  
  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Student Profile</Text>

        <Ionicons name="settings-outline" size={24} color="#333" />
      </View>

      {/* Avatar Section */}
      <View style={styles.avatarSection}>
        <View style={styles.avatarWrapper}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
          </View>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>LVL 12</Text>
          </View>
        </View>

        <Text style={styles.name}>{userName}</Text>
        <Text style={styles.subtitle}>Pro Learner • Mastering STEM</Text>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTop}>
            <Text style={styles.levelLabel}>Level 12</Text>
            <Text style={styles.xpText}>850 / 1000 XP</Text>
          </View>

          <View style={styles.progressBarBackground}>
            <View style={styles.progressBarFill} />
          </View>

          <Text style={styles.remainingXP}>
            150 XP until Level 13
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <MaterialIcons name="schedule" size={24} color="#9cd21f" />
          <Text style={styles.statNumber}>42h</Text>
          <Text style={styles.statLabel}>Study Time</Text>
        </View>

        <View style={styles.statCard}>
          <MaterialIcons
            name="local-fire-department"
            size={24}
            color="#f97316"
          />
          <Text style={styles.statNumber}>15</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>

        <View style={styles.statCard}>
          <MaterialIcons name="task-alt" size={24} color="#22c55e" />
          <Text style={styles.statNumber}>08</Text>
          <Text style={styles.statLabel}>Courses</Text>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.activitySection}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>

        {/* CLICKABLE COURSE */}
        <TouchableOpacity
          style={styles.activityCard}
          onPress={() => router.push("/course")}
        >
          <MaterialIcons name="science" size={24} color="#9cd21f" />
          <View style={styles.activityText}>
            <Text style={styles.activityTitle}>
              Physics: Quantum Basics
            </Text>
            <Text style={styles.activitySubtitle}>
              Completed Quiz • 95%
            </Text>
          </View>
        </TouchableOpacity>

        {/* Second Activity */}
        <View style={styles.activityCard}>
          <MaterialIcons
            name="emoji-events"
            size={24}
            color="#f97316"
          />
          <View style={styles.activityText}>
            <Text style={styles.activityTitle}>
              Daily Goal Reached
            </Text>
            <Text style={styles.activitySubtitle}>
              +50 Bonus XP
            </Text>
          </View>
        </View>
      </View>
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
    padding: 16,
    backgroundColor: "white",
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },

  avatarSection: {
    alignItems: "center",
    padding: 24,
    backgroundColor: "white",
  },

  avatarWrapper: {
    position: "relative",
    marginBottom: 12,
  },

  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#9cd21f",
    justifyContent: "center",
    alignItems: "center",
  },

  avatarText: {
    fontSize: 40,
    color: "white",
    fontWeight: "bold",
  },

  levelBadge: {
    position: "absolute",
    bottom: -5,
    right: -5,
    backgroundColor: "#9cd21f",
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
  },

  subtitle: {
    color: "#666",
    marginBottom: 16,
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
    color: "#9cd21f",
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
    width: "85%",
    backgroundColor: "#9cd21f",
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
    paddingVertical: 20,
    backgroundColor: "#f7f8f6",
  },

  statCard: {
    alignItems: "center",
  },

  statNumber: {
    fontSize: 18,
    fontWeight: "bold",
  },

  statLabel: {
    fontSize: 12,
    color: "#666",
  },

  activitySection: {
    padding: 20,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
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
  },

  activityTitle: {
    fontWeight: "bold",
  },

  activitySubtitle: {
    fontSize: 12,
    color: "#666",
  },
});
