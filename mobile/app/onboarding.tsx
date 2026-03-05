import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");
const PRIMARY = "#9cd21f";

const SLIDES = [
  {
    id: 1,
    icon: "sparkles",
    iconLib: "ionicons",
    color: PRIMARY,
    bgColor: "#f0f9e8",
    title: "Your Personal AI Professor",
    description:
      "Upload your course materials or connect Moodle and let AI build a personalized study plan tailored just for you.",
  },
  {
    id: 2,
    icon: "school",
    iconLib: "ionicons",
    color: "#3b82f6",
    bgColor: "#eff6ff",
    title: "Connect Your University",
    description:
      "Link your Moodle account to automatically sync all your university courses, deadlines and assignments.",
  },
  {
    id: 3,
    icon: "bar-chart",
    iconLib: "ionicons",
    color: "#8b5cf6",
    bgColor: "#f5f3ff",
    title: "Track Your Progress",
    description:
      "Complete chapters, pass quizzes, earn XP and track your performance across all your courses in one place.",
  },
  {
    id: 4,
    icon: "rocket",
    iconLib: "ionicons",
    color: "#f97316",
    bgColor: "#fff7ed",
    title: "Reach Your Goals",
    description:
      "Set your daily study goals, get a smart schedule from AI and never miss a deadline again.",
  },
];

export default function Onboarding() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = (event: any) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({
        x: (currentIndex + 1) * width,
        animated: true,
      });
      setCurrentIndex(currentIndex + 1);
    } else {
      handleGetStarted();
    }
  };

  const handleSkip = async () => {
    await AsyncStorage.setItem("onboarding_complete", "true");
    router.replace("/(tabs)/index" as any);
  };

  const handleGetStarted = async () => {
    await AsyncStorage.setItem("onboarding_complete", "true");
    router.replace("/(tabs)/index" as any);
  };

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Skip Button */}
      {!isLast && (
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {SLIDES.map((slide) => (
          <View key={slide.id} style={[styles.slide]}>
            {/* Illustration */}
            <View style={[styles.illustrationBox, { backgroundColor: slide.bgColor }]}>
              <View style={[styles.iconCircle, { backgroundColor: slide.color + "20" }]}>
                <Ionicons name={slide.icon as any} size={80} color={slide.color} />
              </View>

              {/* Decorative dots */}
              <View style={[styles.dot1, { backgroundColor: slide.color + "30" }]} />
              <View style={[styles.dot2, { backgroundColor: slide.color + "20" }]} />
              <View style={[styles.dot3, { backgroundColor: slide.color + "15" }]} />
            </View>

            {/* Text */}
            <View style={styles.textSection}>
              {/* App Logo */}
              <View style={styles.logoRow}>
                <Ionicons name="sparkles" size={18} color={PRIMARY} />
                <Text style={styles.logoText}>AiStudy</Text>
              </View>

              <Text style={styles.title}>{slide.title}</Text>
              <Text style={styles.description}>{slide.description}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom Section */}
      <View style={styles.bottom}>
        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => {
                scrollRef.current?.scrollTo({ x: index * width, animated: true });
                setCurrentIndex(index);
              }}
            >
              <View
                style={[
                  styles.dotIndicator,
                  index === currentIndex && styles.dotIndicatorActive,
                  index === currentIndex && { backgroundColor: SLIDES[currentIndex].color },
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>

        {/* Button */}
        <TouchableOpacity
          style={[
            styles.nextButton,
            { backgroundColor: SLIDES[currentIndex].color },
          ]}
          onPress={handleNext}
        >
          <Text style={styles.nextButtonText}>
            {isLast ? "Get Started" : "Next"}
          </Text>
          <Ionicons
            name={isLast ? "rocket-outline" : "arrow-forward"}
            size={20}
            color="white"
          />
        </TouchableOpacity>

        {/* Login link */}
        {isLast && (
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account?</Text>
            <TouchableOpacity onPress={handleGetStarted}>
              <Text style={[styles.loginLink, { color: SLIDES[currentIndex].color }]}>
                {" "}Log in
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  skipButton: {
    position: "absolute",
    top: 56,
    right: 20,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
  },
  skipText: {
    color: "#666",
    fontWeight: "600",
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width,
    flex: 1,
  },
  illustrationBox: {
    height: 380,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  iconCircle: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  dot1: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    top: 40,
    left: 30,
  },
  dot2: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    bottom: 60,
    right: 20,
  },
  dot3: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    top: 80,
    right: 60,
  },
  textSection: {
    paddingHorizontal: 32,
    paddingTop: 32,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  logoText: {
    fontSize: 14,
    fontWeight: "bold",
    color: PRIMARY,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 12,
    lineHeight: 34,
  },
  description: {
    fontSize: 15,
    color: "#666",
    lineHeight: 24,
  },
  bottom: {
    paddingHorizontal: 32,
    paddingBottom: 40,
    paddingTop: 20,
    alignItems: "center",
    gap: 20,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  dotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e5e7eb",
  },
  dotIndicatorActive: {
    width: 24,
    borderRadius: 4,
  },
  nextButton: {
    width: "100%",
    padding: 18,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  nextButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  loginRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  loginText: {
    color: "#666",
    fontSize: 14,
  },
  loginLink: {
    fontWeight: "bold",
    fontSize: 14,
  },
});