// The one Supabase client. The app uses Supabase for sign-in only; app data comes from the Spring API.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { SUPABASE_KEY, SUPABASE_URL } from '@/config';

/** False until `.env` has the Supabase URL and key; auth screens then show a setup hint. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

// Placeholders keep `createClient` from throwing when the keys are missing.
export const supabase = createClient(SUPABASE_URL || 'http://localhost:54321', SUPABASE_KEY || 'missing-key', {
  auth: {
    storage: AsyncStorage, // session survives app restarts
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
