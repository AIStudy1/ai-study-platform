import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiGetProfile, apiUpdateProfile, apiGetGoal, apiUpdateGoal } from "@/services/api";

const PRIMARY = "#9cd21f";

export default function Settings() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  const [fullName, setFullName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [goalMinutes, setGoalMinutes] = useState(30);
  const [notifications, setNotifications] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingGoal, setSavingGoal] = useState(false);
  const [loading, setLoading] = useState(true);

  const goalOptions = [15, 30, 60, 90];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [profileRes, goalRes] = await Promise.all([
        apiGetProfile(),
        apiGetGoal(),
      ]);
      if (profileRes.data) {
        setFullName(profileRes.data.full_name || "");
        setOriginalName(profileRes.data.full_name || "");
      }
      if (goalRes.data) {
        setGoalMinutes(goalRes.data.goal_minutes || 30);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!fullName.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }
    if (fullName.trim() === originalName) {
      Alert.alert("No changes", "Your name is already up to date");
      return;
    }
    try {
      setSavingName(true);
      await apiUpdateProfile({ full_name: fullName.trim() });
      setOriginalName(fullName.trim());
      Alert.alert("Success", "Name updated successfully!");
    } catch (error: any) {
      Alert.alert("Error", error.message || "Could not update name");
    } finally {
      setSavingName(false);
    }
  };

  const handleSaveGoal = async (minutes: number) => {
    try {
      setSavingGoal(true);
      setGoalMinutes(minutes);
      await apiUpdateGoal(minutes);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Could not update goal");
    } finally {
      setSavingGoal(false);
    }
  };

  const handleChangePassword = () => {
    Alert.alert(
      "Change Password",
      "A password reset email will be sent to " + user?.email,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Email",
          onPress: async () => {
            Alert.alert("Sent!", "Check your email for the reset link.");
          },
        },
      ]
    );
  };

  const handleReplayOnboarding = async () => {
    await AsyncStorage.removeItem("onboarding_complete");
    router.replace("/onboarding" as any);
  };

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/");
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      <ScrollView style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              placeholderTextColor="#999"
            />
            <TouchableOpacity
              style={[
                styles.saveButton,
                fullName.trim() === originalName && styles.saveButtonDisabled,
              ]}
              onPress={handleSaveName}
              disabled={savingName || fullName.trim() === originalName}
            >
              {savingName ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.saveButtonText}>Save Name</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.lockedValue}>{user?.email}</Text>
            <Text style={styles.lockedNote}>Email cannot be changed</Text>
          </View>

          <TouchableOpacity style={styles.rowCard} onPress={handleChangePassword}>
            <View style={styles.rowLeft}>
              <View style={[styles.rowIcon, { backgroundColor: "#ef444420" }]}>
                <Ionicons name="lock-closed-outline" size={18} color="#ef4444" />
              </View>
              <Text style={styles.rowLabel}>Change Password</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Study Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Study Preferences</Text>

          <View style={styles.card}>
            <View style={styles.goalHeader}>
              <Text style={styles.fieldLabel}>Daily Study Goal</Text>
              {savingGoal && <ActivityIndicator size="small" color={PRIMARY} />}
            </View>
            <Text style={styles.goalSubtitle}>
              Currently: {goalMinutes} minutes per day
            </Text>
            <View style={styles.goalChips}>
              {goalOptions.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.goalChip,
                    goalMinutes === option && styles.goalChipActive,
                  ]}
                  onPress={() => handleSaveGoal(option)}
                >
                  <Text
                    style={[
                      styles.goalChipText,
                      goalMinutes === option && styles.goalChipTextActive,
                    ]}
                  >
                    {option}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* App Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Preferences</Text>

          <View style={styles.rowCard}>
            <View style={styles.rowLeft}>
              <View style={[styles.rowIcon, { backgroundColor: PRIMARY + "20" }]}>
                <Ionicons name="notifications-outline" size={18} color={PRIMARY} />
              </View>
              <View>
                <Text style={styles.rowLabel}>Push Notifications</Text>
                <Text style={styles.rowSubtitle}>Study reminders & updates</Text>
              </View>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: "#e5e7eb", true: PRIMARY }}
              thumbColor="white"
            />
          </View>
        </View>

        {/* Integrations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Integrations</Text>

          <TouchableOpacity
            style={styles.rowCard}
            onPress={() => router.push("/(tabs)/moodle" as any)}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.rowIcon, { backgroundColor: PRIMARY + "20" }]}>
                <Ionicons name="school-outline" size={18} color={PRIMARY} />
              </View>
              <View>
                <Text style={styles.rowLabel}>Moodle Connection</Text>
                <Text style={styles.rowSubtitle}>Manage university sync</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>

          <View style={styles.rowCard}>
            <View style={styles.rowLeft}>
              <View style={[styles.rowIcon, { backgroundColor: "#8b5cf620" }]}>
                <Ionicons name="information-circle-outline" size={18} color="#8b5cf6" />
              </View>
              <Text style={styles.rowLabel}>App Version</Text>
            </View>
            <Text style={styles.versionText}>1.0.0</Text>
          </View>

          <TouchableOpacity style={styles.rowCard} onPress={handleReplayOnboarding}>
            <View style={styles.rowLeft}>
              <View style={[styles.rowIcon, { backgroundColor: "#3b82f620" }]}>
                <Ionicons name="play-circle-outline" size={18} color="#3b82f6" />
              </View>
              <Text style={styles.rowLabel}>Replay Onboarding</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.rowCard}>
            <View style={styles.rowLeft}>
              <View style={[styles.rowIcon, { backgroundColor: "#f9731620" }]}>
                <Ionicons name="document-text-outline" size={18} color="#f97316" />
              </View>
              <Text style={styles.rowLabel}>Terms of Service</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.rowCard}>
            <View style={styles.rowLeft}>
              <View style={[styles.rowIcon, { backgroundColor: "#22c55e20" }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#22c55e" />
              </View>
              <Text style={styles.rowLabel}>Privacy Policy</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="white" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        {/* Branding */}
        <Text style={styles.branding}>AiStudy • Made for students 🎓</Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f8f6" },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: { color: "#999", fontSize: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "white",
    elevation: 2,
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: "#333" },
  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#333",
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: PRIMARY,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  saveButtonDisabled: { backgroundColor: "#ccc" },
  saveButtonText: { color: "white", fontWeight: "bold", fontSize: 14 },
  lockedValue: { fontSize: 15, color: "#333", marginBottom: 4 },
  lockedNote: { fontSize: 12, color: "#999" },
  rowCard: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { fontSize: 14, fontWeight: "600", color: "#333" },
  rowSubtitle: { fontSize: 12, color: "#999", marginTop: 2 },
  versionText: { fontSize: 13, color: "#999" },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  goalSubtitle: { fontSize: 12, color: "#999", marginBottom: 12 },
  goalChips: { flexDirection: "row", gap: 10 },
  goalChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
  },
  goalChipActive: { backgroundColor: PRIMARY },
  goalChipText: { fontWeight: "bold", color: "#999" },
  goalChipTextActive: { color: "white" },
  logoutButton: {
    backgroundColor: "red",
    margin: 16,
    marginTop: 24,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 8,
  },
  logoutText: { color: "white", fontWeight: "bold", fontSize: 16 },
  branding: {
    textAlign: "center",
    color: "#ccc",
    fontSize: 12,
    marginBottom: 40,
    marginTop: 8,
  },
});