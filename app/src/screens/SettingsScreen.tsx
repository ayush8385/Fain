import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { clearSession } from "../state/auth";

interface Props {
  onSignOut: () => void;
}

export function SettingsScreen({ onSignOut }: Props) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  function handleSignOut() {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await clearSession();
          queryClient.clear();
          onSignOut();
        },
      },
    ]);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <Text style={styles.heading}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Account</Text>
        <TouchableOpacity style={styles.row} onPress={handleSignOut}>
          <Text style={styles.rowText}>Sign out</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>Fain — AI-assisted finance tracker</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", paddingHorizontal: 16 },
  heading: { fontSize: 26, fontWeight: "700", color: "#F8FAFC", marginBottom: 24 },
  section: { backgroundColor: "#1E293B", borderRadius: 12, marginBottom: 16, overflow: "hidden" },
  sectionLabel: { color: "#64748B", fontSize: 12, fontWeight: "600", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: "#0F172A",
  },
  rowText: { color: "#EF4444", fontSize: 15 },
  arrow: { color: "#64748B", fontSize: 20 },
  footer: { color: "#334155", fontSize: 12, textAlign: "center", marginTop: "auto", paddingBottom: 24 },
});
