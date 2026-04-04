import { createClient } from "@supabase/supabase-js";

export function getAuthedSupabaseClient(accessToken) {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in backend env");
  }
  if (!accessToken) {
    throw new Error("accessToken is required to create an authed Supabase client");
  }

  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

