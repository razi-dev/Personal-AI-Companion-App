import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { WeeklyReview, DailyEntry } from '../../types';
import { getRecentEntries } from '../../services/memoryService';
import { getProfile } from '../../services/profileService';
import { getHabitsWithStats } from '../../services/habitService';
import { getAllJournalEntries } from '../../services/journalService';
import { generateWeeklyReview } from '../../services/aiService';

const MOOD_EMOJIS: Record<string, string> = {
    overwhelmed: '😰', stressed: '😤', neutral: '😐', focused: '🎯', great: '🌟',
};

const MOOD_COLORS: Record<string, string> = {
    overwhelmed: '#ff6b6b', stressed: '#ffa94d', neutral: '#8a9cc8', focused: '#60a5fa', great: '#4ade80',
};

export default function ReviewScreen() {
    const [review, setReview] = useState<WeeklyReview | null>(null);
    const [loading, setLoading] = useState(true);
    const [regenerating, setRegenerating] = useState(false);

    useEffect(() => { loadReview(); }, []);

    const loadReview = async () => {
        setLoading(true);
        try {
            const [entries, profile, habits, journals] = await Promise.all([
                getRecentEntries(7),
                getProfile(),
                getHabitsWithStats(),
                getAllJournalEntries(),
            ]);
            const weekJournals = journals.filter((j) => {
                const d = new Date(j.date);
                const week = new Date();
                week.setDate(week.getDate() - 7);
                return d >= week;
            });
            const generated = await generateWeeklyReview(entries, habits, weekJournals.length, profile);
            setReview(generated);
        } catch (err) {
            console.error('ReviewScreen loadReview error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRegenerate = async () => {
        setRegenerating(true);
        await loadReview();
        setRegenerating(false);
    };

    if (loading) {
        return (
            <LinearGradient colors={['#0a0a1a', '#0d1230', '#0a0a1a']} style={styles.gradient}>
                <SafeAreaView style={styles.safe}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#7C9EFF" />
                        <Text style={styles.loadingText}>Your twin is analyzing your week...</Text>
                    </View>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    if (!review) {
        return (
            <LinearGradient colors={['#0a0a1a', '#0d1230', '#0a0a1a']} style={styles.gradient}>
                <SafeAreaView style={styles.safe}>
                    <View style={styles.loadingContainer}>
                        <Text style={{ fontSize: 48 }}>📋</Text>
                        <Text style={styles.emptyTitle}>No Data Yet</Text>
                        <Text style={styles.emptySubtitle}>Log at least a few days this week to unlock your weekly review.</Text>
                    </View>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    const weekDates = `${formatDate(review.weekStart)} – ${formatDate(review.weekEnd)}`;
    const completionColor = review.avgCompletion >= 0.7 ? '#4ade80' : review.avgCompletion >= 0.4 ? '#ffa94d' : '#ff6b6b';
    const energyColor = review.avgEnergy >= 3.5 ? '#4ade80' : review.avgEnergy >= 2.5 ? '#ffa94d' : '#ff6b6b';
    const habitRate = review.totalHabitOpportunities > 0
        ? Math.round((review.habitsCompleted / review.totalHabitOpportunities) * 100)
        : 0;

    return (
        <LinearGradient colors={['#0a0a1a', '#0d1230', '#0a0a1a']} style={styles.gradient}>
            <SafeAreaView style={styles.safe}>
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.headerTitle}>Weekly Review</Text>
                            <Text style={styles.headerSubtitle}>{weekDates}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.regenBtn}
                            onPress={handleRegenerate}
                            disabled={regenerating}
                        >
                            <Ionicons name="refresh-outline" size={18} color={regenerating ? '#3a3a5a' : '#7C9EFF'} />
                        </TouchableOpacity>
                    </View>

                    {/* Twin Summary */}
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryHeader}>
                            <View style={styles.twinDot}><View style={styles.twinDotInner} /></View>
                            <Text style={styles.summaryHeaderText}>Twin's Analysis</Text>
                        </View>
                        <Text style={styles.summaryText}>{review.twinSummary}</Text>
                    </View>

                    {/* Key Stats */}
                    <View style={styles.statsGrid}>
                        <StatCard value={`${Math.round(review.avgCompletion * 100)}%`} label="Task Completion" color={completionColor} icon="checkmark-done-outline" />
                        <StatCard value={`${review.avgEnergy.toFixed(1)}/5`} label="Avg Energy" color={energyColor} icon="flash-outline" />
                        <StatCard value={review.totalTasksCompleted.toString()} label="Tasks Done" color="#60a5fa" icon="list-outline" />
                        <StatCard value={`${habitRate}%`} label="Habit Rate" color="#a78bfa" icon="repeat-outline" />
                        <StatCard value={review.dominantMood ? MOOD_EMOJIS[review.dominantMood] ?? '😐' : '—'} label="Top Mood" color={MOOD_COLORS[review.dominantMood] ?? '#8a9cc8'} icon="happy-outline" />
                        <StatCard value={review.journalEntriesCount.toString()} label="Journal Entries" color="#ffa94d" icon="book-outline" />
                    </View>

                    {/* Top Wins */}
                    <View style={styles.card}>
                        <Text style={styles.cardEmoji}>🏆</Text>
                        <Text style={styles.cardTitle}>Top Wins</Text>
                        {review.topWins.map((win, i) => (
                            <View key={i} style={styles.listItem}>
                                <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                                <Text style={styles.listItemText}>{win}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Areas to Improve */}
                    <View style={styles.card}>
                        <Text style={styles.cardEmoji}>🔧</Text>
                        <Text style={styles.cardTitle}>Areas to Improve</Text>
                        {review.areasToImprove.map((area, i) => (
                            <View key={i} style={styles.listItem}>
                                <Ionicons name="arrow-forward-circle-outline" size={16} color="#ffa94d" />
                                <Text style={styles.listItemText}>{area}</Text>
                            </View>
                        ))}
                    </View>

                    {/* Recommendation */}
                    <View style={[styles.card, styles.recommendCard]}>
                        <Text style={styles.recommendEmoji}>💡</Text>
                        <Text style={styles.recommendTitle}>Twin's Recommendation for Next Week</Text>
                        <Text style={styles.recommendText}>{review.recommendation}</Text>
                    </View>

                    {/* Task Overview */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Task Overview</Text>
                        <View style={styles.taskBarRow}>
                            <Text style={styles.taskBarLabel}>Planned</Text>
                            <View style={styles.taskBarTrack}>
                                <View style={[styles.taskBarFill, { width: '100%', backgroundColor: 'rgba(124,158,255,0.3)' }]} />
                            </View>
                            <Text style={styles.taskBarValue}>{review.totalTasksPlanned}</Text>
                        </View>
                        <View style={styles.taskBarRow}>
                            <Text style={styles.taskBarLabel}>Completed</Text>
                            <View style={styles.taskBarTrack}>
                                <View style={[styles.taskBarFill, {
                                    width: `${Math.min(100, (review.totalTasksCompleted / Math.max(review.totalTasksPlanned, 1)) * 100)}%`,
                                    backgroundColor: completionColor,
                                }]} />
                            </View>
                            <Text style={styles.taskBarValue}>{review.totalTasksCompleted}</Text>
                        </View>
                    </View>

                    <Text style={styles.generatedAt}>
                        Generated {new Date(review.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </ScrollView>
            </SafeAreaView>
        </LinearGradient>
    );
}

function StatCard({ value, label, color, icon }: { value: string; label: string; color: string; icon: any }) {
    return (
        <View style={[styles.statCard, { borderColor: `${color}20` }]}>
            <Ionicons name={icon} size={18} color={color} />
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safe: { flex: 1 },
    scroll: { paddingBottom: 110 },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
    loadingText: { color: '#4a4a6a', fontSize: 14, marginTop: 16, textAlign: 'center', lineHeight: 22 },
    emptyTitle: { color: '#e8eeff', fontSize: 22, fontWeight: '700', marginTop: 20 },
    emptySubtitle: { color: '#4a4a6a', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 22 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16,
    },
    headerTitle: { fontSize: 28, fontWeight: '800', color: '#e8eeff', letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 12, color: '#4a4a6a', marginTop: 2 },
    regenBtn: {
        width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(124,158,255,0.1)',
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(124,158,255,0.2)',
    },
    summaryCard: {
        marginHorizontal: 20, marginBottom: 20, padding: 20, borderRadius: 20,
        backgroundColor: 'rgba(20,24,60,0.9)', borderWidth: 1, borderColor: 'rgba(124,158,255,0.2)',
    },
    summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    twinDot: {
        width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(124,158,255,0.15)',
        alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(124,158,255,0.4)',
    },
    twinDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#7C9EFF' },
    summaryHeaderText: { color: '#7C9EFF', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
    summaryText: { color: '#c8d8ff', fontSize: 14, lineHeight: 24 },
    statsGrid: {
        flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10, marginBottom: 20,
    },
    statCard: {
        width: '30%', flexGrow: 1, backgroundColor: 'rgba(20,24,60,0.8)', borderRadius: 16,
        padding: 16, alignItems: 'center', borderWidth: 1,
    },
    statValue: { fontSize: 20, fontWeight: '800', marginTop: 6, letterSpacing: -0.5 },
    statLabel: { fontSize: 9, color: '#4a4a6a', marginTop: 3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    card: {
        marginHorizontal: 20, marginBottom: 16, padding: 20, borderRadius: 20,
        backgroundColor: 'rgba(20,24,60,0.7)', borderWidth: 1, borderColor: 'rgba(124,158,255,0.1)',
    },
    cardEmoji: { fontSize: 20, marginBottom: 6 },
    cardTitle: { color: '#e8eeff', fontSize: 15, fontWeight: '700', marginBottom: 14 },
    listItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
    listItemText: { color: '#8a9cc8', fontSize: 13, lineHeight: 20, flex: 1 },
    recommendCard: { backgroundColor: 'rgba(124,158,255,0.05)', borderColor: 'rgba(124,158,255,0.25)' },
    recommendEmoji: { fontSize: 24, marginBottom: 8 },
    recommendTitle: { color: '#7C9EFF', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
    recommendText: { color: '#c8d8ff', fontSize: 14, lineHeight: 24 },
    taskBarRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    taskBarLabel: { color: '#4a4a6a', fontSize: 12, width: 70 },
    taskBarTrack: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' },
    taskBarFill: { height: 8, borderRadius: 4 },
    taskBarValue: { color: '#8a9cc8', fontSize: 13, fontWeight: '600', width: 26, textAlign: 'right' },
    generatedAt: { color: '#2a2a4a', fontSize: 11, textAlign: 'center', marginBottom: 20 },
});
