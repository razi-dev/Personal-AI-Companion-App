import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { isSupabaseConfigured, getSupabaseClient } from '../services/supabaseClient';
import { signInWithEmail, signOut, signUpWithEmail } from '../services/authService';
import { isOnboardingComplete, saveProfile, DEFAULT_PROFILE } from '../services/profileService';
import { refreshBehaviorEngine } from '../services/behaviorEngine';
import { clearDemoData, seedDemoData } from '../services/demoSeed';

export default function AuthScreen() {
    const router = useRouter();
    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    // Start as null - we'll populate immediately from the cached session
    const [userEmail, setUserEmail] = useState<string | null>(null);

    useEffect(() => {
        if (!isSupabaseConfigured()) return;
        const supabase = getSupabaseClient();
        if (!supabase) return;

        // Read session synchronously from cache (no spinner needed -
        // _layout.tsx already waited for the real session before showing this screen)
        supabase.auth.getSession().then(({ data }) => {
            setUserEmail(data.session?.user?.email ?? null);
        });

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
            setUserEmail(session?.user?.email ?? null);
        });

        return () => { data.subscription.unsubscribe(); };
    }, []);

    const handleContinue = async () => {
        const complete = await isOnboardingComplete();
        await refreshBehaviorEngine();
        router.replace((complete ? '/(tabs)' : '/onboarding') as any);
    };

    const handleSignIn = async () => {
        setError('');
        if (!email.trim() || !password) {
            setError('Please enter email and password.');
            return;
        }
        setLoading(true);
        try {
            await signInWithEmail(email.trim(), password);
            await handleContinue();
        } catch (err) {
            setError(formatAuthError(err, 'Sign in failed.'));
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async () => {
        setError('');
        if (!name.trim()) {
            setError('Please enter your name.');
            return;
        }
        if (!email.trim() || !password || !confirmPassword) {
            setError('Please fill all sign up fields.');
            return;
        }
        if (password !== confirmPassword) {
            setError('Password and confirm password do not match.');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        setLoading(true);
        try {
            const cleanName = name.trim();
            const cleanEmail = email.trim().toLowerCase();

            await signUpWithEmail(cleanEmail, password, cleanName);

            // Ensure a newly created account never inherits previously seeded demo data.
            await clearDemoData();

            // Reset profile so the new account starts with entered name.
            await saveProfile({
                ...DEFAULT_PROFILE,
                name: cleanName,
                onboardingComplete: false,
                createdAt: new Date().toISOString(),
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            });

            await signOut();
            setMode('signin');
            setEmail(cleanEmail);
            setPassword('');
            setConfirmPassword('');
            setError('Account created successfully. Please sign in.');
        } catch (err) {
            setError(formatAuthError(err, 'Sign up failed.'));
        } finally {
            setLoading(false);
        }
    };

    const handleSignOut = async () => {
        setLoading(true);
        try {
            await signOut();
        } finally {
            setLoading(false);
        }
    };

    const handleDemoMode = async () => {
        setLoading(true);
        try {
            await seedDemoData();
            await refreshBehaviorEngine();
            router.replace('/(tabs)' as any);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load demo data.');
        } finally {
            setLoading(false);
        }
    };

    if (!isSupabaseConfigured()) {
        return (
            <LinearGradient colors={['#050510', '#0d1230', '#050510']} style={styles.gradient}>
                <SafeAreaView style={styles.safe}>
                    <View style={styles.center}>
                        <Text style={styles.title}>Supabase Not Configured</Text>
                        <Text style={styles.subtitle}>
                            Add your project URL and anon key to .env, then restart the app.
                        </Text>
                    </View>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient colors={['#050510', '#0d1230', '#050510']} style={styles.gradient}>
            <SafeAreaView style={styles.safe}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={styles.container}>
                            <View style={styles.hero}>
                                <View style={styles.orb} />
                                <Text style={styles.brand}>Digital Twin</Text>
                                <Text style={styles.title}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>
                                <Text style={styles.subtitle}>
                                    Sync your habits, logs, and insights across devices with secure cloud backup.
                                </Text>
                                <View style={styles.featureList}>
                                    <FeatureRow label="Private by default with row-level security" />
                                    <FeatureRow label="Behavior models update in real time" />
                                    <FeatureRow label="Forecasts and explanations stay in sync" />
                                </View>
                            </View>

                            <View style={styles.card}>
                                {userEmail ? (
                                    <View>
                                        <Text style={styles.signedInText}>Signed in as</Text>
                                        <Text style={styles.signedInEmail}>{userEmail}</Text>
                                        <View style={styles.row}>
                                            <TouchableOpacity style={styles.primaryBtn} onPress={handleContinue}>
                                                <Text style={styles.primaryBtnText}>Continue</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.outlineBtn} onPress={handleSignOut}>
                                                <Text style={styles.outlineBtnText}>Sign Out</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : (
                                    <>
                                        <Text style={styles.formTitle}>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</Text>
                                        <Text style={styles.formSubtitle}>
                                            {mode === 'signin'
                                                ? 'Use your email and password to continue.'
                                                : 'Use your name, email and password to create your account.'}
                                        </Text>
                                        {mode === 'signup' && (
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Name"
                                                placeholderTextColor="#3a3a5a"
                                                value={name}
                                                onChangeText={setName}
                                                autoCapitalize="words"
                                            />
                                        )}
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Email"
                                            placeholderTextColor="#3a3a5a"
                                            value={email}
                                            onChangeText={setEmail}
                                            autoCapitalize="none"
                                            keyboardType="email-address"
                                        />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Password"
                                            placeholderTextColor="#3a3a5a"
                                            value={password}
                                            onChangeText={setPassword}
                                            secureTextEntry
                                        />
                                        {mode === 'signup' && (
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Confirm Password"
                                                placeholderTextColor="#3a3a5a"
                                                value={confirmPassword}
                                                onChangeText={setConfirmPassword}
                                                secureTextEntry
                                            />
                                        )}

                                        {error ? <Text style={styles.errorText}>{error}</Text> : null}

                                        <View style={styles.row}>
                                            <TouchableOpacity
                                                style={styles.primaryBtn}
                                                onPress={mode === 'signin' ? handleSignIn : handleSignUp}
                                                disabled={loading}
                                            >
                                                {loading ? (
                                                    <ActivityIndicator color="#0a0a1a" />
                                                ) : (
                                                    <Text style={styles.primaryBtnText}>
                                                        {mode === 'signin' ? 'Sign In' : 'Create Account'}
                                                    </Text>
                                                )}
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.outlineBtn}
                                                onPress={() => {
                                                    setError('');
                                                    setMode(mode === 'signin' ? 'signup' : 'signin');
                                                }}
                                                disabled={loading}
                                            >
                                                <Text style={styles.outlineBtnText}>
                                                    {mode === 'signin' ? 'Need Sign Up?' : 'Back to Sign In'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </>
                                )}
                            </View>
                        </View>

                        {/* Demo Mode Banner */}
                        <View style={styles.demoBanner}>
                            <View style={styles.demoBannerInner}>
                                <View style={styles.demoBadge}>
                                    <Text style={styles.demoBadgeText}>DEMO</Text>
                                </View>
                                <Text style={styles.demoLabel}>Want to see the full app?</Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.demoBtn, loading && styles.sendBtnDisabled]}
                                onPress={handleDemoMode}
                                disabled={loading}
                            >
                                {loading
                                    ? <ActivityIndicator color="#0a0a1a" size="small" />
                                    : <Text style={styles.demoBtnText}>Load Demo Data →</Text>
                                }
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </LinearGradient>
    );
}

function formatAuthError(err: unknown, fallback: string): string {
    const raw = err instanceof Error ? err.message : fallback;
    const msg = raw.toLowerCase();
    if (msg.includes('network request failed') || msg.includes('failed to fetch')) {
        return 'Cannot reach Supabase. Check EXPO_PUBLIC_SUPABASE_URL in .env (project URL may be invalid), then restart Expo.';
    }
    if (msg.includes('email not confirmed')) {
        return 'Email not confirmed. Verify your email first, or disable Confirm email in Supabase for testing.';
    }
    if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
        return 'Invalid email or password. Please check both and try again.';
    }
    if (msg.includes('email rate limit exceeded') || msg.includes('rate limit') || msg.includes('too many requests')) {
        return 'Too many auth attempts in a short time. Wait a bit, then try again.';
    }
    if (msg.includes('password should be at least')) {
        return 'Password is too short. Use at least 6 characters.';
    }
    if (msg.includes('already registered') || msg.includes('user already registered') || msg.includes('already exists')) {
        return 'This email is already registered. Please sign in with the same email.';
    }
    return raw || fallback;
}

