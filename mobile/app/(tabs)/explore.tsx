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

const STATS = [
  { label: "Courses", value: "120+" },
  { label: "Students", value: "1.2K+" },
  { label: "Subjects", value: "20+" },
];

const CATEGORIES = [
  { label: "All", icon: "apps" },
  { label: "Physics", icon: "science" },
  { label: "Math", icon: "calculate" },
  { label: "CS", icon: "computer" },
  { label: "Chemistry", icon: "biotech" },
  { label: "Biology", icon: "local-florist" },
];

const FEATURED = [
  { id: 1, title: "Quantum Mechanics", subject: "Physics", level: "Advanced", duration: "8h", icon: "science", color: "#3b82f6" },
  { id: 2, title: "Machine Learning", subject: "CS", level: "Intermediate", duration: "12h", icon: "computer", color: "#8b5cf6" },
  { id: 3, title: "Organic Chemistry", subject: "Chemistry", level: "Advanced", duration: "10h", icon: "biotech", color: "#f97316" },
];

const COURSES = [
  { id: 1, title: "Quantum Basics", subject: "Physics", lessons: 12, level: "Beginner", duration: "4h", icon: "science", students: 234 },
  { id: 2, title: "Calculus I", subject: "Math", lessons: 20, level: "Intermediate", duration: "8h", icon: "calculate", students: 567 },
  { id: 3, title: "Data Structures", subject: "CS", lessons: 15, level: "Intermediate", duration: "6h", icon: "computer", students: 432 },
  { id: 4, title: "Organic Chemistry", subject: "Chemistry", lessons: 18, level: "Advanced", duration: "10h", icon: "biotech", students: 123 },
  { id: 5, title: "Linear Algebra", subject: "Math", lessons: 14, level: "Intermediate", duration: "5h", icon: "calculate", students: 321 },
  { id: 6, title: "Cell Biology", subject: "Biology", lessons: 10, level: "Beginner", duration: "3h", icon: "local-florist", students: 198 },
  { id: 7, title: "Thermodynamics", subject: "Physics", lessons: 16, level: "Advanced", duration: "7h", icon: "science", students: 145 },
  { id: 8, title: "Algorithms", subject: "CS", lessons: 22, level: "Advanced", duration: "9h", icon: "computer", students: 389 },
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
          <View>
            <Text style={styles.headerTitle}>Explore</Text>
            <Text style={styles.headerSubtitle}>Discover and learn something new</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="sparkles" size={22} color={PRIMARY} />
          </View>
        </View>

        {/* Stats Banner */}
        <View style={styles.statsBanner}>
          {STATS.map((stat, index) => (
            <View key={stat.label} style={styles.statItem}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
              {index < STATS.length - 1 && (
                <View style={styles.statDivider} />
              )}
            </View>
          ))}
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
          contentContainerStyle={styles.categoriesContent}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.label}
              style={[
                styles.categoryChip,
                selectedCategory === cat.label && styles.categoryChipActive,
              ]}
              onPress={() => setSelectedCategory(cat.label)}
            >
              <MaterialIcons
                name={cat.icon as any}
                size={16}
                color={selectedCategory === cat.label ? "white" : "#666"}
              />
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === cat.label && styles.categoryTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Featured Courses */}
        {selectedCategory === "All" && search === "" && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>⭐ Featured</Text>
              <Text style={styles.seeAll}>See all</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredContent}
            >
              {FEATURED.map((course) => (
                <TouchableOpacity
                  key={course.id}
                  style={[styles.featuredCard, { backgroundColor: course.color }]}
                  onPress={() => router.push("/(tabs)/course" as any)}
                >
                  <View style={styles.featuredIconBox}>
                    <MaterialIcons name={course.icon as any} size={28} color="white" />
                  </View>
                  <Text style={styles.featuredTitle}>{course.title}</Text>
                  <Text style={styles.featuredSubject}>{course.subject}</Text>
                  <View style={styles.featuredMeta}>
                    <View style={styles.featuredBadge}>
                      <Text style={styles.featuredBadgeText}>{course.level}</Text>
                    </View>
                    <Text style={styles.featuredDuration}>⏱ {course.duration}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* AI Generate Banner */}
        {selectedCategory === "All" && search === "" && (
          <TouchableOpacity
            style={styles.aiBanner}
            onPress={() => router.push("/(tabs)/ai" as any)}
          >
            <View style={styles.aiBannerLeft}>
              <View style={styles.aiIconBox}>
                <Ionicons name="sparkles" size={24} color="white" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.aiBannerTitle}>Ask AI to build your course</Text>
                <Text style={styles.aiBannerSubtitle}>
                  Tell AI what you want to learn → get a full study plan
                </Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={20} color="white" />
          </TouchableOpacity>
        )}

        {/* Upload Banner */}
        {selectedCategory === "All" && search === "" && (
          <TouchableOpacity style={styles.uploadBanner}>
            <View style={styles.aiBannerLeft}>
              <View style={[styles.aiIconBox, { backgroundColor: "#3b82f6" }]}>
                <Ionicons name="cloud-upload" size={24} color="white" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.aiBannerTitle}>Upload your course material</Text>
                <Text style={styles.aiBannerSubtitle}>
                  PDF, slides or notes → AI builds your study plan
                </Text>
              </View>
            </View>
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Soon</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* All Courses */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {selectedCategory === "All" ? "All Courses" : selectedCategory}
            </Text>
            <Text style={styles.resultsText}>{filtered.length} found</Text>
          </View>

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
                  <MaterialIcons name={course.icon as any} size={26} color={PRIMARY} />
                </View>
                <View style={styles.courseInfo}>
                  <Text style={styles.courseTitle}>{course.title}</Text>
                  <Text style={styles.courseSubject}>{course.subject}</Text>
                  <View style={styles.courseMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name="book-outline" size={12} color="#999" />
                      <Text style={styles.metaText}>{course.lessons} lessons</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="time-outline" size={12} color="#999" />
                      <Text style={styles.metaText}>{course.duration}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="people-outline" size={12} color="#999" />
                      <Text style={styles.metaText}>{course.students}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.courseRight}>
                  <View
                    style={[
                      styles.levelBadge,
                      { backgroundColor: getLevelColor(course.level) + "20" },
                    ]}
                  >
                    <Text style={[styles.levelText, { color: getLevelColor(course.level) }]}>
                      {course.level}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#ccc" style={{ marginTop: 8 }} />
                </View>
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    backgroundColor: "white",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#333",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: PRIMARY + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  statsBanner: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "white",
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: PRIMARY,
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  statDivider: {
    position: "absolute",
    right: 0,
    top: "10%",
    width: 1,
    height: "80%",
    backgroundColor: "#e5e7eb",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    marginHorizontal: 16,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    textAlignVertical: "center",
  },
  categoriesContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 8,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginRight: 8,
    gap: 6,
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
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  seeAll: {
    fontSize: 13,
    fontWeight: "600",
    color: PRIMARY,
  },
  resultsText: {
    fontSize: 13,
    color: "#999",
  },
  featuredContent: {
    gap: 12,
    paddingBottom: 4,
  },
  featuredCard: {
    width: 200,
    borderRadius: 16,
    padding: 16,
    marginRight: 4,
  },
  featuredIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  featuredTitle: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 4,
  },
  featuredSubject: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    marginBottom: 12,
  },
  featuredMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  featuredBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  featuredBadgeText: {
    color: "white",
    fontSize: 11,
    fontWeight: "bold",
  },
  featuredDuration: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
  },
  aiBanner: {
    backgroundColor: "#1a1a2e",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: PRIMARY + "40",
  },
  uploadBanner: {
    backgroundColor: "#f0f9ff",
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#3b82f640",
  },
  aiBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  aiIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  aiBannerTitle: {
    color: "#333",
    fontWeight: "bold",
    fontSize: 14,
  },
  aiBannerSubtitle: {
    color: "#666",
    fontSize: 12,
    marginTop: 2,
  },
  comingSoonBadge: {
    backgroundColor: "#3b82f620",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  comingSoonText: {
    fontSize: 11,
    color: "#3b82f6",
    fontWeight: "bold",
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
    backgroundColor: PRIMARY + "20",
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
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    color: "#999",
  },
  courseRight: {
    alignItems: "flex-end",
  },
  levelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  levelText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    backgroundColor: "white",
    borderRadius: 16,
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