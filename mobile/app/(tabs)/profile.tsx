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
import {
  apiGetProfile,
  apiLogActivity,
  apiGetActivity,
  apiGetBadges,
  apiGetLeaderboard,
} from "@/services/api";

const PRIMARY = "#9cd21f";

interface UserProfile {
  full_name: string;
  xp: number;
  level: number;
  streak_days: number;
  study_hours: number;
  avatar_url: string | null;
}

interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  xp_reward: number;
  earned: boolean;
  earned_at: string | null;
}

interface LeaderboardEntry {
  rank: number;
  id: string;
  full_name: string;
  xp: number;
  level: number;
  streak_days: number;
  isMe: boolean;
}

type TabType = "stats" | "badges" | "leaderboard";

export default function Profile() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [activity, setActivity] = useState<any[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("stats");
  const [loadingBadges, setLoadingBadges] = useState(false);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

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

    fetchBadges();
  }, [user]);

  const fetchBadges = async () => {
    setLoadingBadges(true);
    try {
      const res = await apiGetBadges();
      if (res.data) setBadges(res.data);
    } catch (e) {
      console.error("Error fetching badges:", e);
    } finally {
      setLoadingBadges(false);
    }
  };

  const fetchLeaderboard = async () => {
    if (leaderboard.length > 0) return; // already loaded
    setLoadingLeaderboard(true);
    try {
      const res = await apiGetLeaderboard();
      if (res.data) setLeaderboard(res.data);
    } catch (e) {
      console.error("Error fetching leaderboard:", e);
    } finally {
      setLoadingLeaderboard(false);
    }
  };

  useEffect(() => {
    if (activeTab === "leaderboard") fetchLeaderboard();
  }, [activeTab]);

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
        .upload(fileName, bytes, { contentType, upsert: true });

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
      Alert.alert("Error", error.message || "Could not upload photo.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const xpInLevel = (profile?.xp || 0) % 1000;
  const xpPercent = (xpInLevel / 1000) * 100;
  const earnedBadges = badges.filter((b) => b.earned);
  const lockedBadges = badges.filter((b) => !b.earned);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      <ScrollView>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={showPhotoOptions} style={styles.avatarContainer}>
            {uploadingPhoto ? (
              <ActivityIndicator color="white" />
            ) : profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarLetter}>{avatarLetter}</Text>
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={12} color="white" />
            </View>
          </TouchableOpacity>

          <Text style={styles.name}>{displayName}</Text>
          <Text style={styles.email}>{user?.email}</Text>

          {/* XP Bar */}
          <View style={styles.xpRow}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelText}>Lv {profile?.level || 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.xpBarBg}>
                <View style={[styles.xpBarFill, { width: `${xpPercent}%` }]} />
              </View>
              <Text style={styles.xpText}>{xpInLevel} / 1000 XP</Text>
            </View>
          </View>

          {/* Quick stats */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{profile?.xp || 0}</Text>
              <Text style={styles.statLabel}>Total XP</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>🔥 {profile?.streak_days || 0}</Text>
              <Text style={styles.statLabel}>Day Streak</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{earnedBadges.length}</Text>
              <Text style={styles.statLabel}>Badges</Text>
            </View>
          </View>
        </View>

        {/* ── Tabs ── */}
        <View style={styles.tabs}>
          {(["stats", "badges", "leaderboard"] as TabType[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === "stats" ? "Stats" : tab === "badges" ? "Badges" : "Ranking"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Stats tab ── */}
        {activeTab === "stats" && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {activity.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>No activity yet</Text>
              </View>
            ) : (
              activity.map((item, i) => (
                <View key={i} style={styles.activityCard}>
                  <View style={styles.activityDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityDesc}>{item.description}</Text>
                    <Text style={styles.activityTime}>
                      {new Date(item.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                      })}
                    </Text>
                  </View>
                </View>
              ))
            )}

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={20} color="#ef4444" />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Badges tab ── */}
        {activeTab === "badges" && (
          <View style={styles.section}>
            {loadingBadges ? (
              <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
            ) : (
              <>
                {earnedBadges.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>
                      Earned — {earnedBadges.length}/{badges.length}
                    </Text>
                    <View style={styles.badgeGrid}>
                      {earnedBadges.map((badge) => (
                        <View key={badge.id} style={styles.badgeCard}>
                          <Text style={styles.badgeIcon}>{badge.icon}</Text>
                          <Text style={styles.badgeName}>{badge.name}</Text>
                          <Text style={styles.badgeDesc}>{badge.description}</Text>
                          <View style={styles.badgeXP}>
                            <Text style={styles.badgeXPText}>+{badge.xp_reward} XP</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {lockedBadges.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Locked</Text>
                    <View style={styles.badgeGrid}>
                      {lockedBadges.map((badge) => (
                        <View key={badge.id} style={[styles.badgeCard, styles.badgeCardLocked]}>
                          <Text style={[styles.badgeIcon, { opacity: 0.3 }]}>🔒</Text>
                          <Text style={[styles.badgeName, { color: "#999" }]}>{badge.name}</Text>
                          <Text style={styles.badgeDesc}>{badge.description}</Text>
                          <View style={[styles.badgeXP, { backgroundColor: "#f3f4f6" }]}>
                            <Text style={[styles.badgeXPText, { color: "#999" }]}>
                              +{badge.xp_reward} XP
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {badges.length === 0 && (
                  <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>Complete courses and quizzes to earn badges!</Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* ── Leaderboard tab ── */}
        {activeTab === "leaderboard" && (
          <View style={styles.section}>
            {loadingLeaderboard ? (
              <ActivityIndicator color={PRIMARY} style={{ marginTop: 40 }} />
            ) : (
              <>
                <Text style={styles.sectionTitle}>Top Students</Text>
                {leaderboard.map((entry) => (
                  <View
                    key={entry.id}
                    style={[styles.leaderCard, entry.isMe && styles.leaderCardMe]}
                  >
                    <Text style={styles.leaderRank}>
                      {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : `#${entry.rank}`}
                    </Text>
                    <View style={styles.leaderAvatar}>
                      <Text style={styles.leaderAvatarText}>
                        {entry.full_name?.charAt(0).toUpperCase() || "?"}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.leaderName}>
                        {entry.full_name} {entry.isMe ? "(You)" : ""}
                      </Text>
                      <Text style={styles.leaderSub}>
                        Lv {entry.level} · 🔥 {entry.streak_days} days
                      </Text>
                    </View>
                    <View style={styles.leaderXP}>
                      <Text style={styles.leaderXPText}>{entry.xp.toLocaleString()}</Text>
                      <Text style={styles.leaderXPLabel}>XP</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: "white", padding: 24, alignItems: "center", paddingBottom: 20 },
  avatarContainer: { position: "relative", marginBottom: 12 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  avatarFallback: { width: 80, height: 80, borderRadius: 40, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" },
  avatarLetter: { fontSize: 32, fontWeight: "bold", color: "white" },
  cameraIcon: { position: "absolute", bottom: 0, right: 0, backgroundColor: "#333", borderRadius: 10, padding: 4 },
  name: { fontSize: 20, fontWeight: "bold", color: "#333", marginBottom: 4 },
  email: { fontSize: 13, color: "#999", marginBottom: 16 },
  xpRow: { flexDirection: "row", alignItems: "center", gap: 10, width: "100%", marginBottom: 16 },
  levelBadge: { backgroundColor: PRIMARY, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  levelText: { color: "white", fontWeight: "bold", fontSize: 13 },
  xpBarBg: { height: 8, backgroundColor: "#e5e7eb", borderRadius: 10 },
  xpBarFill: { height: 8, backgroundColor: PRIMARY, borderRadius: 10 },
  xpText: { fontSize: 11, color: "#999", marginTop: 3 },
  statsRow: { flexDirection: "row", width: "100%", backgroundColor: "#f7f8f6", borderRadius: 14, padding: 16 },
  statBox: { flex: 1, alignItems: "center" },
  statDivider: { width: 1, backgroundColor: "#e5e7eb" },
  statNumber: { fontSize: 18, fontWeight: "bold", color: "#333", marginBottom: 2 },
  statLabel: { fontSize: 11, color: "#999" },
  tabs: { flexDirection: "row", marginHorizontal: 16, marginTop: 16, backgroundColor: "white", borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: PRIMARY },
  tabText: { fontWeight: "600", color: "#999", fontSize: 14 },
  tabTextActive: { color: "white" },
  section: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: "#333", marginBottom: 12 },
  emptyBox: { backgroundColor: "white", borderRadius: 14, padding: 24, alignItems: "center" },
  emptyText: { color: "#999", fontSize: 14, textAlign: "center" },
  activityCard: { backgroundColor: "white", borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: PRIMARY },
  activityDesc: { fontSize: 13, color: "#333", marginBottom: 2 },
  activityTime: { fontSize: 11, color: "#999" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 32, padding: 16, backgroundColor: "#fef2f2", borderRadius: 14 },
  logoutText: { color: "#ef4444", fontWeight: "bold", fontSize: 15 },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  badgeCard: { width: "47%", backgroundColor: "white", borderRadius: 14, padding: 14, alignItems: "center", elevation: 1, borderWidth: 1.5, borderColor: PRIMARY + "40" },
  badgeCardLocked: { borderColor: "#e5e7eb", backgroundColor: "#fafafa" },
  badgeIcon: { fontSize: 32, marginBottom: 8 },
  badgeName: { fontSize: 13, fontWeight: "bold", color: "#333", textAlign: "center", marginBottom: 4 },
  badgeDesc: { fontSize: 11, color: "#999", textAlign: "center", marginBottom: 8, lineHeight: 16 },
  badgeXP: { backgroundColor: PRIMARY + "20", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  badgeXPText: { fontSize: 11, color: PRIMARY, fontWeight: "bold" },
  leaderCard: { backgroundColor: "white", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8, elevation: 1 },
  leaderCardMe: { borderWidth: 2, borderColor: PRIMARY },
  leaderRank: { fontSize: 20, width: 36, textAlign: "center" },
  leaderAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center" },
  leaderAvatarText: { color: "white", fontWeight: "bold", fontSize: 16 },
  leaderName: { fontSize: 14, fontWeight: "bold", color: "#333" },
  leaderSub: { fontSize: 12, color: "#999", marginTop: 2 },
  leaderXP: { alignItems: "flex-end" },
  leaderXPText: { fontSize: 16, fontWeight: "bold", color: PRIMARY },
  leaderXPLabel: { fontSize: 10, color: "#999" },
});