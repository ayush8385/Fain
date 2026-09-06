import AsyncStorage from "@react-native-async-storage/async-storage";

export async function saveSession(sessionToken: string, email: string) {
  await AsyncStorage.multiSet([
    ["sessionToken", sessionToken],
    ["userEmail", email],
  ]);
}

export async function getSession(): Promise<{ sessionToken: string; email: string } | null> {
  const [[, token], [, email]] = await AsyncStorage.multiGet(["sessionToken", "userEmail"]);
  if (!token || !email) return null;
  return { sessionToken: token, email };
}

export async function clearSession() {
  await AsyncStorage.multiRemove(["sessionToken", "userEmail"]);
}
