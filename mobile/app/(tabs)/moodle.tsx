import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { supabase } from "@/supabaseConfig";
import { useAuth } from "@/context/AuthContext";

const PRIMARY = "#9cd21f";

interface MoodleCourse {
  id: number;
  fullname: string;
  shortname: string;
  progress: number;
}

export default function MoodleConnect() {
  const router = useRouter();
  const { user } = useAuth();
  const [moodleUrl, setMoodleUrl] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [courses, setCourses] = useState<MoodleCourse[]>([]);
  const [siteName, setSiteName] = useState("");
  const [userName, setUserName] = useState("");

  const handleConnect = async () => {
    if (!moodleUrl || !token) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    const cleanUrl = moodleUrl.trim().replace(/\/$/, "");

    try {
      setLoading(true);

      const siteResponse = await fetch(
        `${cleanUrl}/webservice/rest/server.php?wstoken=${token}&wsfunction=core_webservice_get_site_info&moodlewsrestformat=json`
      );
      const siteData = await siteResponse.json();

      if (siteData.exception) {
        Alert.alert("Connection Failed", "Invalid URL or token. Please check and try again.");
        return;
      }

      setSiteName(siteData.sitename);
      setUserName(siteData.fullname);

      const coursesResponse = await fetch(
        `${cleanUrl}/webservice/rest/server.php?wstoken=${token}&wsfunction=core_enrol_get_users_courses&moodlewsrestformat=json&userid=${siteData.userid}`
      );
      const coursesData = await coursesResponse.json();

      if (Array.isArray(coursesData)) {
        setCourses(coursesData);
      }

      await supabase
        .from("moodle_connections")
        .delete()
        .eq("user_id", user?.id);

      const { error } = await supabase
        .from("moodle_connections")
        .insert({
          user_id: user?.id,
          moodle_url: cleanUrl,
          moodle_token: token,
          moodle_userid: siteData.userid,
          site_name: siteData.sitename,
        });

      if (error) {
        console.error("Supabase save error:", error);
        Alert.alert("Warning", "Courses loaded but could not be saved. Try again.");
      }

      setConnected(true);

    } catch (error) {
      Alert.alert("Error", "Could not reach your Moodle server. Check the URL and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoBox}>
            <Ionicons name="school" size={40} color="white" />
          </View>
          <Text style={styles.heroTitle}>Link Your University</Text>
          <Text style={styles.heroSubtitle}>
            Connect your Moodle account to sync your courses automatically.
          </Text>
        </View>

        {!connected ? (
          <>
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>📋 How to get your token:</Text>
              <Text style={styles.infoStep}>1. Log into your university Moodle</Text>
              <Text style={styles.infoStep}>2. Click your profile picture</Text>
              <Text style={styles.infoStep}>3. Go to Preferences → Security Keys</Text>
              <Text style={styles.infoStep}>4. Copy the Moodle mobile web service token</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>University Moodle URL</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="globe-outline" size={18} color="#777" />
                <TextInput
                  style={styles.input}
                  placeholder="https://moodle.youruniversity.com"
                  placeholderTextColor="#999"
                  value={moodleUrl}
                  onChangeText={setMoodleUrl}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>

              <Text style={styles.label}>Your Moodle Token</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="key-outline" size={18} color="#777" />
                <TextInput
                  style={styles.input}
                  placeholder="Paste your token here"
                  placeholderTextColor="#999"
                  value={token}
                  onChangeText={setToken}
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={handleConnect}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <>
                    <Ionicons name="link-outline" size={20} color="white" />
                    <Text style={styles.buttonText}>Connect Moodle</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <View style={styles.successCard}>
              <Ionicons name="checkmark-circle" size={48} color="#22c55e" />
              <Text style={styles.successTitle}>Connected!</Text>
              <Text style={styles.successSubtitle}>
                {userName} • {siteName}
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Your Courses ({courses.length})
              </Text>

              {courses.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>No courses found</Text>
                </View>
              ) : (
                courses.map((course) => (
                  <View key={course.id} style={styles.courseCard}>
                    <View style={styles.courseIcon}>
                      <MaterialIcons name="book" size={22} color={PRIMARY} />
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
                                { width: `${course.progress}%` },
                              ]}
                            />
                          </View>
                          <Text style={styles.progressText}>
                            {Math.round(course.progress)}% Complete
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>

            <TouchableOpacity
              style={styles.dashboardButton}
              onPress={() => router.replace("/(tabs)/dashboard" as any)}
            >
              <Text style={styles.dashboardButtonText}>Go to Dashboard</Text>
              <Ionicons name="arrow-forward" size={20} color="white" />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: "#f7f8f6",
    padding: 20,
  },
  hero: {
    alignItems: "center",
    marginBottom: 24,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  heroSubtitle: {
    color: "#666",
    textAlign: "center",
    lineHeight: 22,
  },
  infoBox: {
    backgroundColor: "#f0f9e8",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY,
  },
  infoTitle: {
    fontWeight: "bold",
    marginBottom: 8,
    fontSize: 14,
  },
  infoStep: {
    color: "#555",
    fontSize: 13,
    marginBottom: 4,
    lineHeight: 20,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    elevation: 3,
  },
  label: {
    fontWeight: "600",
    marginBottom: 8,
    color: "#333",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    marginLeft: 10,
    fontSize: 14,
  },
  button: {
    backgroundColor: PRIMARY,
    padding: 16,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  successCard: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
    elevation: 2,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 12,
    color: "#22c55e",
  },
  successSubtitle: {
    color: "#666",
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    color: "#999",
  },
  courseCard: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
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
    marginBottom: 6,
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
  dashboardButton: {
    backgroundColor: PRIMARY,
    padding: 16,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 40,
  },
  dashboardButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
});