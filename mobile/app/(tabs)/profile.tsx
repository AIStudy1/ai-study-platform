import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/supabaseConfig";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { apiGetProfile, apiLogActivity, apiGetActivity } from "@/services/api";

const PRIMARY = "#9cd21f";

interface UserProfile {
  full_name: string;
  xp: number;
  level: number;
  streak_days: number;
  study_hours: number;
  avatar_url: string | null;
  energy?: number;
  max_energy?: number;
}

export default function Profile() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    apiGetProfile()
      .then((response) => {
        if (response.data) setProfile(response.data);
      })
      .catch((error) => console.error("Error fetching profile:", error));

    apiGetActivity(10)
      .then((response) => {
        if (response.data) setActivity(response.data);
      })
      .catch((error) => console.error("Error fetching activity:", error));
  }, [user]);

  const displayName = profile?.full_name || "Student";
  const avatarLetter = displayName.charAt(0).toUpperCase();

  const handleLogout = async () => {
    await signOut();
    router.replace("/");
  };

  const showPhotoOptions = () => {
    Alert.alert("Update Profile Photo", "Choose an option", [
      { text: "📷 Take a Photo", onPress: takePhoto },
      { text: "🖼️ Choose from Gallery", onPress: pickFromGallery },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow camera access");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Please allow photo access");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      await uploadPhoto(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string) => {
    try {
      setUploadingPhoto(true);

      const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `avatars/${user?.id}-${Date.now()}.${ext}`;
      const contentType = ext === "png" ? "image/png" : "image/jpeg";

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64" as any,
      });

      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { error: uploadError } = await supabase.storage
        .from("course-files")
        .upload(fileName, bytes, {
          contentType,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("course-files")
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from("users")
        .update({ avatar_url: urlData.publicUrl })
        .eq("id", user?.id);

      if (updateError) throw updateError;

      setProfile((prev) =>
        prev ? { ...prev, avatar_url: urlData.publicUrl } : prev
      );

      await apiLogActivity("photo_updated", "Updated profile photo 📸");
      Alert.alert("Success", "Profile photo updated!");
    } catch (error: any) {
      console.error("Upload error:", error);
      Alert.alert("Error", error.message || "Could not upload photo. Try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "course_created": return "sparkles";
      case "chapter_completed": return "checkmark-circle";
      case "quiz_passed": return "trophy";
      case "quiz_failed": return "close-circle";
      case "goal_reached": return "flame";
      case "photo_updated": return "camera";
      default: return "time";
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case "course_created": return "#9cd21f";
      case "chapter_completed": return "#22c55e";
      case "quiz_passed": return "#f97316";
      case "quiz_failed": return "#ef4444";
      case "goal_reached": return "#f97316";
      case "photo_updated": return "#3b82f6";
      default: return "#8b5cf6";
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      <ScrollView style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/settings" as any)}>
            <Ionicons name="settings-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarWrapper} onPress={showPhotoOptions}>
            {uploadingPhoto ? (
              <View style={styles.avatar}>
                <ActivityIndicator color="white" />
              </View>
            ) : profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{avatarLetter}</Text>
              </View>
            )}
            <View style={styles.cameraButton}>
              <Ionicons name="camera" size={14} color="white" />
            </View>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>LVL {profile?.level ?? 1}</Text>
            </View>
          </TouchableOpacity>

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
            <Ionicons name="flash" size={24} color="#eab308" />
            <Text style={styles.statNumber}>
              {profile?.energy != null && profile?.max_energy != null
                ? `${profile.energy}/${profile.max_energy}`
                : "—"}
            </Text>
            <Text style={styles.statLabel}>Energy</Text>
          </View>
        </View>
        {profile?.energy != null && (
          <Text style={styles.energyHint}>
            Energy refills over time (about +1 every 30 minutes, up to your max). Failed quizzes cost 1 energy.
          </Text>
        )}

        {/* Quick Links */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Links</Text>

          <TouchableOpacity
            style={styles.linkCard}
            onPress={() => router.push("/(tabs)/dashboard" as any)}
          >
            <View style={[styles.linkIcon, { backgroundColor: PRIMARY + "20" }]}>
              <Ionicons name="book-outline" size={20} color={PRIMARY} />
            </View>
            <View style={styles.linkText}>
              <Text style={styles.linkTitle}>Continue Learning</Text>
              <Text style={styles.linkSubtitle}>Pick up where you left off</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkCard}
            onPress={() => router.push("/(tabs)/explore" as any)}
          >
            <View style={[styles.linkIcon, { backgroundColor: "#3b82f620" }]}>
              <Ionicons name="compass-outline" size={20} color="#3b82f6" />
            </View>
            <View style={styles.linkText}>
              <Text style={styles.linkTitle}>Explore Courses</Text>
              <Text style={styles.linkSubtitle}>Discover something new</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkCard}
            onPress={() => router.push("/(tabs)/ai" as any)}
          >
            <View style={[styles.linkIcon, { backgroundColor: "#8b5cf620" }]}>
              <Ionicons name="sparkles-outline" size={20} color="#8b5cf6" />
            </View>
            <View style={styles.linkText}>
              <Text style={styles.linkTitle}>Ask AI Assistant</Text>
              <Text style={styles.linkSubtitle}>Get help with anything</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkCard}>
            <View style={[styles.linkIcon, { backgroundColor: "#f9731620" }]}>
              <Ionicons name="trophy-outline" size={20} color="#f97316" />
            </View>
            <View style={styles.linkText}>
              <Text style={styles.linkTitle}>Daily Goal</Text>
              <Text style={styles.linkSubtitle}>Coming soon • +50 XP</Text>
            </View>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Soon</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Integrations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Integrations</Text>
          <TouchableOpacity
            style={styles.linkCard}
            onPress={() => router.push("/(tabs)/moodle" as any)}
          >
            <View style={[styles.linkIcon, { backgroundColor: PRIMARY + "20" }]}>
              <Ionicons name="school-outline" size={20} color={PRIMARY} />
            </View>
            <View style={styles.linkText}>
              <Text style={styles.linkTitle}>Moodle Connection</Text>
              <Text style={styles.linkSubtitle}>Manage your university sync</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {activity.length === 0 ? (
            <View style={[styles.linkCard, { justifyContent: "center" }]}>
              <Text style={{ color: "#999", fontSize: 13 }}>No activity yet</Text>
            </View>
          ) : (
            activity.map((item) => (
              <View key={item.id} style={styles.linkCard}>
                <View style={[styles.linkIcon, { backgroundColor: getActivityColor(item.type) + "20" }]}>
                  <Ionicons
                    name={getActivityIcon(item.type) as any}
                    size={20}
                    color={getActivityColor(item.type)}
                  />
                </View>
                <View style={styles.linkText}>
                  <Text style={styles.linkTitle}>{item.description}</Text>
                  <Text style={styles.linkSubtitle}>{timeAgo(item.created_at)}</Text>
                </View>
              </View>
            ))
          )}
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
  container: { flex: 1, backgroundColor: "#f7f8f6" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "white",
  },
  headerTitle: { fontSize: 20, fontWeight: "bold", color: "#333" },
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
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarText: { fontSize: 36, color: "white", fontWeight: "bold" },
  cameraButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#333",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "white",
  },
  levelBadge: {
    position: "absolute",
    bottom: -5,
    left: -10,
    backgroundColor: PRIMARY,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  levelText: { color: "white", fontWeight: "bold", fontSize: 12 },
  name: { fontSize: 22, fontWeight: "bold", marginBottom: 2 },
  email: { fontSize: 13, color: "#999", marginBottom: 4 },
  subtitle: { color: "#666", marginBottom: 16, fontSize: 13 },
  progressContainer: { width: "100%" },
  progressTop: { flexDirection: "row", justifyContent: "space-between" },
  levelLabel: { fontWeight: "bold", color: PRIMARY },
  xpText: { color: "#666" },
  progressBarBackground: {
    height: 10,
    backgroundColor: "#e5e7eb",
    borderRadius: 20,
    marginVertical: 6,
  },
  progressBarFill: { height: 10, backgroundColor: PRIMARY, borderRadius: 20 },
  remainingXP: { textAlign: "center", fontSize: 12, color: "#888" },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "white",
    paddingVertical: 20,
    marginBottom: 8,
  },
  statCard: { alignItems: "center" },
  statNumber: { fontSize: 18, fontWeight: "bold", marginTop: 4 },
  statLabel: { fontSize: 12, color: "#666" },
  energyHint: {
    fontSize: 12,
    color: "#888",
    paddingHorizontal: 20,
    marginBottom: 12,
    lineHeight: 18,
  },
  section: { paddingHorizontal: 16, marginBottom: 8 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
    marginTop: 16,
    color: "#333",
  },
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  linkText: { flex: 1 },
  linkTitle: { fontWeight: "bold", color: "#333" },
  linkSubtitle: { fontSize: 12, color: "#666", marginTop: 2 },
  comingSoonBadge: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  comingSoonText: { fontSize: 11, color: "#999", fontWeight: "bold" },
  logout: {
    backgroundColor: "red",
    margin: 16,
    marginTop: 8,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 40,
  },
  logoutText: { color: "white", fontWeight: "bold", fontSize: 16 },
});