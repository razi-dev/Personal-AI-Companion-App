import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Alert, KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { UserProfile, PersonalityTone } from '../types';
import { saveProfile, DEFAULT_PROFILE } from '../services/profileService';
import { scheduleAllNotifications, requestNotificationPermissions } from '../services/notificationService';

const TONES: { label: string; value: PersonalityTone; desc: string; emoji: string }[] = [
    { label: 'Calm Advisor', value: 'calm', desc: 'Analytical, thoughtful, non-judgmental', emoji: '🧘' },
    { label: 'Warm Friend', value: 'warm', desc: 'Encouraging, supportive, caring', emoji: '🌟' },
    { label: 'Direct Coach', value: 'direct', desc: 'Concise, action-oriented, no fluff', emoji: '⚡' },
];

const GOALS = [
    'Be more productive', 'Reduce stress', 'Build better habits',
    'Improve focus', 'Achieve work-life balance', 'Understand myself better',
];

type Step = 'welcome' | 'name' | 'role' | 'goal' | 'tone' | 'schedule' | 'permissions' | 'done';

const STEPS: Step[] = ['welcome', 'name', 'role', 'goal', 'tone', 'schedule', 'permissions', 'done'];

export default function OnboardingScreen() {
    const router = useRouter();
    const [step, setStep] = useState<Step>('welcome');
    const [profile, setProfile] = useState<UserProfile>({ ...DEFAULT_PROFILE });
    const [customGoal, setCustomGoal] = useState('');
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, [step]);

    const animateAndNext = (nextStep: Step) => {
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
            setStep(nextStep);
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
        });
    };

    const nextStep = () => {
        const idx = STEPS.indexOf(step);
        if (idx < STEPS.length - 1) animateAndNext(STEPS[idx + 1]);
    };

    const prevStep = () => {
        const idx = STEPS.indexOf(step);
        if (idx > 0) animateAndNext(STEPS[idx - 1]);
    };

    const handleFinish = async () => {
        const finalProfile: UserProfile = {
            ...profile,
            primaryGoal: profile.primaryGoal || customGoal || 'Understand myself better',
            onboardingComplete: true,
            createdAt: new Date().toISOString(),
        };
        await saveProfile(finalProfile);
        await scheduleAllNotifications(finalProfile);
        router.replace('/(tabs)');
    };

    const stepIndex = STEPS.indexOf(step);
    const progress = ((stepIndex) / (STEPS.length - 1)) * 100;

    return (
        <LinearGradient colors={['#050510', '#0d1230', '#050510']} style={styles.gradient}>
            <SafeAreaView style={styles.safe}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    {/* Progress bar */}
                    {step !== 'welcome' && step !== 'done' && (
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${progress}%` }]} />
                        </View>
                    )}

                    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                        <Animated.View style={{ opacity: fadeAnim }}>
                            {step === 'welcome' && <WelcomeStep onNext={nextStep} />}
                            {step === 'name' && (
                                <NameStep
                                    value={profile.name}
                                    onChange={(name) => setProfile({ ...profile, name })}
                                    onNext={nextStep}
                                    onBack={prevStep}
                                />
                            )}
                            {step === 'role' && (
                                <RoleStep
                                    value={profile.role}
                                    onChange={(role) => setProfile({ ...profile, role })}
                                    onNext={nextStep}
                                    onBack={prevStep}
                                />
                            )}
                            {step === 'goal' && (
                                <GoalStep
                                    selected={profile.primaryGoal}
                                    customGoal={customGoal}
                                    onSelect={(g) => setProfile({ ...profile, primaryGoal: g })}
                                    onCustomChange={setCustomGoal}
                                    onNext={nextStep}
                                    onBack={prevStep}
                                />
                            )}
                            {step === 'tone' && (
                                <ToneStep
                                    selected={profile.personalityTone}
                                    onSelect={(t) => setProfile({ ...profile, personalityTone: t })}
                                    onNext={nextStep}
                                    onBack={prevStep}
                                />
                            )}
                            {step === 'schedule' && (
                                <ScheduleStep
                                    morningHour={profile.morningCheckInHour}
                                    eveningHour={profile.eveningCheckInHour}
                                    onMorningChange={(h) => setProfile({ ...profile, morningCheckInHour: h })}
                                    onEveningChange={(h) => setProfile({ ...profile, eveningCheckInHour: h })}
                                    onNext={nextStep}
                                    onBack={prevStep}
                                />
                            )}
                            {step === 'permissions' && (
                                <PermissionsStep onNext={nextStep} onBack={prevStep} />
                            )}
                            {step === 'done' && (
                                <DoneStep name={profile.name} onFinish={handleFinish} />
                            )}
                        </Animated.View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </LinearGradient>
    );
}

// ─── Step Components ─────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
    return (
        <View style={styles.stepContainer}>
            <View style={styles.orb} />
            <Text style={styles.welcomeEmoji}>🧠</Text>
            <Text style={styles.welcomeTitle}>Meet Your{'\n'}Digital Twin</Text>
            <Text style={styles.welcomeSubtitle}>
                A personal AI companion that learns your patterns, tracks your habits, and helps you make better decisions — every day.
            </Text>
            <View style={styles.featureList}>
                {['Learns from your daily logs', 'Tracks your energy & mood', 'Sends smart reminders', 'Grows smarter over time'].map((f) => (
                    <View key={f} style={styles.featureRow}>
                        <Ionicons name="checkmark-circle" size={16} color="#7C9EFF" />
                        <Text style={styles.featureText}>{f}</Text>
                    </View>
                ))}
            </View>
            <TouchableOpacity style={styles.primaryBtn} onPress={onNext}>
                <Text style={styles.primaryBtnText}>Get Started →</Text>
            </TouchableOpacity>
        </View>
    );
}

function NameStep({ value, onChange, onNext, onBack }: { value: string; onChange: (v: string) => void; onNext: () => void; onBack: () => void }) {
    return (
        <View style={styles.stepContainer}>
            <Text style={styles.stepEmoji}>👋</Text>
            <Text style={styles.stepTitle}>What's your name?</Text>
            <Text style={styles.stepSubtitle}>Your twin will use this to personalize every interaction.</Text>
            <TextInput
                style={styles.textInput}
                value={value}
                onChangeText={onChange}
                placeholder="Enter your name..."
                placeholderTextColor="#3a3a5a"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => value.trim() && onNext()}
            />
            <NavButtons onBack={onBack} onNext={() => value.trim() && onNext()} nextDisabled={!value.trim()} />
        </View>
    );
}

function RoleStep({ value, onChange, onNext, onBack }: { value: string; onChange: (v: string) => void; onNext: () => void; onBack: () => void }) {
    const ROLES = ['Student', 'Developer', 'Designer', 'Entrepreneur', 'Manager', 'Freelancer', 'Other'];
    return (
        <View style={styles.stepContainer}>
            <Text style={styles.stepEmoji}>💼</Text>
            <Text style={styles.stepTitle}>What do you do?</Text>
            <Text style={styles.stepSubtitle}>Helps your twin understand your work context.</Text>
            <View style={styles.chipGrid}>
                {ROLES.map((r) => (
                    <TouchableOpacity
                        key={r}
                        style={[styles.chip, value === r && styles.chipActive]}
                        onPress={() => onChange(r)}
                    >
                        <Text style={[styles.chipText, value === r && styles.chipTextActive]}>{r}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <TextInput
                style={[styles.textInput, { marginTop: 12 }]}
                value={ROLES.includes(value) ? '' : value}
                onChangeText={onChange}
                placeholder="Or type your own..."
                placeholderTextColor="#3a3a5a"
            />
            <NavButtons onBack={onBack} onNext={onNext} />
        </View>
    );
}

function GoalStep({ selected, customGoal, onSelect, onCustomChange, onNext, onBack }: {
    selected: string; customGoal: string; onSelect: (v: string) => void;
    onCustomChange: (v: string) => void; onNext: () => void; onBack: () => void;
}) {
    return (
        <View style={styles.stepContainer}>
            <Text style={styles.stepEmoji}>🎯</Text>
            <Text style={styles.stepTitle}>What's your primary goal?</Text>
            <Text style={styles.stepSubtitle}>Your twin will keep this in focus.</Text>
            <View style={styles.chipGrid}>
                {GOALS.map((g) => (
                    <TouchableOpacity
                        key={g}
                        style={[styles.chip, selected === g && styles.chipActive]}
                        onPress={() => onSelect(g)}
                    >
                        <Text style={[styles.chipText, selected === g && styles.chipTextActive]}>{g}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <TextInput
                style={[styles.textInput, { marginTop: 12 }]}
                value={customGoal}
                onChangeText={(v) => { onCustomChange(v); onSelect(''); }}
                placeholder="Or describe your own goal..."
                placeholderTextColor="#3a3a5a"
            />
            <NavButtons onBack={onBack} onNext={onNext} />
        </View>
    );
}

function ToneStep({ selected, onSelect, onNext, onBack }: {
    selected: PersonalityTone; onSelect: (v: PersonalityTone) => void; onNext: () => void; onBack: () => void;
}) {
    return (
        <View style={styles.stepContainer}>
            <Text style={styles.stepEmoji}>🎭</Text>
            <Text style={styles.stepTitle}>How should your twin talk to you?</Text>
            <Text style={styles.stepSubtitle}>You can change this anytime in settings.</Text>
            {TONES.map((t) => (
                <TouchableOpacity
                    key={t.value}
                    style={[styles.toneCard, selected === t.value && styles.toneCardActive]}
                    onPress={() => onSelect(t.value)}
                >
                    <Text style={styles.toneEmoji}>{t.emoji}</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.toneLabel, selected === t.value && { color: '#7C9EFF' }]}>{t.label}</Text>
                        <Text style={styles.toneDesc}>{t.desc}</Text>
                    </View>
                    {selected === t.value && <Ionicons name="checkmark-circle" size={20} color="#7C9EFF" />}
                </TouchableOpacity>
            ))}
            <NavButtons onBack={onBack} onNext={onNext} />
        </View>
    );
}

function ScheduleStep({ morningHour, eveningHour, onMorningChange, onEveningChange, onNext, onBack }: {
    morningHour: number; eveningHour: number;
    onMorningChange: (h: number) => void; onEveningChange: (h: number) => void;
    onNext: () => void; onBack: () => void;
}) {
    const hourLabel = (h: number) => {
        const ampm = h < 12 ? 'AM' : 'PM';
        const display = h % 12 === 0 ? 12 : h % 12;
        return `${display}:00 ${ampm}`;
    };

    return (
        <View style={styles.stepContainer}>
            <Text style={styles.stepEmoji}>⏰</Text>
            <Text style={styles.stepTitle}>When should your twin check in?</Text>
            <Text style={styles.stepSubtitle}>Daily reminders to log and reflect.</Text>

            <Text style={styles.scheduleLabel}>🌅 Morning Check-In: {hourLabel(morningHour)}</Text>
            <View style={styles.hourRow}>
                {[6, 7, 8, 9, 10, 11].map((h) => (
                    <TouchableOpacity
                        key={h}
                        style={[styles.hourChip, morningHour === h && styles.hourChipActive]}
                        onPress={() => onMorningChange(h)}
                    >
                        <Text style={[styles.hourChipText, morningHour === h && { color: '#7C9EFF' }]}>{hourLabel(h)}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={[styles.scheduleLabel, { marginTop: 20 }]}>🌙 Evening Reflection: {hourLabel(eveningHour)}</Text>
            <View style={styles.hourRow}>
                {[18, 19, 20, 21, 22, 23].map((h) => (
                    <TouchableOpacity
                        key={h}
                        style={[styles.hourChip, eveningHour === h && styles.hourChipActive]}
                        onPress={() => onEveningChange(h)}
                    >
                        <Text style={[styles.hourChipText, eveningHour === h && { color: '#7C9EFF' }]}>{hourLabel(h)}</Text>
                    </TouchableOpacity>
                ))}
            </View>
            <NavButtons onBack={onBack} onNext={onNext} />
        </View>
    );
}

function PermissionsStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
    const [notifGranted, setNotifGranted] = useState(false);

    const handleRequestPermissions = async () => {
        const granted = await requestNotificationPermissions();
        if (granted) {
            setNotifGranted(true);
        } else {
            Alert.alert(
                'Notifications Disabled',
                'You can always enable them later in your device settings.',
                [{ text: 'OK' }]
            );
        }
    };

    return (
        <View style={styles.stepContainer}>
            <Text style={styles.stepEmoji}>🔔</Text>
            <Text style={styles.stepTitle}>Enable Notifications</Text>
            <Text style={styles.stepSubtitle}>So your twin can reach you for check-ins and reminders.</Text>
            <View style={styles.permCard}>
                <Ionicons name="notifications-outline" size={24} color="#7C9EFF" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.permTitle}>Daily Check-ins</Text>
                    <Text style={styles.permDesc}>Morning & evening reminders to log your day</Text>
                </View>
                {notifGranted
                    ? <Ionicons name="checkmark-circle" size={24} color="#4ade80" />
                    : <TouchableOpacity
                        style={styles.allowBtn}
                        onPress={handleRequestPermissions}
                    >
                        <Text style={styles.allowBtnText}>Allow</Text>
                    </TouchableOpacity>
                }
            </View>
            <Text style={styles.skipNote}>You can set this up later in Settings.</Text>
            <NavButtons onBack={onBack} onNext={onNext} nextLabel="Continue →" />
        </View>
    );
}

function DoneStep({ name, onFinish }: { name: string; onFinish: () => void }) {
    return (
        <View style={[styles.stepContainer, { alignItems: 'center' }]}>
            <View style={styles.doneOrb} />
            <Text style={styles.doneEmoji}>✨</Text>
            <Text style={styles.stepTitle}>You're all set{name ? `, ${name}` : ''}!</Text>
            <Text style={styles.stepSubtitle}>
                Your Digital Twin is ready. The more you log, the smarter it gets. Start with your first daily log.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={onFinish}>
                <Text style={styles.primaryBtnText}>Begin →</Text>
            </TouchableOpacity>
        </View>
    );
}

function NavButtons({ onBack, onNext, nextDisabled = false, nextLabel = 'Next →' }: {
    onBack: () => void; onNext: () => void; nextDisabled?: boolean; nextLabel?: string;
}) {
    return (
        <View style={styles.navButtons}>
            <TouchableOpacity style={styles.backBtn} onPress={onBack}>
                <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1 }, nextDisabled && styles.primaryBtnDisabled]}
                onPress={onNext}
                disabled={nextDisabled}
            >
                <Text style={styles.primaryBtnText}>{nextLabel}</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safe: { flex: 1 },
    scroll: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 40 },
    progressBar: { height: 3, backgroundColor: 'rgba(124,158,255,0.15)', marginTop: 8 },
    progressFill: { height: 3, backgroundColor: '#7C9EFF', borderRadius: 2 },
    stepContainer: { flex: 1, paddingTop: 48 },
    orb: {
        position: 'absolute', width: 300, height: 300, borderRadius: 150,
        backgroundColor: 'rgba(124,158,255,0.06)', top: -80, alignSelf: 'center',
    },
    welcomeEmoji: { fontSize: 64, textAlign: 'center', marginBottom: 24 },
    welcomeTitle: { fontSize: 36, fontWeight: '800', color: '#e8eeff', textAlign: 'center', letterSpacing: -1, lineHeight: 44 },
    welcomeSubtitle: { fontSize: 15, color: '#6a7090', textAlign: 'center', marginTop: 16, lineHeight: 24 },
    featureList: { marginTop: 32, gap: 12 },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    featureText: { color: '#8a9cc8', fontSize: 14 },
    stepEmoji: { fontSize: 48, marginBottom: 16 },
    stepTitle: { fontSize: 26, fontWeight: '800', color: '#e8eeff', letterSpacing: -0.5, lineHeight: 34, marginBottom: 8 },
    stepSubtitle: { fontSize: 14, color: '#4a4a6a', lineHeight: 22, marginBottom: 28 },
    textInput: {
        backgroundColor: 'rgba(20,24,60,0.8)', borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16,
        color: '#e8eeff', fontSize: 16, borderWidth: 1, borderColor: 'rgba(124,158,255,0.2)',
    },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    chip: {
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5,
        borderColor: 'rgba(124,158,255,0.2)', backgroundColor: 'rgba(20,24,60,0.6)',
    },
    chipActive: { borderColor: '#7C9EFF', backgroundColor: 'rgba(124,158,255,0.15)' },
    chipText: { color: '#6a7090', fontWeight: '600', fontSize: 13 },
    chipTextActive: { color: '#7C9EFF' },
    toneCard: {
        flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 18, borderWidth: 1.5,
        borderColor: 'rgba(124,158,255,0.1)', backgroundColor: 'rgba(20,24,60,0.7)', marginBottom: 12, gap: 14,
    },
    toneCardActive: { borderColor: '#7C9EFF', backgroundColor: 'rgba(124,158,255,0.08)' },
    toneEmoji: { fontSize: 28 },
    toneLabel: { color: '#e8eeff', fontWeight: '700', fontSize: 15 },
    toneDesc: { color: '#4a4a6a', fontSize: 12, marginTop: 2 },
    scheduleLabel: { color: '#8a9cc8', fontSize: 14, fontWeight: '600', marginBottom: 12 },
    hourRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    hourChip: {
        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5,
        borderColor: 'rgba(124,158,255,0.15)', backgroundColor: 'rgba(20,24,60,0.6)',
    },
    hourChipActive: { borderColor: '#7C9EFF', backgroundColor: 'rgba(124,158,255,0.12)' },
    hourChipText: { color: '#6a7090', fontSize: 12, fontWeight: '600' },
    permCard: {
        flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 18, borderWidth: 1,
        borderColor: 'rgba(124,158,255,0.2)', backgroundColor: 'rgba(20,24,60,0.7)', marginBottom: 12,
    },
    permTitle: { color: '#e8eeff', fontWeight: '700', fontSize: 14 },
    permDesc: { color: '#4a4a6a', fontSize: 12, marginTop: 2 },
    allowBtn: {
        backgroundColor: 'rgba(124,158,255,0.2)', paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: 10, borderWidth: 1, borderColor: 'rgba(124,158,255,0.4)',
    },
    allowBtnText: { color: '#7C9EFF', fontWeight: '700', fontSize: 13 },
    skipNote: { color: '#3a3a5a', fontSize: 12, textAlign: 'center', marginTop: 8 },
    navButtons: { flexDirection: 'row', gap: 12, marginTop: 36 },
    backBtn: { paddingHorizontal: 20, paddingVertical: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(124,158,255,0.2)' },
    backBtnText: { color: '#4a4a6a', fontWeight: '600' },
    primaryBtn: {
        backgroundColor: '#7C9EFF', borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 32,
        shadowColor: '#7C9EFF', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8,
    },
    primaryBtnDisabled: { backgroundColor: 'rgba(124,158,255,0.3)', shadowOpacity: 0 },
    primaryBtnText: { color: '#0a0a1a', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },
    doneOrb: {
        width: 200, height: 200, borderRadius: 100,
        backgroundColor: 'rgba(124,158,255,0.08)', alignSelf: 'center', marginBottom: -100,
    },
    doneEmoji: { fontSize: 64, textAlign: 'center', marginBottom: 24 },
});