function FeatureRow({ label }: { label: string }) {
    return (
        <View style={styles.featureRow}>
            <View style={styles.featureDot} />
            <Text style={styles.featureText}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safe: { flex: 1 },
    container: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 24 },
    scrollContent: { flexGrow: 1 },
    center: { alignItems: 'center', justifyContent: 'center' },
    hero: { marginBottom: 18 },
    brand: { color: '#7C9EFF', fontSize: 12, letterSpacing: 2, fontWeight: '700', textTransform: 'uppercase' },
    title: { fontSize: 30, fontWeight: '800', color: '#e8eeff', marginTop: 6, marginBottom: 6 },
    subtitle: { color: '#8a9cc8', fontSize: 14, lineHeight: 22, marginBottom: 14 },
    orb: {
        position: 'absolute',
        right: -40,
        top: -20,
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(124,158,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(124,158,255,0.25)',
    },
    featureList: { marginTop: 6, gap: 8 },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    featureDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#7C9EFF' },
    featureText: { color: '#6a7090', fontSize: 12.5, lineHeight: 18 },
    card: {
        backgroundColor: 'rgba(20,24,60,0.85)',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(124,158,255,0.2)',
    },
    formTitle: { color: '#e8eeff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
    formSubtitle: { color: '#4a4a6a', fontSize: 12, marginBottom: 14 },
    loadingText: { color: '#6a7090', fontSize: 12, marginTop: 8 },
    input: {
        backgroundColor: 'rgba(20,24,60,0.8)',
        borderRadius: 16,
        paddingHorizontal: 18,
        paddingVertical: 14,
        color: '#e8eeff',
        fontSize: 15,
        borderWidth: 1,
        borderColor: 'rgba(124,158,255,0.2)',
        marginBottom: 12,
    },
    row: { flexDirection: 'row', gap: 12, marginTop: 6 },
    primaryBtn: {
        flex: 1,
        backgroundColor: '#7C9EFF',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
    },
    primaryBtnText: { color: '#0a0a1a', fontWeight: '800', fontSize: 15 },
    outlineBtn: {
        flex: 1,
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(124,158,255,0.4)',
        backgroundColor: 'rgba(124,158,255,0.08)',
    },
    outlineBtnText: { color: '#7C9EFF', fontWeight: '700', fontSize: 14 },
    errorText: { color: '#ff6b6b', marginBottom: 8, fontSize: 12 },
    signedInText: { color: '#6a7090', fontSize: 12 },
    signedInEmail: { color: '#e8eeff', fontSize: 15, fontWeight: '700', marginTop: 4, marginBottom: 14 },
    demoBanner: {
        marginHorizontal: 24,
        marginBottom: 28,
        padding: 16,
        borderRadius: 18,
        backgroundColor: 'rgba(167,139,250,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(167,139,250,0.3)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    demoBannerInner: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, flexWrap: 'wrap' },
    demoBadge: {
        backgroundColor: '#a78bfa',
        borderRadius: 6,
        paddingHorizontal: 7,
        paddingVertical: 3,
    },
    demoBadgeText: { color: '#0a0a1a', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
    demoLabel: { color: '#c4b5fd', fontSize: 13, fontWeight: '600', flexShrink: 1 },
    demoBtn: {
        backgroundColor: '#a78bfa',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 10,
        alignItems: 'center',
        minWidth: 130,
    },
    sendBtnDisabled: { backgroundColor: 'rgba(167,139,250,0.3)' },
    demoBtnText: { color: '#0a0a1a', fontWeight: '800', fontSize: 13 },
});
