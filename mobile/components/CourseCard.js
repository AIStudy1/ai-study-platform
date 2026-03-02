import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { MaterialIcons, Ionicons } from "@expo/vector-icons";

const PRIMARY = "#9cd21f";

export default function CourseCard({ title, subject, progress, onPress }) {
  const getIcon = () => {
    switch (subject) {
      case "physics":
        return <MaterialIcons name="science" size={24} color={PRIMARY} />;
      case "math":
        return <MaterialIcons name="calculate" size={24} color={PRIMARY} />;
      case "computer":
        return <MaterialIcons name="computer" size={24} color={PRIMARY} />;
      case "chemistry":
        return <MaterialIcons name="biotech" size={24} color={PRIMARY} />;
      default:
        return <MaterialIcons name="book" size={24} color={PRIMARY} />;
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.iconBox}>{getIcon()}</View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${Math.min(progress ?? 0, 100)}%` },
            ]}
          />
        </View>

        <Text style={styles.progressText}>{progress ?? 0}% Complete</Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f0f9e8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  title: {
    fontWeight: "bold",
    fontSize: 14,
    marginBottom: 6,
    color: "#333",
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
});