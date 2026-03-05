import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { AuthProvider, useAuth } from "@/context/AuthContext";

function RootLayoutNav() {
  const { session, loading } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();
  const colorScheme = useColorScheme();
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      const complete = await AsyncStorage.getItem("onboarding_complete");
      if (!complete) {
        router.replace("/onboarding" as any);
      }
      setOnboardingChecked(true);
    };
    checkOnboarding();
  }, []);

  useEffect(() => {
    if (!onboardingChecked || loading) return;

    const segment = segments[1] || "";
    const authScreens = ["index", "login", "signup"];
    const isOnAuthScreen =
      segments[0] !== "(tabs)" || authScreens.includes(segment);

    if (!session && !isOnAuthScreen) {
      router.replace("/");
    } else if (session && isOnAuthScreen) {
      router.replace("/(tabs)/dashboard" as any);
    }
  }, [session, loading, segments, onboardingChecked]);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </SafeAreaProvider>
  );
}