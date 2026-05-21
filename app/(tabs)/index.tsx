import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Dimensions, Animated, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import LottieView from 'lottie-react-native';
import {
    getRecentEntries,
    computeCompletionRatio,
    computeAvgEnergy,
    getEntryByDate,
    localDateString,
} from '../../services/memoryService';
import { analyzeCompletionPattern, analyzeEnergyTrend, computeBehaviorInsights } from '../../utils/patternAnalysis';
import { DailyEntry, HabitWithStats, UserProfile, BehaviorState } from '../../types';
import { getHabitsWithStats, isScheduledDay } from '../../services/habitService';
import { getProfile } from '../../services/profileService';
import { generateProactiveMessage } from '../../services/aiService';
import { getAllJournalEntries } from '../../services/journalService';
import { getBehaviorState, refreshBehaviorEngine } from '../../services/behaviorEngine';
import { signOut } from '../../services/authService';
import { isSupabaseConfigured } from '../../services/supabaseClient';

const { width } = Dimensions.get('window');

type YesterdaySummary = {
    date: string;
    logMissing: boolean;
    missedHabits: HabitWithStats[];
    missedTasks: string[];
    tasksPlannedCount: number;
    tasksCompletedCount: number;
};

function computeMissingTasks(planned: string[], completed: string[]): string[] {
    const remaining = completed.map((t) => t.trim()).filter(Boolean);
    const missing: string[] = [];
    planned.forEach((task) => {
        const normalized = task.trim();
        if (!normalized) return;
        const matchIndex = remaining.findIndex(
            (done) => done.toLowerCase() === normalized.toLowerCase()
        );
        if (matchIndex >= 0) {
            remaining.splice(matchIndex, 1);
        } else {
            missing.push(task);
        }
    });
    return missing;
}

function buildYesterdaySuggestion(summary: YesterdaySummary): string {
    if (summary.logMissing) {
        return 'Start by logging yesterday so your patterns stay accurate.';
    }
    if (summary.missedHabits.length > 0 && summary.missedTasks.length > 0) {
        return 'Pick one missed habit and the top missed task to complete today.';
    }
    if (summary.missedHabits.length > 0) {
        return 'Restart one missed habit today to protect your streak.';
    }
    if (summary.missedTasks.length > 0) {
        return 'Reschedule one missed task for today and finish it early.';
    }
    return 'Keep your momentum steady today.';
}

