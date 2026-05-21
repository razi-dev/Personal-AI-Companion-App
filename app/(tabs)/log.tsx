import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { DailyEntry, EnergyLevel, Mood } from '../../types';
import { saveEntry, getEntryByDate, localDateString } from '../../services/memoryService';
import { refreshBehaviorEngine } from '../../services/behaviorEngine';

const MOODS: { label: string; value: Mood; emoji: string; color: string }[] = [
    { label: 'Overwhelmed', value: 'overwhelmed', emoji: '😰', color: '#ff6b6b' },
    { label: 'Stressed', value: 'stressed', emoji: '😤', color: '#ffa94d' },
    { label: 'Neutral', value: 'neutral', emoji: '😐', color: '#8a9cc8' },
    { label: 'Focused', value: 'focused', emoji: '🎯', color: '#60a5fa' },
    { label: 'Great', value: 'great', emoji: '🌟', color: '#4ade80' },
];

const ENERGY_LABELS = ['Exhausted', 'Tired', 'Okay', 'Good', 'Energized'];

export default function LogScreen() {
    const params = useLocalSearchParams<{ date?: string }>();
    const today = localDateString();
    const paramDate = typeof params.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
        ? params.date
        : null;
    const entryDate = paramDate ?? today;
    const isBackfill = entryDate !== today;
    const [existingEntry, setExistingEntry] = useState<DailyEntry | null>(null);

    const [tasksPlanned, setTasksPlanned] = useState<string[]>(['']);
    const [tasksCompleted, setTasksCompleted] = useState<string[]>(['']);
    const [energyLevel, setEnergyLevel] = useState<EnergyLevel>(3);
    const [mood, setMood] = useState<Mood>('neutral');
    const [notes, setNotes] = useState('');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        loadEntry();
    }, [entryDate]);

    const loadEntry = async () => {
        const entry = await getEntryByDate(entryDate);
        if (entry) {
            setExistingEntry(entry);
            setTasksPlanned(entry.tasksPlanned.length > 0 ? entry.tasksPlanned : ['']);
            setTasksCompleted(entry.tasksCompleted.length > 0 ? entry.tasksCompleted : ['']);
            setEnergyLevel(entry.energyLevel);
            setMood(entry.mood);
            setNotes(entry.notes);
            return;
        }
        setExistingEntry(null);
        setTasksPlanned(['']);
        setTasksCompleted(['']);
        setEnergyLevel(3);
        setMood('neutral');
        setNotes('');
    };

    const updateTask = (list: string[], setList: (v: string[]) => void, index: number, value: string) => {
        const updated = [...list];
        updated[index] = value;
        setList(updated);
    };

    const addTask = (list: string[], setList: (v: string[]) => void) => {
        setList([...list, '']);
    };

    const removeTask = (list: string[], setList: (v: string[]) => void, index: number) => {
        if (list.length === 1) return;
        setList(list.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        const planned = tasksPlanned.filter((t) => t.trim().length > 0);
        const completed = tasksCompleted.filter((t) => t.trim().length > 0);

        const entry: DailyEntry = {
            id: existingEntry?.id ?? `${entryDate}-${Date.now()}`,
            date: entryDate,
            tasksPlanned: planned,
            tasksCompleted: completed,
            energyLevel,
            mood,
            notes: notes.trim(),
            createdAt: existingEntry?.createdAt ?? new Date().toISOString(),
        };

        await saveEntry(entry);
        await refreshBehaviorEngine();
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    const [year, month, day] = entryDate.split('-').map(Number);
    const dateLabel = new Date(year, month - 1, day).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });

    return (
        <LinearGradient colors={['#0a0a1a', '#0d1230', '#0a0a1a']} style={styles.gradient}>
            <SafeAreaView style={styles.safe}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={100}
                >
                    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

                        {/* Header */}
                        <View style={styles.header}>
                            <Ionicons name="journal-outline" size={20} color="#7C9EFF" />
                            <View style={styles.headerText}>
                                <Text style={styles.headerTitle}>Daily Log</Text>
                                <Text style={styles.headerDate}>{dateLabel}</Text>
                            </View>
                            {existingEntry && (
                                <View style={styles.editBadge}>
                                    <Text style={styles.editBadgeText}>Editing</Text>
                                </View>
                            )}
                        </View>

                        {/* Mood selector */}
                        <Section title="How's your mood?">
                            <View style={styles.moodRow}>
                                {MOODS.map((m) => (
                                    <TouchableOpacity
                                        key={m.value}
                                        style={[styles.moodChip, mood === m.value && { borderColor: m.color, backgroundColor: `${m.color}18` }]}
                                        onPress={() => setMood(m.value)}
                                    >
                                        <Text style={styles.moodEmoji}>{m.emoji}</Text>
                                        <Text style={[styles.moodLabel, mood === m.value && { color: m.color }]}>{m.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </Section>

                        {/* Energy slider */}
                        <Section title={`Energy Level — ${ENERGY_LABELS[energyLevel - 1]}`}>
                            <View style={styles.energyRow}>
                                {[1, 2, 3, 4, 5].map((level) => (
                                    <TouchableOpacity
                                        key={level}
                                        style={[
                                            styles.energyDot,
                                            level <= energyLevel && styles.energyDotActive,
                                            level === energyLevel && styles.energyDotCurrent,
                                        ]}
                                        onPress={() => setEnergyLevel(level as EnergyLevel)}
                                    >
                                        <Text style={styles.energyNumber}>{level}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </Section>

                        {/* Tasks Planned */}
                        <Section title={`Tasks Planned ${isBackfill ? 'That Day' : 'Today'}`}>
                            {tasksPlanned.map((task, i) => (
                                <View key={i} style={styles.taskRow}>
                                    <View style={styles.taskBullet} />
                                    <TextInput
                                        style={styles.taskInput}
                                        value={task}
                                        onChangeText={(v) => updateTask(tasksPlanned, setTasksPlanned, i, v)}
                                        placeholder={`Task ${i + 1}...`}
                                        placeholderTextColor="#2a2a4a"
                                    />
                                    <TouchableOpacity onPress={() => removeTask(tasksPlanned, setTasksPlanned, i)}>
                                        <Ionicons name="close-circle" size={18} color="#3a3a5a" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            <TouchableOpacity style={styles.addBtn} onPress={() => addTask(tasksPlanned, setTasksPlanned)}>
                                <Ionicons name="add" size={16} color="#7C9EFF" />
                                <Text style={styles.addBtnText}>Add task</Text>
                            </TouchableOpacity>
                        </Section>

                        {/* Tasks Completed */}
                        <Section title={`Tasks Completed ${isBackfill ? 'That Day' : 'Today'}`}>
                            {tasksCompleted.map((task, i) => (
                                <View key={i} style={styles.taskRow}>
                                    <Ionicons name="checkmark-circle" size={16} color="#4ade80" style={{ marginRight: 8 }} />
                                    <TextInput
                                        style={styles.taskInput}
                                        value={task}
                                        onChangeText={(v) => updateTask(tasksCompleted, setTasksCompleted, i, v)}
                                        placeholder={`Completed task ${i + 1}...`}
                                        placeholderTextColor="#2a2a4a"
                                    />
                                    <TouchableOpacity onPress={() => removeTask(tasksCompleted, setTasksCompleted, i)}>
                                        <Ionicons name="close-circle" size={18} color="#3a3a5a" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            <TouchableOpacity style={styles.addBtn} onPress={() => addTask(tasksCompleted, setTasksCompleted)}>
                                <Ionicons name="add" size={16} color="#4ade80" />
                                <Text style={[styles.addBtnText, { color: '#4ade80' }]}>Add completed task</Text>
                            </TouchableOpacity>
                        </Section>

                        {/* Notes */}
                        <Section title="Notes & Observations">
                            <TextInput
                                style={styles.notesInput}
                                value={notes}
                                onChangeText={setNotes}
                                placeholder="What's on your mind? Any observations about today..."
                                placeholderTextColor="#2a2a4a"
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />
                        </Section>

                        {/* Save button */}
                        <TouchableOpacity
                            style={[styles.saveButton, saved && styles.saveButtonSuccess]}
                            onPress={handleSave}
                            activeOpacity={0.85}
                        >
                            <Ionicons
                                name={saved ? 'checkmark-circle' : 'save-outline'}
                                size={18}
                                color={saved ? '#4ade80' : '#0a0a1a'}
                            />
                            <Text style={[styles.saveButtonText, saved && { color: '#4ade80' }]}>
                                {saved ? 'Saved!' : isBackfill ? 'Save Log' : 'Save Today\'s Log'}
                            </Text>
                        </TouchableOpacity>

                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </LinearGradient>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {children}
        </View>
    );
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safe: { flex: 1 },
    scroll: { paddingBottom: 110, paddingHorizontal: 20 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 16,
        paddingBottom: 20,
    },
    headerText: {
        marginLeft: 10,
        flex: 1,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#e8eeff',
    },
    headerDate: {
        fontSize: 12,
        color: '#4a4a6a',
        marginTop: 2,
    },
    editBadge: {
        backgroundColor: 'rgba(124,158,255,0.15)',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: 'rgba(124,158,255,0.3)',
    },
    editBadgeText: {
        color: '#7C9EFF',
        fontSize: 11,
        fontWeight: '600',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        color: '#7C9EFF',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
        marginBottom: 12,
    },
    moodRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    moodChip: {
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(20,24,60,0.6)',
        minWidth: 72,
    },
    moodEmoji: {
        fontSize: 24,
        marginBottom: 4,
    },
    moodLabel: {
        fontSize: 10,
        color: '#4a4a6a',
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    energyRow: {
        flexDirection: 'row',
        gap: 10,
        justifyContent: 'center',
    },
    energyDot: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(20,24,60,0.6)',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    energyDotActive: {
        backgroundColor: 'rgba(124,158,255,0.15)',
        borderColor: 'rgba(124,158,255,0.4)',
    },
    energyDotCurrent: {
        backgroundColor: 'rgba(124,158,255,0.25)',
        borderColor: '#7C9EFF',
        shadowColor: '#7C9EFF',
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 4,
    },
    energyNumber: {
        color: '#e8eeff',
        fontSize: 18,
        fontWeight: '700',
    },
    taskRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        backgroundColor: 'rgba(20,24,60,0.5)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: 'rgba(124,158,255,0.08)',
    },
    taskBullet: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#7C9EFF',
        marginRight: 10,
    },
    taskInput: {
        flex: 1,
        color: '#e8eeff',
        fontSize: 14,
        paddingVertical: 8,
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
        opacity: 0.7,
    },
    addBtnText: {
        color: '#7C9EFF',
        fontSize: 13,
        fontWeight: '600',
    },
    notesInput: {
        backgroundColor: 'rgba(20,24,60,0.5)',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: '#e8eeff',
        fontSize: 14,
        minHeight: 110,
        borderWidth: 1,
        borderColor: 'rgba(124,158,255,0.1)',
        lineHeight: 22,
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#7C9EFF',
        borderRadius: 20,
        paddingVertical: 16,
        marginTop: 8,
        shadowColor: '#7C9EFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 6,
    },
    saveButtonSuccess: {
        backgroundColor: 'rgba(74,222,128,0.15)',
        borderWidth: 1.5,
        borderColor: '#4ade80',
    },
    saveButtonText: {
        color: '#0a0a1a',
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
});
