import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const SUPABASE_KEY = (process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '').trim();

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
    if (!SUPABASE_URL || !SUPABASE_KEY) return null;
    if (!client) {
        client = createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: {
                storage: AsyncStorage,
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false,
            },
        });
    }
    return client;
}

export function isSupabaseConfigured(): boolean {
    return !!SUPABASE_URL && !!SUPABASE_KEY;
}
