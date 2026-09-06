import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_BASE = "http://localhost:4000";

export const apiClient = axios.create({ baseURL: API_BASE });

apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("sessionToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
