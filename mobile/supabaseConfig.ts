 import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Expo can run a web/SSR bundle during `expo start`.
// `@react-native-async-storage/async-storage` touches `window`, so we provide
// a server-safe storage fallback to avoid `ReferenceError: window is not defined`.
const serverSafeStorage = {
  getItem: async (_key: string) => null,
  setItem: async (_key: string, _value: string) => {},
  removeItem: async (_key: string) => {},
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Use fallback storage only for Expo web/SSR.
    // On real iOS/Android React Native, `window` is typically undefined too,
    // so checking `typeof window` would incorrectly disable real persistence.
    storage: Platform.OS === "web" ? serverSafeStorage : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});