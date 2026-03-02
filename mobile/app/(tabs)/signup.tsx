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
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!fullName || !email || !password) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    try {
      setLoading(true);
      await signUp(email, password, fullName);
      Alert.alert("Success", "Account created! You can now log in.");
      router.replace("/");
    } catch (error: any) {
      Alert.alert("Signup Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

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
              placeholder="Create Password"
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

          <Text style={styles.terms}>
            By signing up, you agree to our Terms of Service and Privacy Policy.
          </Text>

          <TouchableOpacity style={styles.button} onPress={handleSignup} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Text style={styles.buttonText}>Sign Up</Text>
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
  questText: {
    fontWeight: "600",
  },
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
  progressSub: {
    fontSize: 12,
    color: "#666",
  },
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
  footerText: {
    color: "#666",
  },
  loginText: {
    color: PRIMARY,
    fontWeight: "bold",
  },
});