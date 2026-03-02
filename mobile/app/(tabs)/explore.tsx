import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const PRIMARY = "#9cd21f";

const CATEGORIES = ["All", "Physics", "Math", "Computer Science", "Chemistry", "Biology"];

const COURSES = [
  { id: 1, title: "Quantum Basics", subject: "Physics", lessons: 12, level: "Beginner", icon: "science" },
  { id: 2, title: "Calculus I", subject: "Math", lessons: 20, level: "Intermediate", icon: "calculate" },
  { id: 3, title: "Data Structures", subject: "Computer Science", lessons: 15, level: "Intermediate", icon: "computer" },
  { id: 4, title: "Organic Chemistry", subject: "Chemistry", lessons: 18, level: "Advanced", icon: "biotech" },
  { id: 5, title: "Linear Algebra", subject: "Math", lessons: 14, level: "Intermediate", icon: "calculate" },
  { id: 6, title: "Cell Biology", subject: "Biology", lessons: 10, level: "Beginner", icon: "local-florist" },
  { id: 7, title: "Thermodynamics", subject: "Physics", lessons: 16, level: "Advanced", icon: "science" },
  { id: 8, title: "Algorithms", subject: "Computer Science", lessons: 22, level: "Advanced", icon: "computer" },
];

export default function Explore() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filtered = COURSES.filter((course) => {
    const matchesSearch = course.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || course.subject === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getLevelColor = (level: string) => {
    switch (level) {
      case "Beginner": return "#22c55e";
      case "Intermediate": return "#f97316";
      case "Advanced": return "#ef4444";
      default: return "#666";
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f7f8f6" }}>
      <ScrollView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Explore Courses</Text>
          <Text style={styles.headerSubtitle}>Find your next learning adventure</Text>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search courses..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
          contentContainerStyle={styles.categoriesContent}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryChip,
                selectedCategory === cat && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === cat && styles.categoryTextActive,
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Results count */}
        <Text style={styles.resultsText}>
          {filtered.length} course{filtered.length !== 1 ? "s" : ""} found
        </Text>

        {/* Course List */}
        <View style={styles.courseList}>
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No courses found</Text>
              <Text style={styles.emptySubtext}>Try a different search or category</Text>
            </View>
          ) : (
            filtered.map((course) => (
              <TouchableOpacity
                key={course.id}
                style={styles.courseCard}
                onPress={() => router.push("/(tabs)/course" as any)}
              >
                <View style={styles.courseIconBox}>
                  <MaterialIcons
                    name={course.icon as any}
                    size={26}
                    color={PRIMARY}
                  />
                </View>

                <View style={styles.courseInfo}>
                  <Text style={styles.courseTitle}>{course.title}</Text>
                  <Text style={styles.courseSubject}>{course.subject}</Text>
                  <View style={styles.courseMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name="book-outline" size={12} color="#999" />
                      <Text style={styles.metaText}>{course.lessons} lessons</Text>
                    </View>
                    <View
                      style={[
                        styles.levelBadge,
                        { backgroundColor: getLevelColor(course.level) + "20" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.levelText,
                          { color: getLevelColor(course.level) },
                        ]}
                      >
                        {course.level}
                      </Text>
                    </View>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f8f6",
  },
  header: {
    backgroundColor: "white",
    padding: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  headerSubtitle: {
    color: "#666",
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    margin: 16,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    elevation: 2,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },
  categoriesContainer: {
    marginBottom: 8,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  categoryText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  categoryTextActive: {
    color: "white",
    fontWeight: "bold",
  },
  resultsText: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: "#666",
    fontSize: 13,
  },
  courseList: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  courseCard: {
    backgroundColor: "white",
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    elevation: 1,
  },
  courseIconBox: {
    width: 50,
    height: 50,
    borderRadius: 14,
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
    fontSize: 15,
    color: "#333",
    marginBottom: 2,
  },
  courseSubject: {
    fontSize: 12,
    color: "#999",
    marginBottom: 6,
  },
  courseMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: "#999",
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  levelText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#ccc",
    marginTop: 16,
  },
  emptySubtext: {
    color: "#ccc",
    marginTop: 4,
  },
});
