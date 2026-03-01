import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function Course() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Course Details</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Course Info */}
      <View style={styles.courseCard}>
        <Text style={styles.courseTitle}>Physics: Quantum Basics</Text>
        <Text style={styles.courseDescription}>
          Explore the fundamentals of quantum mechanics including wave-particle
          duality, uncertainty principle, and quantum states.
        </Text>

        {/* Progress */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBackground}>
            <View style={styles.progressBarFill} />
          </View>
          <Text style={styles.progressText}>60% Completed</Text>
        </View>

        <TouchableOpacity style={styles.startButton}>
          <Text style={styles.startButtonText}>Continue Learning</Text>
        </TouchableOpacity>
      </View>

      {/* Modules */}
      <View style={styles.moduleSection}>
        <Text style={styles.sectionTitle}>Modules</Text>

        {[
          "Introduction to Quantum Theory",
          "Wave-Particle Duality",
          "Schrödinger Equation",
          "Quantum Entanglement",
        ].map((module, index) => (
          <View key={index} style={styles.moduleCard}>
            <Text style={styles.moduleTitle}>{module}</Text>
          </View>
        ))}
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
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      backgroundColor: "white",
    },
  
    headerTitle: {
      fontSize: 18,
      fontWeight: "bold",
    },
  
    courseCard: {
      backgroundColor: "white",
      padding: 20,
      margin: 16,
      borderRadius: 16,
    },
  
    courseTitle: {
      fontSize: 22,
      fontWeight: "bold",
      marginBottom: 10,
    },
  
    courseDescription: {
      color: "#666",
      marginBottom: 20,
    },
  
    progressContainer: {
      marginBottom: 16,
    },
  
    progressBarBackground: {
      height: 10,
      backgroundColor: "#e5e7eb",
      borderRadius: 20,
    },
  
    progressBarFill: {
      height: 10,
      width: "60%",
      backgroundColor: "#9cd21f",
      borderRadius: 20,
    },
  
    progressText: {
      marginTop: 6,
      fontSize: 12,
      color: "#666",
    },
  
    startButton: {
      backgroundColor: "#9cd21f",
      padding: 14,
      borderRadius: 12,
      alignItems: "center",
    },
  
    startButtonText: {
      color: "white",
      fontWeight: "bold",
    },
  
    moduleSection: {
      paddingHorizontal: 16,
    },
  
    sectionTitle: {
      fontSize: 18,
      fontWeight: "bold",
      marginBottom: 12,
    },
  
    moduleCard: {
      backgroundColor: "white",
      padding: 14,
      borderRadius: 12,
      marginBottom: 10,
    },
  
    moduleTitle: {
      fontWeight: "500",
    },
  });
  