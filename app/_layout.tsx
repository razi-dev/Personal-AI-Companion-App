import { useCallback, useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Slot, useRouter } from 'expo-router';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { getSupabaseClient, isSupabaseConfigured } from '../services/supabaseClient';

export default function RootLayout() {
    const router = useRouter();
    const [isReady, setIsReady] = useState(false);
    // Prevent concurrent checkFlow calls racing each other
    const checkingRef = useRef(false);

    const checkFlow = useCallback(async () => {
        if (checkingRef.current) return;
        checkingRef.current = true;
        try {
            let authed = true;
            if (isSupabaseConfigured()) {
                const supabase = getSupabaseClient();
                if (supabase) {
                    // Race getSession against a 2-second timeout
                    const sessionResult = await Promise.race([
                        supabase.auth.getSession(),
                        new Promise<{ data: { session: null }; error: Error }>((resolve) =>
                            setTimeout(
                                () => resolve({ data: { session: null }, error: new Error('timeout') }),
                                2000,
                            )
                        ),
                    ]);
                    authed = !sessionResult.error && !!sessionResult.data.session;
                } else {
                    authed = false;
                }
            }

            if (isSupabaseConfigured() && !authed) {
                router.replace('/auth' as any);
                return;
            }

            if (isSupabaseConfigured() && authed) {
                router.replace('/(tabs)' as any);
                return;
            }
        } catch (err) {
            console.warn('RootLayout checkFlow error:', err);
        } finally {
            checkingRef.current = false;
            setIsReady(true);
        }
    }, [router]);

    useEffect(() => {
        let subscription: { unsubscribe: () => void } | null = null;

        // Run once immediately
        checkFlow();

        // Subscribe to auth state changes (sign-in / sign-out events only)
        const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;
        if (supabase) {
            const { data } = supabase.auth.onAuthStateChange((event) => {
                // Only re-check on genuine sign-in/sign-out events, not on every
                // TOKEN_REFRESHED or INITIAL_SESSION which cause the flicker
                if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
                    checkFlow();
                }
            });
            subscription = data.subscription;
        }

        return () => {
            subscription?.unsubscribe();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <GestureHandlerRootView style={styles.container}>
            <SafeAreaProvider>
                {/* Keep slot mounted but hidden until auth check resolves
                    to avoid rendering sign-in before redirect fires */}
                <View style={{ flex: 1, opacity: isReady ? 1 : 0 }}>
                    <Slot />
                </View>
                {!isReady && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator color="#7C9EFF" size="large" />
                    </View>
                )}
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a1a',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#0a0a1a',
        alignItems: 'center',
        justifyContent: 'center',
    },
});
