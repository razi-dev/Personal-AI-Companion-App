import { getSupabaseClient } from './supabaseClient';

export async function signUpWithEmail(email: string, password: string, name?: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                name: name?.trim() || undefined,
                full_name: name?.trim() || undefined,
            },
        },
    });
    if (error) throw error;
}

export async function signInWithEmail(email: string, password: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase is not configured.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
}

export async function signOut(): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.auth.signOut();
}

export async function getCurrentUserId(): Promise<string | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
}
