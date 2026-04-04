import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";

const PRIMARY = "#9cd21f";

export default function Signup() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [secure, setSecure] = useState(true);
  const [secureConfirm, setSecureConfirm] = useState(true);
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSignup = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      await signUp(email, password, fullName);
      setEmailSent(true);
    } catch (error: any) {
      Alert.alert("Signup Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  // Show email sent confirmation screen
  if (emailSent) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
        <View style={styles.emailSentContainer}>
          <View style={styles.emailSentIcon}>
            <Ionicons name="mail" size={48} color={PRIMARY} />
          </View>
          <Text style={styles.emailSentTitle}>Check your email! 📧</Text>
          <Text style={styles.emailSentSubtitle}>
            We sent a verification link to:
          </Text>
          <Text style={styles.emailSentEmail}>{email}</Text>
          <Text style={styles.emailSentNote}>
            Click the link in the email to verify your account, then come back and log in.
          </Text>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.replace("/" as any)}
          >
            <Ionicons name="arrow-forward" size={18} color="white" />
            <Text style={styles.loginButtonText}>Go to Login</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resendButton}
            onPress={() => setEmailSent(false)}
          >
            <Text style={styles.resendText}>Didn't receive it? Try again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* Logo */}
        <View style={styles.logoRow}>
          <Ionicons name="sparkles" size={28} color={PRIMARY} />
          <Text style={styles.logoText}>AiStudy</Text>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressTop}>
            <Text style={styles.questText}>Your Quest Begins!</Text>
            <Text style={styles.stepBadge}>Step 1 of 2</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={styles.progressBarFill} />
          </View>
          <Text style={styles.progressSub}>
            Join the quest for knowledge and unlock your potential!
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Create Account</Text>

          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={18} color="#777" />
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#999"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={18} color="#777" />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={18} color="#777" />
            <TextInput
              style={styles.input}
              placeholder="Create Password (min 6 chars)"
              placeholderTextColor="#999"
              secureTextEntry={secure}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setSecure(!secure)}>
              <Ionicons
                name={secure ? "eye-off-outline" : "eye-outline"}
                size={18}
                color="#777"
              />
            </TouchableOpacity>
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={18} color="#777" />
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#999"
              secureTextEntry={secureConfirm}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            <TouchableOpacity onPress={() => setSecureConfirm(!secureConfirm)}>
              <Ionicons
                name={secureConfirm ? "eye-off-outline" : "eye-outline"}
                size={18}
                color="#777"
              />
            </TouchableOpacity>
          </View>

          <Text style={styles.terms}>
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={handleSignup}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Text style={styles.buttonText}>Create Account</Text>
                <Ionicons name="rocket-outline" size={18} color="white" />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.replace("/")}>
              <Text style={styles.loginText}> Login</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },
  logoText: {
    fontSize: 22,
    fontWeight: "bold",
    color: PRIMARY,
  },
  progressSection: {
    marginBottom: 30,
  },
  progressTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  questText: { fontWeight: "600" },
  stepBadge: {
    backgroundColor: PRIMARY + "20",
    color: PRIMARY,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    fontSize: 12,
    fontWeight: "bold",
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressBarFill: {
    width: "50%",
    height: "100%",
    backgroundColor: PRIMARY,
  },
  progressSub: { fontSize: 12, color: "#666" },
  card: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 16,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 15,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    marginLeft: 10,
    color: "#333",
    textAlignVertical: "center",
  },
  terms: {
    fontSize: 12,
    color: "#666",
    marginBottom: 20,
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
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  footerText: { color: "#666" },
  loginText: {
    color: PRIMARY,
    fontWeight: "bold",
  },
  // Email sent screen
  emailSentContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emailSentIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: PRIMARY + "20",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  emailSentTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 12,
    textAlign: "center",
  },
  emailSentSubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
  emailSentEmail: {
    fontSize: 16,
    fontWeight: "bold",
    color: PRIMARY,
    marginVertical: 8,
    textAlign: "center",
  },
  emailSentNote: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 32,
    marginTop: 8,
  },
  loginButton: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    width: "100%",
    justifyContent: "center",
  },
  loginButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  resendButton: {
    paddingVertical: 12,
  },
  resendText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "600",
  },
});