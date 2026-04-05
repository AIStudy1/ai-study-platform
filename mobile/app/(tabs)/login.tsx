import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/supabaseConfig";

const PRIMARY = "#9cd21f";

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [secure, setSecure] = useState(true);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    try {
      setLoading(true);
      await signIn(email, password);
    } catch (error: any) {
      Alert.alert("Login Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!email.trim()) {
      Alert.alert(
        "Forgot Password",
        "Please enter your email address first, then tap Forgot Password.",
        [{ text: "OK" }]
      );
      return;
    }

    Alert.alert(
      "Reset Password",
      `Send a password reset link to:\n${email}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Reset Link",
          onPress: async () => {
            try {
              setResetLoading(true);
              const { error } = await supabase.auth.resetPasswordForEmail(
                email.trim(),
                {
                  redirectTo: "aistudy://reset-password",
                }
              );
              if (error) throw error;
              Alert.alert(
                "Email Sent! 📧",
                "Check your inbox for the password reset link.",
                [{ text: "OK" }]
              );
            } catch (error: any) {
              Alert.alert("Error", error.message || "Could not send reset email");
            } finally {
              setResetLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.heroSection}>
        <View style={styles.logoCircle}>
          <Ionicons name="school-outline" size={30} color="white" />
        </View>
        <Text style={styles.brand}>AiStudy</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Sign in to continue</Text>
        <Text style={styles.subtitle}>Keep progressing on your learning journey</Text>

        <View style={styles.inputContainer}>
          <Ionicons name="mail-outline" size={18} color="#777" />
          <TextInput
            style={styles.input}
            placeholder="Email address"
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
            placeholder="Password"
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

        {/* Forgot Password */}
        <TouchableOpacity
          style={styles.forgotRow}
          onPress={handleForgotPassword}
          disabled={resetLoading}
        >
          {resetLoading ? (
            <ActivityIndicator size="small" color={PRIMARY} />
          ) : (
            <Text style={styles.forgotText}>Forgot password?</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Text style={styles.footerText}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => router.push("/signup" as any)}>
            <Text style={styles.signupText}> Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f8f6",
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 30,
  },
  logoCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  brand: {
    fontSize: 20,
    fontWeight: "bold",
    color: PRIMARY,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 20,
    padding: 24,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 6,
  },
  subtitle: {
    color: "#666",
    marginBottom: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f3f0",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 14,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    marginLeft: 8,
  },
  forgotRow: {
    alignItems: "flex-end",
    marginBottom: 16,
    marginTop: -6,
  },
  forgotText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "600",
  },
  button: {
    backgroundColor: PRIMARY,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 6,
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
  signupText: {
    color: PRIMARY,
    fontWeight: "bold",
  },
});