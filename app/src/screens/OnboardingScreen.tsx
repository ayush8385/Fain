import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, Alert, TextInput } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_BASE } from "../api/client";
import { saveSession } from "../state/auth";

interface Props {
  onAuthenticated: () => void;
}

export function OnboardingScreen({ onAuthenticated }: Props) {
  const insets = useSafeAreaInsets();
  const [devToken, setDevToken] = useState("");

  async function handleConnectGmail() {
    try {
      const res = await fetch(`${API_BASE}/auth/google/url`);
      const { url } = await res.json();
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Could not reach the Fain server. Make sure the backend is running.");
    }
  }

  // In a real build this would be handled via a deep-link URL scheme (fain://auth?token=...).
  // For now we expose a manual token paste flow for local testing.
  async function handlePasteToken(token: string, email: string) {
    await saveSession(token, email);
    onAuthenticated();
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.hero}>
        <Text style={styles.logo}>💰</Text>
        <Text style={styles.title}>Fain</Text>
        <Text style={styles.subtitle}>
          Automatically tracks your bank transactions from Gmail. No manual entry.
        </Text>
      </View>

      <View style={styles.features}>
        {[
          ["📧", "Reads bank alert emails from your Gmail"],
          ["🤖", "Auto-categorizes spend using AI"],
          ["🔔", "Notifies you when a new transaction needs a label"],
          ["📊", "Shows a clear spend breakdown by category"],
        ].map(([icon, text]) => (
          <View key={text} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{icon}</Text>
            <Text style={styles.featureText}>{text}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.cta} onPress={handleConnectGmail}>
        <Text style={styles.ctaText}>Connect Gmail</Text>
      </TouchableOpacity>

      <Text style={styles.legal}>
        Fain only reads transaction emails. It never sends email or accesses other data.
      </Text>

      {/* Dev shortcut: paste session token from /auth/google/callback response */}
      <View style={styles.devBox}>
        <TextInput
          style={styles.devInput}
          placeholder="Dev: paste sessionToken here"
          placeholderTextColor="#475569"
          value={devToken}
          onChangeText={setDevToken}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TouchableOpacity
          style={[styles.devButton, !devToken && { opacity: 0.4 }]}
          disabled={!devToken}
          onPress={() => handlePasteToken(devToken.trim(), "am838578@gmail.com")}
        >
          <Text style={styles.devButtonText}>Go</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A", paddingHorizontal: 24, justifyContent: "space-between" },
  hero: { alignItems: "center", marginTop: 32 },
  logo: { fontSize: 56 },
  title: { fontSize: 36, fontWeight: "800", color: "#F8FAFC", marginTop: 8 },
  subtitle: { color: "#94A3B8", fontSize: 15, textAlign: "center", marginTop: 10, lineHeight: 22 },
  features: { gap: 18 },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  featureIcon: { fontSize: 22 },
  featureText: { color: "#CBD5E1", fontSize: 14, flex: 1, lineHeight: 20 },
  cta: {
    backgroundColor: "#6366F1",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  ctaText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
  legal: { color: "#475569", fontSize: 12, textAlign: "center", lineHeight: 18 },
  devBox: { flexDirection: "row", gap: 8, marginTop: 12 },
  devInput: {
    flex: 1,
    backgroundColor: "#1E293B",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#94A3B8",
    fontSize: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  devButton: {
    backgroundColor: "#334155",
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  devButtonText: { color: "#CBD5E1", fontSize: 13, fontWeight: "600" },
});
