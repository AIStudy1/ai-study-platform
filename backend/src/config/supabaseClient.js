import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// In production you should always use `SUPABASE_SERVICE_ROLE_KEY`.
// For local development, if it's missing we fall back to the anon key
// so the backend can boot and you can test the API.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase env vars. Provide SUPABASE_URL and either SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY."
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;