export default function HomeScreen() {
    const router = useRouter();
    const [entries, setEntries] = useState<DailyEntry[]>([]);
    const [habits, setHabits] = useState<HabitWithStats[]>([]);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [greeting, setGreeting] = useState('');
    const [completionRatio, setCompletionRatio] = useState(0);
    const [avgEnergy, setAvgEnergy] = useState(3);
    const [completionPattern, setCompletionPattern] = useState('');
    const [energyPattern, setEnergyPattern] = useState('');
    const [proactiveMsg, setProactiveMsg] = useState('');
    const [journalCount, setJournalCount] = useState(0);
    const [behaviorState, setBehaviorState] = useState<BehaviorState | null>(null);
    const [yesterdaySummary, setYesterdaySummary] = useState<YesterdaySummary | null>(null);
    const [showYesterdayDetails, setShowYesterdayDetails] = useState(false);
    const proactiveFade = useRef(new Animated.Value(0)).current;
    const [emotion, setEmotion] = useState<'happy' | 'sad' | 'idle'>('idle');

    // Trigger emoji change based on today's habit completion after data loads
    useEffect(() => {
        if (habits.length === 0) return;
        const done = habits.filter((h) => h.todayCompleted).length;
        const ratio = done / habits.length;
        if (ratio >= 0.8) {
            setEmotion('happy');
        } else if (ratio <= 0.2) {
            setEmotion('sad');
        } else {
            setEmotion('idle');
        }
    }, [habits]);

    useEffect(() => {
        const hour = new Date().getHours();
        const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        setGreeting(timeGreeting);
        loadData();
    }, []);

    const handleLogout = () => {
        Alert.alert('Log out', 'Are you sure you want to log out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Log out',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await signOut();
                    } catch (err) {
                        Alert.alert('Logout failed', err instanceof Error ? err.message : 'Please try again.');
                    }
                },
            },
        ]);
    };

    const loadData = async () => {
        const [recent, habitsData, userProfile, journals] = await Promise.all([
            getRecentEntries(7),
            getHabitsWithStats(),
            getProfile(),
            getAllJournalEntries(),
        ]);

        setEntries(recent);
        setHabits(habitsData);
        setProfile(userProfile);
        setCompletionRatio(computeCompletionRatio(recent));
        setAvgEnergy(computeAvgEnergy(recent));
        setCompletionPattern(analyzeCompletionPattern(recent));
        setEnergyPattern(analyzeEnergyTrend(recent));
        setJournalCount(journals.length);

        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = localDateString(yesterday);
        const yesterdayEntry = await getEntryByDate(yesterdayStr);
        const missedTasks = yesterdayEntry
            ? computeMissingTasks(yesterdayEntry.tasksPlanned, yesterdayEntry.tasksCompleted)
            : [];
        const tasksPlannedCount = yesterdayEntry ? yesterdayEntry.tasksPlanned.length : 0;
        const tasksCompletedCount = yesterdayEntry ? yesterdayEntry.tasksCompleted.length : 0;
        const missedHabits = habitsData.filter((habit) => {
            const yesterdayIndex = Math.max(habit.last30Days.length - 2, 0);
            return isScheduledDay(yesterdayStr, habit.frequency)
                && habit.last30Days[yesterdayIndex] === false;
        });
        setYesterdaySummary({
            date: yesterdayStr,
            logMissing: !yesterdayEntry,
            missedHabits,
            missedTasks,
            tasksPlannedCount,
            tasksCompletedCount,
        });

        await refreshBehaviorEngine();
        const behavior = await getBehaviorState();
        setBehaviorState(behavior);

        // Generate proactive message
        const hour = new Date().getHours();
        const msgType = hour < 12 ? 'morning' : hour < 18 ? 'streak_risk' : 'evening';
        const msg = await generateProactiveMessage(msgType, {
            profile: userProfile,
            entries: recent,
            habits: habitsData,
        });
        setProactiveMsg(msg);
        Animated.timing(proactiveFade, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    };

    const todayHabitsDone = habits.filter((h) => h.todayCompleted).length;
    const activeStreaks = habits.filter((h) => h.currentStreak > 0);
    const longestStreak = Math.max(...habits.map((h) => h.currentStreak), 0);

    const getEmojiAsset = () => {
        switch (emotion) {
            case 'happy': return require('../../assets/Smiley Face Emoji.json');
            case 'sad': return require('../../assets/Crying emoji.json');
            case 'idle':
            default: return require('../../assets/Raised Eyebrow Emoji.json');
        }
    };

    return (
        <LinearGradient colors={['#0a0a1a', '#0d1230', '#0a0a1a']} style={styles.gradient}>
            <SafeAreaView style={styles.safe}>
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.greeting}>{greeting}{profile?.name ? `, ${profile.name}` : ''}</Text>
                            <Text style={styles.subTitle}>Your Digital Twin</Text>
                        </View>
                        <View style={styles.headerRight}>
                            <TouchableOpacity
                                style={styles.insightsBtn}
                                onPress={() => router.push('/(tabs)/insights' as any)}
                            >
                                <Ionicons name="analytics-outline" size={18} color="#7C9EFF" />
                            </TouchableOpacity>
                            {isSupabaseConfigured() && (
                                <TouchableOpacity
                                    style={styles.insightsBtn}
                                    onPress={handleLogout}
                                >
                                    <Ionicons name="log-out-outline" size={18} color="#ff8a8a" />
                                </TouchableOpacity>
                            )}
                            <View style={styles.statusBadge}>
                                <View style={styles.statusDot} />
                                <Text style={styles.statusText}>Active</Text>
                            </View>
                        </View>
                    </View>

                    {/* Emotion Emoji section */}
                    <View style={styles.avatarSection}>
                        <LottieView
                            source={getEmojiAsset()}
                            autoPlay
                            loop
                            style={{ width: 220, height: 220 }}
                        />
                    </View>

                    {/* Proactive Twin Message */}
                    {proactiveMsg !== '' && (
                        <Animated.View style={[styles.proactiveCard, { opacity: proactiveFade }]}>
                            <View style={styles.proactiveDot}><View style={styles.proactiveDotInner} /></View>
                            <Text style={styles.proactiveText}>{proactiveMsg}</Text>
                        </Animated.View>
                    )}

                    {/* Yesterday Missed Summary */}
                    {yesterdaySummary && (
                        (yesterdaySummary.logMissing
                            || yesterdaySummary.missedHabits.length > 0
                            || yesterdaySummary.missedTasks.length > 0
                        ) && (
                            <TouchableOpacity
                                activeOpacity={0.9}
                                onPress={() => setShowYesterdayDetails((prev) => !prev)}
                            >
                                <View style={styles.missedCard}>
                                    <View style={styles.missedHeader}>
                                        <View style={styles.missedHeaderLeft}>
                                            <Ionicons name="alert-circle-outline" size={18} color="#ffa94d" />
                                            <Text style={styles.missedTitle}>Yesterday Summary</Text>
                                        </View>
                                        <Ionicons
                                            name={showYesterdayDetails ? 'chevron-up' : 'chevron-down'}
                                            size={18}
                                            color="#8a9cc8"
                                        />
                                    </View>
                                    <Text style={styles.missedSubtitle}>
                                        {yesterdaySummary.logMissing
                                            ? 'You missed yesterday\'s log.'
                                            : `Missed ${yesterdaySummary.missedHabits.length} habits and ${yesterdaySummary.missedTasks.length} tasks yesterday.`}
                                    </Text>
                                    <View style={styles.missedMetaRow}>
                                        <View style={styles.missedPill}>
                                            <Text style={styles.missedPillText}>
                                                Habits missed: {yesterdaySummary.missedHabits.length}
                                            </Text>
                                        </View>
                                        <View style={styles.missedPill}>
                                            <Text style={styles.missedPillText}>
                                                Tasks missed: {yesterdaySummary.missedTasks.length}
                                            </Text>
                                        </View>
                                    </View>
                                    {showYesterdayDetails && (
                                        <View style={styles.missedDetails}>
                                            {yesterdaySummary.logMissing && (
                                                <Text style={styles.missedDetailText}>
                                                    No log saved yesterday, so tasks may be incomplete.
                                                </Text>
                                            )}
                                            {!yesterdaySummary.logMissing && (
                                                <Text style={styles.missedDetailText}>
                                                    Tasks planned: {yesterdaySummary.tasksPlannedCount}, completed: {yesterdaySummary.tasksCompletedCount}
                                                </Text>
                                            )}
                                            <Text style={styles.missedDetailLabel}>
                                                Missed habits ({yesterdaySummary.missedHabits.length})
                                            </Text>
                                            {yesterdaySummary.missedHabits.length > 0 ? (
                                                yesterdaySummary.missedHabits.map((habit) => (
                                                    <Text key={habit.id} style={styles.missedListItem}>
                                                        {habit.icon} {habit.name}
                                                    </Text>
                                                ))
                                            ) : (
                                                <Text style={styles.missedDetailText}>None</Text>
                                            )}
                                            <Text style={styles.missedDetailLabel}>
                                                Unfinished tasks ({yesterdaySummary.missedTasks.length})
                                            </Text>
                                            {yesterdaySummary.missedTasks.length > 0 ? (
                                                yesterdaySummary.missedTasks.map((task, i) => (
                                                    <Text key={`${task}-${i}`} style={styles.missedListItem}>
                                                        {task}
                                                    </Text>
                                                ))
                                            ) : (
                                                <Text style={styles.missedDetailText}>None</Text>
                                            )}
                                            <View style={styles.missedSuggestion}>
                                                <Ionicons name="bulb-outline" size={16} color="#ffa94d" />
                                                <Text style={styles.missedSuggestionText}>
                                                    {buildYesterdaySuggestion(yesterdaySummary)}
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
                        )
                    )}

                    {/* Quick stats */}
                    {entries.length > 0 && (
                        <View style={styles.statsRow}>
                            <StatCard label="Completion" value={`${Math.round(completionRatio * 100)}%`} icon="checkmark-circle-outline" color="#7C9EFF" />
                            <StatCard label="Avg Energy" value={`${avgEnergy.toFixed(1)}/5`} icon="flash-outline" color="#a78bfa" />
                            <StatCard label="Days Logged" value={`${entries.length}`} icon="calendar-outline" color="#60a5fa" />
                        </View>
                    )}

                    {/* Forecast */}
                    {behaviorState?.forecast && (
                        <View style={styles.forecastCard}>
                            <View style={styles.forecastHeader}>
                                <Ionicons name="sparkles-outline" size={16} color="#a78bfa" />
                                <Text style={styles.forecastTitle}>Tomorrow Forecast</Text>
                            </View>
                            <Text style={styles.forecastText}>
                                Energy: {behaviorState.forecast.expectedEnergy.toFixed(1)}/5
                                {'  '}Completion: {Math.round(behaviorState.forecast.expectedCompletionRate * 100)}%
                                {'  '}Risk: {behaviorState.forecast.riskLevel}
                            </Text>
                        </View>
                    )}

                    {/* Habits Today */}
                    {habits.length > 0 && (
                        <View style={styles.habitsSection}>
                            <View style={styles.habitsSectionHeader}>
                                <Text style={styles.sectionTitle}>TODAY'S HABITS</Text>
                                <Text style={styles.habitsDoneText}>{todayHabitsDone}/{habits.length}</Text>
                            </View>
                            <View style={styles.habitsRow}>
                                {habits.slice(0, 5).map((h) => (
                                    <View key={h.id} style={[styles.habitDot, h.todayCompleted && { backgroundColor: `${h.color}30`, borderColor: h.color }]}>
                                        <Text style={{ fontSize: 16 }}>{h.icon}</Text>
                                        {h.currentStreak > 0 && (
                                            <View style={styles.microStreak}>
                                                <Text style={styles.microStreakText}>{h.currentStreak}</Text>
                                            </View>
                                        )}
                                    </View>
                                ))}
                                {habits.length > 5 && (
                                    <TouchableOpacity onPress={() => router.push('/(tabs)/habits' as any)} style={styles.habitMoreDot}>
                                        <Text style={styles.habitMoreText}>+{habits.length - 5}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            {longestStreak >= 3 && (
                                <View style={styles.streakBanner}>
                                    <Text style={styles.streakBannerText}>🔥 {longestStreak}-day streak active!</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* Pattern insights */}
                    {entries.length >= 2 && (
                        <View style={styles.insightsSection}>
                            <Text style={styles.sectionTitle}>RECENT PATTERNS</Text>
                            <View style={styles.patternCard}>
                                <Ionicons name="bar-chart-outline" size={16} color="#7C9EFF" style={styles.patternIcon} />
                                <Text style={styles.patternText}>{completionPattern}</Text>
                            </View>
                            <View style={styles.patternCard}>
                                <Ionicons name="flash-outline" size={16} color="#a78bfa" style={styles.patternIcon} />
                                <Text style={styles.patternText}>{energyPattern}</Text>
                            </View>
                        </View>
                    )}

                    {/* Quick Actions */}
                    <View style={styles.actionsSection}>
                        <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
                        <View style={styles.actionsGrid}>
                            <QuickAction label="Talk to Twin" icon="chatbubble-ellipses" color="#7C9EFF" onPress={() => router.push('/(tabs)/chat')} />
                            <QuickAction label="Log Today" icon="journal" color="#a78bfa" onPress={() => router.push('/(tabs)/log')} />
                            <QuickAction label="Habits" icon="repeat" color="#60a5fa" onPress={() => router.push('/(tabs)/habits' as any)} />
                        </View>
                        <View style={[styles.actionsGrid, { marginTop: 10 }]}>
                            <QuickAction label="Journal" icon="book" color="#4ade80" onPress={() => router.push('/(tabs)/journal' as any)} />
                            <QuickAction label="Insights" icon="analytics" color="#ffa94d" onPress={() => router.push('/(tabs)/insights' as any)} />
                            <QuickAction label="Week Review" icon="clipboard" color="#f472b6" onPress={() => router.push('/(tabs)/review' as any)} />
                        </View>
                    </View>

                    {/* Stats summary if journal/habits */}
                    {(journalCount > 0 || habits.length > 0) && (
                        <View style={styles.summaryRow}>
                            {journalCount > 0 && (
                                <View style={styles.summaryChip}>
                                    <Ionicons name="book-outline" size={14} color="#ffa94d" />
                                    <Text style={styles.summaryChipText}>{journalCount} journal entries</Text>
                                </View>
                            )}
                            {habits.length > 0 && (
                                <View style={styles.summaryChip}>
                                    <Ionicons name="repeat-outline" size={14} color="#a78bfa" />
                                    <Text style={styles.summaryChipText}>{habits.length} habits tracked</Text>
                                </View>
                            )}
                        </View>
                    )}

                    {entries.length === 0 && (
                        <View style={styles.emptyState}>
                            <Ionicons name="journal-outline" size={48} color="rgba(124,158,255,0.3)" />
                            <Text style={styles.emptyTitle}>Start Your Journey</Text>
                            <Text style={styles.emptySubtitle}>
                                Log your first day so your Twin can start learning your patterns.
                            </Text>
                            <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/(tabs)/log')}>
                                <Text style={styles.emptyButtonText}>Log Today →</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </LinearGradient>
    );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: any; color: string }) {
    return (
        <View style={[styles.statCard, { borderColor: `${color}30` }]}>
            <Ionicons name={icon} size={18} color={color} />
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

function QuickAction({ label, icon, color, onPress }: { label: string; icon: any; color: string; onPress: () => void }) {
    return (
        <TouchableOpacity style={[styles.actionCard, { borderColor: `${color}25` }]} onPress={onPress} activeOpacity={0.75}>
            <View style={[styles.actionIcon, { backgroundColor: `${color}15` }]}>
                <Ionicons name={icon} size={24} color={color} />
            </View>
            <Text style={styles.actionLabel}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safe: { flex: 1 },
    scroll: { paddingBottom: 100 },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8,
    },
    greeting: { fontSize: 24, fontWeight: '700', color: '#e8eeff', letterSpacing: -0.5 },
    subTitle: { fontSize: 13, color: '#4a4a6a', marginTop: 2, letterSpacing: 0.5 },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    insightsBtn: {
        width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(124,158,255,0.1)',
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(124,158,255,0.2)',
    },
    statusBadge: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(124,158,255,0.1)',
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
        borderWidth: 1, borderColor: 'rgba(124,158,255,0.2)',
    },
    statusDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#4ade80', marginRight: 6 },
    statusText: { color: '#4ade80', fontSize: 12, fontWeight: '600' },
    avatarSection: { alignItems: 'center', paddingVertical: 20 },
    proactiveCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: 20, marginBottom: 20,
        padding: 16, borderRadius: 18, backgroundColor: 'rgba(124,158,255,0.07)',
        borderWidth: 1, borderColor: 'rgba(124,158,255,0.2)',
    },
    proactiveDot: {
        width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(124,158,255,0.15)',
        alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(124,158,255,0.4)',
        flexShrink: 0,
    },
    proactiveDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#7C9EFF' },
    proactiveText: { color: '#c8d8ff', fontSize: 13.5, lineHeight: 22, flex: 1, fontStyle: 'italic' },
    missedCard: {
        marginHorizontal: 20,
        marginBottom: 20,
        padding: 16,
        borderRadius: 18,
        backgroundColor: 'rgba(255,169,77,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,169,77,0.25)',
    },
    missedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
    missedHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    missedTitle: { color: '#e8eeff', fontSize: 14, fontWeight: '700' },
    missedSubtitle: { color: '#8a9cc8', fontSize: 12.5, lineHeight: 18 },
    missedMetaRow: { flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' },
    missedPill: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: 'rgba(255,169,77,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,169,77,0.25)',
    },
    missedPillText: { color: '#ffa94d', fontSize: 11, fontWeight: '700' },
    missedDetails: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
    missedDetailLabel: { color: '#7C9EFF', fontSize: 11, fontWeight: '700', marginTop: 10, marginBottom: 6 },
    missedDetailText: { color: '#8a9cc8', fontSize: 12.5, lineHeight: 18 },
    missedListItem: { color: '#c8d8ff', fontSize: 12.5, lineHeight: 18, marginBottom: 4 },
    missedSuggestion: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    missedSuggestionText: { color: '#ffa94d', fontSize: 12.5, lineHeight: 18, flex: 1, fontWeight: '600' },
    forecastCard: {
        marginHorizontal: 20,
        marginBottom: 20,
        padding: 14,
        borderRadius: 16,
        backgroundColor: 'rgba(167,139,250,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(167,139,250,0.25)',
    },
    forecastHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    forecastTitle: { color: '#a78bfa', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    forecastText: { color: '#c8d8ff', fontSize: 12.5, lineHeight: 18 },
    statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 20 },
    statCard: {
        flex: 1, backgroundColor: 'rgba(20,24,60,0.8)', borderRadius: 16,
        alignItems: 'center', paddingVertical: 14, borderWidth: 1,
    },
    statValue: { fontSize: 18, fontWeight: '700', marginTop: 6 },
    statLabel: { fontSize: 10, color: '#4a4a6a', marginTop: 2, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' },
    habitsSection: { marginHorizontal: 20, marginBottom: 20 },
    habitsSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    habitsDoneText: { color: '#7C9EFF', fontSize: 13, fontWeight: '700' },
    habitsRow: { flexDirection: 'row', gap: 8 },
    habitDot: {
        width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(20,24,60,0.8)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
        position: 'relative',
    },
    microStreak: {
        position: 'absolute', bottom: -4, right: -4, backgroundColor: '#ffa94d',
        borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
    },
    microStreakText: { color: '#0a0a1a', fontSize: 8, fontWeight: '800' },
    habitMoreDot: {
        width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(20,24,60,0.5)', borderWidth: 1, borderColor: 'rgba(124,158,255,0.15)',
    },
    habitMoreText: { color: '#4a4a6a', fontSize: 12, fontWeight: '600' },
    streakBanner: {
        marginTop: 10, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12,
        backgroundColor: 'rgba(255,169,77,0.12)', borderWidth: 1, borderColor: 'rgba(255,169,77,0.3)',
        alignSelf: 'flex-start',
    },
    streakBannerText: { color: '#ffa94d', fontSize: 12, fontWeight: '700' },
    sectionTitle: {
        color: '#7C9EFF', fontSize: 11, fontWeight: '700', letterSpacing: 1.2,
        textTransform: 'uppercase', marginBottom: 12,
    },
    insightsSection: { paddingHorizontal: 20, marginBottom: 24 },
    patternCard: {
        flexDirection: 'row', backgroundColor: 'rgba(20,24,60,0.7)', borderRadius: 14,
        padding: 14, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(124,158,255,0.1)', alignItems: 'flex-start',
    },
    patternIcon: { marginRight: 10, marginTop: 1 },
    patternText: { color: '#8a9cc8', fontSize: 13, lineHeight: 20, flex: 1 },
    actionsSection: { paddingHorizontal: 20 },
    actionsGrid: { flexDirection: 'row', gap: 10 },
    actionCard: {
        flex: 1, backgroundColor: 'rgba(20,24,60,0.7)', borderRadius: 16,
        alignItems: 'center', paddingVertical: 16, borderWidth: 1,
    },
    actionIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    actionLabel: { color: '#8a9cc8', fontSize: 10, fontWeight: '600', textAlign: 'center', letterSpacing: 0.3 },
    summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginTop: 20 },
    summaryChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6,
        borderRadius: 20, backgroundColor: 'rgba(20,24,60,0.7)', borderWidth: 1, borderColor: 'rgba(124,158,255,0.1)',
    },
    summaryChipText: { color: '#4a4a6a', fontSize: 12 },
    emptyState: { alignItems: 'center', paddingHorizontal: 36, paddingTop: 20 },
    emptyTitle: { color: '#e8eeff', fontSize: 20, fontWeight: '700', marginTop: 16 },
    emptySubtitle: { color: '#4a4a6a', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 22 },
    emptyButton: {
        marginTop: 20, backgroundColor: 'rgba(124,158,255,0.15)', borderWidth: 1,
        borderColor: 'rgba(124,158,255,0.4)', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 12,
    },
    emptyButtonText: { color: '#7C9EFF', fontWeight: '700', fontSize: 14 },
});
