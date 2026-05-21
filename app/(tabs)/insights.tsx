import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getRecentEntries, getAllEntries, localDateString } from '../../services/memoryService';
import { buildInsightData, computeBehaviorInsights } from '../../utils/patternAnalysis';
import { getAllMessages } from '../../services/memoryService';
import { InsightData, DailyEntry, BehaviorInsights, BehaviorState } from '../../types';
import { getBehaviorState, refreshBehaviorEngine } from '../../services/behaviorEngine';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 48;

const MOOD_COLORS: Record<string, string> = {
    overwhelmed: '#ff6b6b',
    stressed: '#ffa94d',
    neutral: '#4a4a6a',
    focused: '#60a5fa',
    great: '#4ade80',
};

const MOOD_EMOJIS: Record<string, string> = {
    overwhelmed: '😰', stressed: '😤', neutral: '😐', focused: '🎯', great: '🌟',
};

export default function InsightsScreen() {
    const router = useRouter();
    const [entries, setEntries] = useState<DailyEntry[]>([]);
    const [allEntries, setAllEntries] = useState<DailyEntry[]>([]);
    const [insights, setInsights] = useState<InsightData | null>(null);
    const [behaviorInsights, setBehaviorInsights] = useState<BehaviorInsights | null>(null);
    const [behaviorState, setBehaviorState] = useState<BehaviorState | null>(null);
    const [activeTab, setActiveTab] = useState<'charts' | 'behavior' | 'heatmap'>('charts');

    useEffect(() => { loadInsights(); }, []);

    const loadInsights = async () => {
        const [recent, all, messages] = await Promise.all([
            getRecentEntries(14),
            getAllEntries(),
            getAllMessages(),
        ]);
        setEntries(recent);
        setAllEntries(all);
        const data = buildInsightData(recent);
        setInsights(data);
        const behavior = computeBehaviorInsights(all, messages);
        setBehaviorInsights(behavior);

        await refreshBehaviorEngine();
        const state = await getBehaviorState();
        setBehaviorState(state);
    };

    if (!insights || entries.length === 0) {
        return (
            <LinearGradient colors={['#0a0a1a', '#0d1230', '#0a0a1a']} style={styles.gradient}>
                <SafeAreaView style={styles.safe}>
                    <View style={styles.emptyContainer}>
                        <Ionicons name="analytics-outline" size={64} color="rgba(124,158,255,0.25)" />
                        <Text style={styles.emptyTitle}>No Data Yet</Text>
                        <Text style={styles.emptySubtitle}>
                            Log at least 2 days to start seeing your behavioral insights and patterns.
                        </Text>
                    </View>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    const { planningVsCompletion, energyTrend, weeklyPattern, avgCompletionRate, avgEnergyLevel } = insights;

    return (
        <LinearGradient colors={['#0a0a1a', '#0d1230', '#0a0a1a']} style={styles.gradient}>
            <SafeAreaView style={styles.safe}>
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.headerTitle}>Insights</Text>
                            <Text style={styles.headerSubtitle}>Last {entries.length} days of data</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.reviewBtn}
                            onPress={() => router.push('/(tabs)/review' as any)}
                        >
                            <Ionicons name="clipboard-outline" size={16} color="#a78bfa" />
                            <Text style={styles.reviewBtnText}>Weekly Review</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Summary cards */}
                    <View style={styles.summaryRow}>
                        <SummaryCard
                            label="Avg Completion"
                            value={`${Math.round(avgCompletionRate * 100)}%`}
                            icon="checkmark-done-outline"
                            color={avgCompletionRate > 0.7 ? '#4ade80' : avgCompletionRate > 0.4 ? '#ffa94d' : '#ff6b6b'}
                        />
                        <SummaryCard
                            label="Avg Energy"
                            value={`${avgEnergyLevel.toFixed(1)}/5`}
                            icon="flash-outline"
                            color={avgEnergyLevel >= 3.5 ? '#4ade80' : avgEnergyLevel >= 2.5 ? '#ffa94d' : '#ff6b6b'}
                        />
                    </View>

                    {/* Tab Picker */}
                    <View style={styles.tabPicker}>
                        {(['charts', 'behavior', 'heatmap'] as const).map((tab) => (
                            <TouchableOpacity
                                key={tab}
                                style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
                                onPress={() => setActiveTab(tab)}
                            >
                                <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
                                    {tab === 'charts' ? '📊 Charts' : tab === 'behavior' ? '🧠 Behavior' : '📅 Heatmap'}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Charts Tab */}
                    {activeTab === 'charts' && (
                        <>
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Planning vs Completion</Text>
                                <Text style={styles.cardSubtitle}>Daily task counts over {planningVsCompletion.labels.length} days</Text>
                                <BarChart
                                    labels={planningVsCompletion.labels}
                                    series={[
                                        { values: planningVsCompletion.planned, color: '#7C9EFF', label: 'Planned' },
                                        { values: planningVsCompletion.completed, color: '#4ade80', label: 'Done' },
                                    ]}
                                />
                                <View style={styles.legend}>
                                    <LegendDot color="#7C9EFF" label="Planned" />
                                    <LegendDot color="#4ade80" label="Completed" />
                                </View>
                            </View>

                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Energy Trend</Text>
                                <Text style={styles.cardSubtitle}>Daily energy level (1–5)</Text>
                                <LineChart labels={energyTrend.labels} values={energyTrend.values} maxValue={5} color="#a78bfa" />
                            </View>

                            <View style={styles.card}>
                                <View style={styles.patternHeader}>
                                    <Ionicons name="bulb-outline" size={16} color="#ffa94d" />
                                    <Text style={styles.cardTitle}>Pattern Analysis</Text>
                                </View>
                                <Text style={styles.patternText}>{weeklyPattern}</Text>
                            </View>

                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Recent Day Breakdown</Text>
                                {entries.slice(0, 5).map((entry) => (
                                    <DayRow key={entry.id} entry={entry} />
                                ))}
                            </View>
                        </>
                    )}

                    {/* Behavior Tab */}
                    {activeTab === 'behavior' && behaviorInsights && (
                        <>
                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Consistency Score</Text>
                                <View style={styles.consistencyRow}>
                                    <View style={[styles.consistencyArc, { borderColor: behaviorInsights.consistencyScore > 70 ? '#4ade80' : behaviorInsights.consistencyScore > 40 ? '#ffa94d' : '#ff6b6b' }]}>
                                        <Text style={styles.consistencyValue}>{behaviorInsights.consistencyScore}%</Text>
                                        <Text style={styles.consistencyLabel}>last 30 days</Text>
                                    </View>
                                    <View style={styles.consistencyInfo}>
                                        <Text style={styles.infoText}>You logged on {Math.round(behaviorInsights.consistencyScore * 0.3)}/30 days in the past month.</Text>
                                        {behaviorInsights.streakRisk && (
                                            <View style={styles.riskBadge}>
                                                <Ionicons name="warning-outline" size={14} color="#ffa94d" />
                                                <Text style={styles.riskText}>Streak at risk today</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>

                            {behaviorInsights.peakProductivityDay && (
                                <View style={styles.card}>
                                    <Text style={styles.cardTitle}>Peak Productivity Day</Text>
                                    <Text style={styles.bigStat}>{behaviorInsights.peakProductivityDay}</Text>
                                    <Text style={styles.patternText}>Based on your completion rates per day of week from all logged data.</Text>
                                </View>
                            )}

                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Mood → Productivity</Text>
                                <Text style={styles.cardSubtitle}>Average completion rate by mood</Text>
                                {Object.entries(behaviorInsights.moodProductivityCorrelation).map(([mood, rate]) => (
                                    <View key={mood} style={styles.moodCorrelationRow}>
                                        <Text style={styles.moodEmoji}>{MOOD_EMOJIS[mood] ?? '—'}</Text>
                                        <Text style={styles.moodCorrelationLabel}>{mood}</Text>
                                        <View style={styles.moodBarTrack}>
                                            <View style={[styles.moodBarFill, {
                                                width: `${Math.round(rate * 100)}%`,
                                                backgroundColor: MOOD_COLORS[mood] ?? '#7C9EFF',
                                            }]} />
                                        </View>
                                        <Text style={[styles.moodBarValue, { color: MOOD_COLORS[mood] ?? '#7C9EFF' }]}>
                                            {Math.round(rate * 100)}%
                                        </Text>
                                    </View>
                                ))}
                            </View>

                            <View style={styles.card}>
                                <Text style={styles.cardTitle}>Energy ↔ Completion Correlation</Text>
                                <Text style={styles.bigStat}>
                                    {behaviorInsights.energyCompletionCorrelation > 0.5 ? '📈 Strong' :
                                        behaviorInsights.energyCompletionCorrelation > 0.2 ? '📊 Moderate' :
                                            behaviorInsights.energyCompletionCorrelation < -0.2 ? '📉 Inverse' : '➡️ Weak'}
                                </Text>
                                <Text style={styles.patternText}>
                                    r = {behaviorInsights.energyCompletionCorrelation.toFixed(2)} — {
                                        behaviorInsights.energyCompletionCorrelation > 0.5
                                            ? 'Your productivity is strongly tied to your energy level.'
                                            : behaviorInsights.energyCompletionCorrelation > 0.2
                                                ? 'Higher energy tends to slightly improve your task completion.'
                                                : 'Your completion rate doesn\'t strongly depend on energy levels.'
                                    }
                                </Text>
                            </View>

                            {behaviorInsights.topicsMentioned.length > 0 && (
                                <View style={styles.card}>
                                    <Text style={styles.cardTitle}>Topics You Discuss Most</Text>
                                    <View style={styles.topicsRow}>
                                        {behaviorInsights.topicsMentioned.map((topic) => (
                                            <View key={topic} style={styles.topicChip}>
                                                <Text style={styles.topicText}>{topic}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {behaviorState?.forecast && (
                                <View style={styles.card}>
                                    <Text style={styles.cardTitle}>Next Day Forecast</Text>
                                    <Text style={styles.bigStat}>
                                        Energy {behaviorState.forecast.expectedEnergy.toFixed(1)}/5
                                    </Text>
                                    <Text style={styles.patternText}>
                                        Expected completion: {Math.round(behaviorState.forecast.expectedCompletionRate * 100)}% | Risk: {behaviorState.forecast.riskLevel}
                                    </Text>
                                </View>
                            )}

                            {behaviorState?.xai && (
                                <View style={styles.card}>
                                    <Text style={styles.cardTitle}>Why Your Twin Recommends This</Text>
                                    <Text style={styles.patternText}>{behaviorState.xai.explanation}</Text>
                                    <Text style={[styles.patternText, { marginTop: 8 }]}>
                                        Factors: {behaviorState.xai.factors.slice(0, 4).join(', ')}
                                    </Text>
                                    <Text style={[styles.patternText, { marginTop: 6 }]}>
                                        Confidence: {Math.round(behaviorState.xai.confidence * 100)}%
                                    </Text>
                                </View>
                            )}
                        </>
                    )}

                    {/* Heatmap Tab */}
                    {activeTab === 'heatmap' && (
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Mood Calendar</Text>
                            <Text style={styles.cardSubtitle}>Past 10 weeks — color = mood</Text>
                            <MoodHeatmapGrid entries={allEntries} />
                            <View style={styles.heatmapLegend}>
                                {Object.entries(MOOD_COLORS).map(([mood, color]) => (
                                    <View key={mood} style={styles.heatmapLegendItem}>
                                        <View style={[styles.heatmapLegendDot, { backgroundColor: color }]} />
                                        <Text style={styles.heatmapLegendText}>{MOOD_EMOJIS[mood]}</Text>
                                    </View>
                                ))}
                                <View style={styles.heatmapLegendItem}>
                                    <View style={[styles.heatmapLegendDot, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
                                    <Text style={styles.heatmapLegendText}>—</Text>
                                </View>
                            </View>
                        </View>
                    )}
                </ScrollView>
            </SafeAreaView>
        </LinearGradient>
    );
}

// ─── Mood Heatmap Grid (GitHub-style) ─────────────────────────────────────────
function MoodHeatmapGrid({ entries }: { entries: DailyEntry[] }) {
    const dateMap = new Map(entries.map((e) => [e.date, e.mood]));
    const days: { date: string; mood: string | null }[] = [];
    const DAYS = 70; // 10 weeks
    for (let i = DAYS - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = localDateString(d);
        days.push({ date: dateStr, mood: dateMap.get(dateStr) ?? null });
    }

    const weeks: { date: string; mood: string | null }[][] = [];
    for (let w = 0; w < 10; w++) {
        weeks.push(days.slice(w * 7, w * 7 + 7));
    }

    const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    return (
        <View style={styles.heatmapGrid}>
            <View style={styles.heatmapDayLabels}>
                {DAY_LABELS.map((d, i) => (
                    <Text key={i} style={styles.heatmapDayLabel}>{d}</Text>
                ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.heatmapWeeks}>
                    {weeks.map((week, wi) => (
                        <View key={wi} style={styles.heatmapWeekCol}>
                            {week.map((day, di) => (
                                <View
                                    key={di}
                                    style={[
                                        styles.heatmapCell,
                                        {
                                            backgroundColor: day.mood
                                                ? `${MOOD_COLORS[day.mood]}99`
                                                : 'rgba(255,255,255,0.04)',
                                            borderColor: day.date === localDateString()
                                                ? '#7C9EFF'
                                                : 'transparent',
                                        },
                                    ]}
                                />
                            ))}
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}

// ─── Bar Chart ─────────────────────────────────────────────────────────────────
function BarChart({ labels, series }: { labels: string[]; series: { values: number[]; color: string; label: string }[] }) {
    const maxVal = Math.max(...series.flatMap((s) => s.values), 1);
    const barH = 110;
    const barW = Math.min(18, (CHART_WIDTH / labels.length - 6) / series.length);
    return (
        <View style={barStyles.wrapper}>
            <View style={barStyles.barsContainer}>
                {labels.map((label, i) => (
                    <View key={i} style={barStyles.dayGroup}>
                        <View style={[barStyles.barsRow, { height: barH }]}>
                            {series.map((s) => {
                                const h = Math.max(((s.values[i] ?? 0) / maxVal) * barH, 3);
                                return <View key={s.label} style={[barStyles.bar, { height: h, backgroundColor: s.color, width: barW }]} />;
                            })}
                        </View>
                        <Text style={barStyles.label}>{label}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

// ─── Line Chart ─────────────────────────────────────────────────────────────────
function LineChart({ labels, values, maxValue, color }: { labels: string[]; values: number[]; maxValue: number; color: string }) {
    const chartH = 90;
    const pointWidth = CHART_WIDTH / Math.max(values.length - 1, 1);
    return (
        <View>
            <View style={[lineStyles.chartArea, { height: chartH }]}>
                {[0, 25, 50, 75, 100].map((pct) => (
                    <View key={pct} style={[lineStyles.gridLine, { top: (chartH * pct) / 100 }]} />
                ))}
                {values.map((val, i) => {
                    const x = i * pointWidth;
                    const y = chartH - (val / maxValue) * chartH;
                    return (
                        <React.Fragment key={i}>
                            <View style={[lineStyles.point, { left: x - 5, top: y - 5, backgroundColor: color }]} />
                            <Text style={[lineStyles.xLabel, { left: x - 12 }]}>{labels[i]}</Text>
                        </React.Fragment>
                    );
                })}
            </View>
        </View>
    );
}

function DayRow({ entry }: { entry: DailyEntry }) {
    const date = new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const ratio = entry.tasksPlanned.length === 0 ? 1 : entry.tasksCompleted.length / entry.tasksPlanned.length;
    return (
        <View style={dayStyles.row}>
            <Text style={dayStyles.date}>{date}</Text>
            <Text style={dayStyles.mood}>{MOOD_EMOJIS[entry.mood] ?? '—'}</Text>
            <Text style={dayStyles.energy}>⚡{entry.energyLevel}</Text>
            <View style={dayStyles.ratioBox}>
                <View style={[dayStyles.ratioFill, { width: `${Math.min(ratio * 100, 100)}%`, backgroundColor: ratio > 0.7 ? '#4ade80' : ratio > 0.4 ? '#ffa94d' : '#ff6b6b' }]} />
                <Text style={dayStyles.ratioText}>{entry.tasksCompleted.length}/{entry.tasksPlanned.length}</Text>
            </View>
        </View>
    );
}

function SummaryCard({ label, value, icon, color }: { label: string; value: string; icon: any; color: string }) {
    return (
        <View style={[styles.summaryCard, { borderColor: `${color}25` }]}>
            <Ionicons name={icon} size={22} color={color} />
            <Text style={[styles.summaryValue, { color }]}>{value}</Text>
            <Text style={styles.summaryLabel}>{label}</Text>
        </View>
    );
}

function LegendDot({ color, label }: { color: string; label: string }) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginRight: 5 }} />
            <Text style={{ color: '#4a4a6a', fontSize: 11 }}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safe: { flex: 1 },
    scroll: { paddingBottom: 110, paddingHorizontal: 20 },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
    emptyTitle: { color: '#e8eeff', fontSize: 22, fontWeight: '700', marginTop: 20 },
    emptySubtitle: { color: '#4a4a6a', fontSize: 14, textAlign: 'center', marginTop: 10, lineHeight: 22 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, paddingBottom: 20 },
    headerTitle: { fontSize: 26, fontWeight: '700', color: '#e8eeff', letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 12, color: '#4a4a6a', marginTop: 3 },
    reviewBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 16, backgroundColor: 'rgba(167,139,250,0.1)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)',
    },
    reviewBtnText: { color: '#a78bfa', fontWeight: '700', fontSize: 12 },
    summaryRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    summaryCard: { flex: 1, backgroundColor: 'rgba(20,24,60,0.8)', borderRadius: 18, alignItems: 'center', paddingVertical: 18, borderWidth: 1 },
    summaryValue: { fontSize: 24, fontWeight: '800', marginTop: 8, letterSpacing: -1 },
    summaryLabel: { fontSize: 11, color: '#4a4a6a', marginTop: 3, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    tabPicker: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    tabBtn: {
        flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center', borderWidth: 1.5,
        borderColor: 'rgba(124,158,255,0.15)', backgroundColor: 'rgba(20,24,60,0.6)',
    },
    tabBtnActive: { borderColor: '#7C9EFF', backgroundColor: 'rgba(124,158,255,0.12)' },
    tabBtnText: { color: '#4a4a6a', fontSize: 12, fontWeight: '700' },
    tabBtnTextActive: { color: '#7C9EFF' },
    card: {
        backgroundColor: 'rgba(20,24,60,0.7)', borderRadius: 20, padding: 18, marginBottom: 16,
        borderWidth: 1, borderColor: 'rgba(124,158,255,0.1)',
    },
    cardTitle: { color: '#e8eeff', fontSize: 15, fontWeight: '700', marginBottom: 4, marginLeft: 6 },
    cardSubtitle: { color: '#4a4a6a', fontSize: 11, marginBottom: 16 },
    patternHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    patternText: { color: '#8a9cc8', fontSize: 14, lineHeight: 22 },
    legend: { flexDirection: 'row', marginTop: 12 },
    consistencyRow: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 8 },
    consistencyArc: {
        width: 90, height: 90, borderRadius: 45, borderWidth: 5, alignItems: 'center',
        justifyContent: 'center', backgroundColor: 'rgba(20,24,60,0.9)',
    },
    consistencyValue: { color: '#e8eeff', fontSize: 22, fontWeight: '800' },
    consistencyLabel: { color: '#4a4a6a', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5 },
    consistencyInfo: { flex: 1 },
    infoText: { color: '#8a9cc8', fontSize: 13, lineHeight: 20 },
    riskBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
    riskText: { color: '#ffa94d', fontSize: 12 },
    bigStat: { color: '#7C9EFF', fontSize: 24, fontWeight: '800', marginBottom: 8 },
    moodCorrelationRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    moodEmoji: { fontSize: 18, width: 24 },
    moodCorrelationLabel: { color: '#8a9cc8', fontSize: 12, width: 80 },
    moodBarTrack: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4, overflow: 'hidden' },
    moodBarFill: { height: 8, borderRadius: 4 },
    moodBarValue: { fontSize: 12, fontWeight: '700', width: 32, textAlign: 'right' },
    topicsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
    topicChip: {
        paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
        borderColor: 'rgba(124,158,255,0.25)', backgroundColor: 'rgba(124,158,255,0.08)',
    },
    topicText: { color: '#7C9EFF', fontSize: 12, fontWeight: '600' },
    heatmapGrid: { marginTop: 16 },
    heatmapDayLabels: { flexDirection: 'row', gap: 5, marginBottom: 6 },
    heatmapDayLabel: { width: 14, fontSize: 9, color: '#4a4a6a', textAlign: 'center' },
    heatmapWeeks: { flexDirection: 'row', gap: 5 },
    heatmapWeekCol: { gap: 5 },
    heatmapCell: { width: 14, height: 14, borderRadius: 3, borderWidth: 1 },
    heatmapLegend: { flexDirection: 'row', gap: 12, marginTop: 12, flexWrap: 'wrap' },
    heatmapLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    heatmapLegendDot: { width: 10, height: 10, borderRadius: 2 },
    heatmapLegendText: { color: '#4a4a6a', fontSize: 11 },
});

const barStyles = StyleSheet.create({
    wrapper: { marginTop: 8 },
    barsContainer: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around' },
    dayGroup: { alignItems: 'center' },
    barsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
    bar: { borderRadius: 4, minHeight: 3 },
    label: { color: '#4a4a6a', fontSize: 9, marginTop: 5, letterSpacing: 0.3 },
});

const lineStyles = StyleSheet.create({
    chartArea: { position: 'relative', marginVertical: 10 },
    gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.04)' },
    point: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
    xLabel: { position: 'absolute', bottom: -20, fontSize: 9, color: '#4a4a6a', width: 24, textAlign: 'center' },
});

const dayStyles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
    date: { color: '#8a9cc8', fontSize: 12, flex: 1 },
    mood: { fontSize: 16, marginRight: 10 },
    energy: { color: '#a78bfa', fontSize: 12, marginRight: 12, minWidth: 24 },
    ratioBox: { width: 70, height: 18, backgroundColor: 'rgba(20,24,60,0.8)', borderRadius: 9, overflow: 'hidden', position: 'relative', justifyContent: 'center', alignItems: 'center' },
    ratioFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 9 },
    ratioText: { color: '#e8eeff', fontSize: 10, fontWeight: '700', zIndex: 1 },
});
