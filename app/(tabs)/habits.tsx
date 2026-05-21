import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    TextInput, Alert, Modal, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Habit, HabitWithStats, HabitFrequency } from '../../types';
import { getHabitsWithStats, saveHabit, deleteHabit, toggleHabitEntry, computeHabitStreakRisk } from '../../services/habitService';
import { sendStreakMilestoneAlert } from '../../services/notificationService';
import { refreshBehaviorEngine } from '../../services/behaviorEngine';
import { localDateString } from '../../services/memoryService';

const HABIT_ICONS = ['🏃', '💪', '📚', '🧘', '💧', '🥗', '😴', '✍️', '🎯', '🎸', '🌿', '🧠', '🏋️', '🚴', '🎨', '🙏', '💊', '📝', '☀️', '🌙'];
const HABIT_COLORS = ['#7C9EFF', '#a78bfa', '#4ade80', '#60a5fa', '#ffa94d', '#f472b6', '#34d399', '#fb923c', '#a3e635', '#22d3ee'];
const today = localDateString();

export default function HabitsScreen() {
    const [habits, setHabits] = useState<HabitWithStats[]>([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadHabits = useCallback(async () => {
        const data = await getHabitsWithStats();
        setHabits(data);
        setLoading(false);
    }, []);

    useEffect(() => { loadHabits(); }, []);

    const handleToggle = async (habit: HabitWithStats) => {
        const wasCompleted = habit.todayCompleted;
        await toggleHabitEntry(habit.id, today);
        const newStreak = wasCompleted ? habit.currentStreak - 1 : habit.currentStreak + 1;
        if (!wasCompleted && [7, 14, 21, 30, 50, 100].includes(newStreak)) {
            await sendStreakMilestoneAlert(habit.name, newStreak);
        }
        loadHabits();
        await refreshBehaviorEngine();
    };

    const handleDelete = (id: string, name: string) => {
        Alert.alert('Delete Habit', `Remove "${name}"? This can't be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => { await deleteHabit(id); loadHabits(); await refreshBehaviorEngine(); } },
        ]);
    };

    const completedToday = habits.filter((h) => h.todayCompleted).length;
    const streakRisk = computeHabitStreakRisk(habits);

    return (
        <LinearGradient colors={['#0a0a1a', '#0d1230', '#0a0a1a']} style={styles.gradient}>
            <SafeAreaView style={styles.safe}>
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View>
                            <Text style={styles.headerTitle}>Habits</Text>
                            <Text style={styles.headerSubtitle}>
                                {completedToday}/{habits.length} done today
                            </Text>
                        </View>
                        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
                            <Ionicons name="add" size={22} color="#7C9EFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Streak Risk Warning */}
                    {streakRisk && (
                        <View style={styles.riskBanner}>
                            <Ionicons name="warning-outline" size={16} color="#ffa94d" />
                            <Text style={styles.riskText}>Some streaks are at risk — check in before midnight!</Text>
                        </View>
                    )}

                    {/* Progress Ring */}
                    {habits.length > 0 && (
                        <View style={styles.progressCard}>
                            <View style={styles.progressRingOuter}>
                                <View style={[styles.progressRingFill, {
                                    borderColor: completedToday / Math.max(habits.length, 1) > 0.7 ? '#4ade80' : '#7C9EFF'
                                }]} />
                                <View style={styles.progressRingInner}>
                                    <Text style={styles.progressPercent}>
                                        {Math.round((completedToday / Math.max(habits.length, 1)) * 100)}%
                                    </Text>
                                    <Text style={styles.progressLabel}>today</Text>
                                </View>
                            </View>
                            <View style={styles.progressStats}>
                                <StatPill label="Active" value={`${habits.length}`} color="#7C9EFF" />
                                <StatPill label="Best Streak" value={`${Math.max(...habits.map((h) => h.longestStreak), 0)}d`} color="#a78bfa" />
                                <StatPill label="Avg Rate" value={`${Math.round(habits.reduce((a, h) => a + h.completionRate, 0) / Math.max(habits.length, 1) * 100)}%`} color="#4ade80" />
                            </View>
                        </View>
                    )}

                    {/* Habit List */}
                    {loading ? null : habits.length === 0 ? (
                        <EmptyHabits onAdd={() => setShowAddModal(true)} />
                    ) : (
                        <View style={styles.habitList}>
                            <Text style={styles.sectionTitle}>TODAY</Text>
                            {habits.map((habit) => (
                                <HabitCard
                                    key={habit.id}
                                    habit={habit}
                                    onToggle={() => handleToggle(habit)}
                                    onDelete={() => handleDelete(habit.id, habit.name)}
                                />
                            ))}
                        </View>
                    )}

                    {/* Heatmap Section */}
                    {habits.length > 0 && (
                        <View style={styles.heatmapSection}>
                            <Text style={styles.sectionTitle}>30-DAY HISTORY</Text>
                            {habits.slice(0, 3).map((habit) => (
                                <HabitHeatmapRow key={habit.id} habit={habit} />
                            ))}
                        </View>
                    )}
                </ScrollView>

                <AddHabitModal
                    visible={showAddModal}
                    onClose={() => setShowAddModal(false)}
                    onAdd={async (habit) => {
                        await saveHabit(habit);
                        setShowAddModal(false);
                        loadHabits();
                        await refreshBehaviorEngine();
                    }}
                />
            </SafeAreaView>
        </LinearGradient>
    );
}

// ─── Habit Card ───────────────────────────────────────────────────────────────
function HabitCard({ habit, onToggle, onDelete }: { habit: HabitWithStats; onToggle: () => void; onDelete: () => void }) {
    return (
        <View style={[styles.habitCard, habit.todayCompleted && styles.habitCardDone]}>
            <TouchableOpacity
                style={[styles.checkCircle, habit.todayCompleted && { backgroundColor: habit.color, borderColor: habit.color }]}
                onPress={onToggle}
            >
                {habit.todayCompleted && <Ionicons name="checkmark" size={18} color="#0a0a1a" />}
            </TouchableOpacity>

            <Text style={styles.habitIcon}>{habit.icon}</Text>

            <View style={{ flex: 1 }}>
                <Text style={[styles.habitName, habit.todayCompleted && styles.habitNameDone]}>{habit.name}</Text>
                <View style={styles.habitMeta}>
                    {habit.currentStreak > 0 && (
                        <View style={styles.streakBadge}>
                            <Text style={styles.streakText}>🔥 {habit.currentStreak}d</Text>
                        </View>
                    )}
                    <Text style={styles.habitRate}>{Math.round(habit.completionRate * 100)}% rate</Text>
                </View>
            </View>

            <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={16} color="#3a3a5a" />
            </TouchableOpacity>
        </View>
    );
}

// ─── Habit Heatmap Row ────────────────────────────────────────────────────────
function HabitHeatmapRow({ habit }: { habit: HabitWithStats }) {
    return (
        <View style={styles.heatmapRow}>
            <Text style={styles.heatmapLabel}>{habit.icon} {habit.name}</Text>
            <View style={styles.heatmapDots}>
                {habit.last30Days.map((done, i) => (
                    <View
                        key={i}
                        style={[
                            styles.heatmapDot,
                            { backgroundColor: done ? habit.color : 'rgba(255,255,255,0.05)' },
                        ]}
                    />
                ))}
            </View>
        </View>
    );
}

// ─── Add Habit Modal ──────────────────────────────────────────────────────────
function AddHabitModal({ visible, onClose, onAdd }: {
    visible: boolean; onClose: () => void; onAdd: (habit: Habit) => void;
}) {
    const [name, setName] = useState('');
    const [icon, setIcon] = useState('🎯');
    const [color, setColor] = useState('#7C9EFF');
    const [frequency, setFrequency] = useState<HabitFrequency>('daily');

    const handleAdd = () => {
        if (!name.trim()) return;
        const habit: Habit = {
            id: `habit-${Date.now()}`,
            name: name.trim(),
            icon,
            color,
            frequency,
            targetDays: 30,
            createdAt: new Date().toISOString(),
            isActive: true,
        };
        onAdd(habit);
        setName(''); setIcon('🎯'); setColor('#7C9EFF'); setFrequency('daily');
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.modalOverlay}>
                <View style={styles.modalCard}>
                    <Text style={styles.modalTitle}>New Habit</Text>

                    <TextInput
                        style={styles.modalInput}
                        value={name}
                        onChangeText={setName}
                        placeholder="Habit name..."
                        placeholderTextColor="#3a3a5a"
                        autoFocus
                    />

                    <Text style={styles.modalLabel}>Icon</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.iconRow}>
                            {HABIT_ICONS.map((ic) => (
                                <TouchableOpacity
                                    key={ic}
                                    style={[styles.iconChip, icon === ic && styles.iconChipActive]}
                                    onPress={() => setIcon(ic)}
                                >
                                    <Text style={{ fontSize: 22 }}>{ic}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>

                    <Text style={styles.modalLabel}>Color</Text>
                    <View style={styles.colorRow}>
                        {HABIT_COLORS.map((c) => (
                            <TouchableOpacity
                                key={c}
                                style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotActive]}
                                onPress={() => setColor(c)}
                            />
                        ))}
                    </View>

                    <Text style={styles.modalLabel}>Frequency</Text>
                    <View style={styles.freqRow}>
                        {(['daily', 'weekdays', 'weekends'] as HabitFrequency[]).map((f) => (
                            <TouchableOpacity
                                key={f}
                                style={[styles.freqChip, frequency === f && styles.freqChipActive]}
                                onPress={() => setFrequency(f)}
                            >
                                <Text style={[styles.freqText, frequency === f && { color: '#7C9EFF' }]}>{f}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.modalButtons}>
                        <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
                            <Text style={styles.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalAddBtn, !name.trim() && { opacity: 0.4 }]}
                            onPress={handleAdd}
                            disabled={!name.trim()}
                        >
                            <Text style={styles.modalAddText}>Add Habit</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

function EmptyHabits({ onAdd }: { onAdd: () => void }) {
    return (
        <View style={styles.emptyState}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🌱</Text>
            <Text style={styles.emptyTitle}>No habits yet</Text>
            <Text style={styles.emptySubtitle}>Start tracking a habit and your twin will monitor your streaks and patterns.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={onAdd}>
                <Text style={styles.emptyBtnText}>+ Add Your First Habit</Text>
            </TouchableOpacity>
        </View>
    );
}

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <View style={styles.statPill}>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safe: { flex: 1 },
    scroll: { paddingBottom: 110 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16,
    },
    headerTitle: { fontSize: 28, fontWeight: '800', color: '#e8eeff', letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 13, color: '#4a4a6a', marginTop: 2 },
    addBtn: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(124,158,255,0.12)',
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(124,158,255,0.25)',
    },
    riskBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        marginHorizontal: 20, marginBottom: 12, padding: 12, borderRadius: 12,
        backgroundColor: 'rgba(255,169,77,0.1)', borderWidth: 1, borderColor: 'rgba(255,169,77,0.3)',
    },
    riskText: { color: '#ffa94d', fontSize: 13, flex: 1 },
    progressCard: {
        marginHorizontal: 20, marginBottom: 20, padding: 20, borderRadius: 20,
        backgroundColor: 'rgba(20,24,60,0.8)', borderWidth: 1, borderColor: 'rgba(124,158,255,0.12)',
        flexDirection: 'row', alignItems: 'center', gap: 20,
    },
    progressRingOuter: {
        width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: 'rgba(124,158,255,0.15)',
    },
    progressRingFill: { position: 'absolute', inset: 4, borderRadius: 36, borderWidth: 4, borderColor: '#7C9EFF' },
    progressRingInner: { alignItems: 'center' },
    progressPercent: { fontSize: 18, fontWeight: '800', color: '#e8eeff' },
    progressLabel: { fontSize: 10, color: '#4a4a6a', fontWeight: '600', textTransform: 'uppercase' },
    progressStats: { flex: 1, gap: 8 },
    statPill: {},
    statValue: { fontSize: 16, fontWeight: '700' },
    statLabel: { fontSize: 10, color: '#4a4a6a', textTransform: 'uppercase', letterSpacing: 0.5 },
    sectionTitle: {
        color: '#7C9EFF', fontSize: 11, fontWeight: '700', letterSpacing: 1.2,
        textTransform: 'uppercase', marginBottom: 12, paddingHorizontal: 20,
    },
    habitList: { marginBottom: 28 },
    habitCard: {
        flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 10,
        padding: 16, borderRadius: 18, backgroundColor: 'rgba(20,24,60,0.8)',
        borderWidth: 1, borderColor: 'rgba(124,158,255,0.1)', gap: 12,
    },
    habitCardDone: { backgroundColor: 'rgba(20,24,60,0.5)', borderColor: 'rgba(124,158,255,0.05)' },
    checkCircle: {
        width: 32, height: 32, borderRadius: 16, borderWidth: 2,
        borderColor: 'rgba(124,158,255,0.3)', alignItems: 'center', justifyContent: 'center',
    },
    habitIcon: { fontSize: 24 },
    habitName: { color: '#e8eeff', fontSize: 15, fontWeight: '700' },
    habitNameDone: { color: '#4a4a6a', textDecorationLine: 'line-through' },
    habitMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
    streakBadge: {
        backgroundColor: 'rgba(255,169,77,0.15)', paddingHorizontal: 8, paddingVertical: 2,
        borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,169,77,0.3)',
    },
    streakText: { fontSize: 11, color: '#ffa94d', fontWeight: '700' },
    habitRate: { fontSize: 11, color: '#4a4a6a' },
    deleteBtn: { padding: 4 },
    heatmapSection: { paddingBottom: 20 },
    heatmapRow: { marginHorizontal: 20, marginBottom: 14 },
    heatmapLabel: { color: '#8a9cc8', fontSize: 12, fontWeight: '600', marginBottom: 6 },
    heatmapDots: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
    heatmapDot: { width: 8, height: 8, borderRadius: 2 },
    emptyState: { alignItems: 'center', paddingHorizontal: 40, paddingTop: 40 },
    emptyTitle: { color: '#e8eeff', fontSize: 20, fontWeight: '700', marginBottom: 8 },
    emptySubtitle: { color: '#4a4a6a', fontSize: 14, textAlign: 'center', lineHeight: 22 },
    emptyBtn: {
        marginTop: 24, backgroundColor: 'rgba(124,158,255,0.15)', borderWidth: 1,
        borderColor: 'rgba(124,158,255,0.4)', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 14,
    },
    emptyBtnText: { color: '#7C9EFF', fontWeight: '700', fontSize: 14 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    modalCard: {
        backgroundColor: '#0d1230', borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: 28, paddingBottom: 48, borderWidth: 1, borderColor: 'rgba(124,158,255,0.15)',
    },
    modalTitle: { color: '#e8eeff', fontSize: 22, fontWeight: '800', marginBottom: 20 },
    modalInput: {
        backgroundColor: 'rgba(20,24,60,0.9)', borderRadius: 14, paddingHorizontal: 16,
        paddingVertical: 14, color: '#e8eeff', fontSize: 16, borderWidth: 1,
        borderColor: 'rgba(124,158,255,0.2)', marginBottom: 20,
    },
    modalLabel: { color: '#7C9EFF', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
    iconRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    iconChip: {
        width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(20,24,60,0.8)', borderWidth: 1.5, borderColor: 'rgba(124,158,255,0.1)',
    },
    iconChipActive: { borderColor: '#7C9EFF', backgroundColor: 'rgba(124,158,255,0.15)' },
    colorRow: { flexDirection: 'row', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
    colorDot: { width: 32, height: 32, borderRadius: 16 },
    colorDotActive: { borderWidth: 3, borderColor: '#fff' },
    freqRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    freqChip: {
        flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
        borderWidth: 1.5, borderColor: 'rgba(124,158,255,0.15)', backgroundColor: 'rgba(20,24,60,0.6)',
    },
    freqChipActive: { borderColor: '#7C9EFF', backgroundColor: 'rgba(124,158,255,0.12)' },
    freqText: { color: '#4a4a6a', fontWeight: '700', fontSize: 13 },
    modalButtons: { flexDirection: 'row', gap: 12 },
    modalCancelBtn: {
        flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center',
        borderWidth: 1, borderColor: 'rgba(124,158,255,0.2)',
    },
    modalCancelText: { color: '#4a4a6a', fontWeight: '600' },
    modalAddBtn: {
        flex: 2, paddingVertical: 16, borderRadius: 14, alignItems: 'center',
        backgroundColor: '#7C9EFF',
    },
    modalAddText: { color: '#0a0a1a', fontWeight: '800', fontSize: 15 },
});
