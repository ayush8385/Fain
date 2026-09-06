import React, { useState, useEffect } from "react";
import { Linking } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import { getSession, saveSession } from "../state/auth";
import { DashboardScreen } from "../screens/DashboardScreen";
import { NeedsReviewScreen } from "../screens/NeedsReviewScreen";
import { TransactionListScreen } from "../screens/TransactionListScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { OnboardingScreen } from "../screens/OnboardingScreen";

const Tab = createBottomTabNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Dashboard: "📊",
    Review: "🔔",
    Transactions: "📋",
    Settings: "⚙️",
  };
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[label] ?? "•"}</Text>;
}

function MainTabs({ onSignOut }: { onSignOut: () => void }) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: "#0F172A", borderTopColor: "#1E293B" },
        tabBarActiveTintColor: "#6366F1",
        tabBarInactiveTintColor: "#64748B",
        tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Review" component={NeedsReviewScreen} />
      <Tab.Screen name="Transactions" component={TransactionListScreen} />
      <Tab.Screen
        name="Settings"
        children={() => <SettingsScreen onSignOut={onSignOut} />}
      />
    </Tab.Navigator>
  );
}

function parseDeepLink(url: string): { token: string; email: string } | null {
  // Handles fain://auth?token=...&email=...
  try {
    const [, query] = url.split("?");
    if (!query) return null;
    const params = Object.fromEntries(query.split("&").map((p) => p.split("=").map(decodeURIComponent)));
    if (params.token && params.email) return { token: params.token, email: params.email };
  } catch {}
  return null;
}

export function RootNavigator() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  async function handleDeepLink(url: string) {
    const parsed = parseDeepLink(url);
    if (!parsed) return;
    await saveSession(parsed.token, parsed.email);
    setIsAuthenticated(true);
  }

  useEffect(() => {
    // Check existing session
    getSession().then((session) => setIsAuthenticated(!!session));

    // Handle deep link if app was opened cold via fain://
    Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); });

    // Handle deep link if app was already open (foreground)
    const sub = Linking.addEventListener("url", ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, []);

  if (isAuthenticated === null) return null; // splash / loading

  return (
    <NavigationContainer>
      {isAuthenticated ? (
        <MainTabs onSignOut={() => setIsAuthenticated(false)} />
      ) : (
        <OnboardingScreen onAuthenticated={() => setIsAuthenticated(true)} />
      )}
    </NavigationContainer>
  );
}
