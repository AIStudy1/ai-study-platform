import React from "react";
import { StyleSheet } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";

export default function DiagnosticScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Diagnostic</ThemedText>
      <ThemedText style={styles.subtitle}>
        This screen was empty and is now a valid Expo Router route.
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  subtitle: {
    marginTop: 12,
    textAlign: "center",
  },
});