import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_BASE = "https://fain-8agn.onrender.com";

export const apiClient = axios.create({ baseURL: API_BASE });

apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("sessionToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
