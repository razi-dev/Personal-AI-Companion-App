import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    TextInput, Alert, Modal, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { JournalEntry, Mood, EnergyLevel } from '../../types';
import {
    getAllJournalEntries, saveJournalEntry, deleteJournalEntry,
    createNewJournalEntry, countWords,
} from '../../services/journalService';
import { getAIDecision, formatAIResponseForChat } from '../../services/aiService';
import { getProfile } from '../../services/profileService';
import { refreshBehaviorEngine } from '../../services/behaviorEngine';

const MOODS: { value: Mood; emoji: string; color: string }[] = [
    { value: 'overwhelmed', emoji: '😰', color: '#ff6b6b' },
    { value: 'stressed', emoji: '😤', color: '#ffa94d' },
    { value: 'neutral', emoji: '😐', color: '#8a9cc8' },
    { value: 'focused', emoji: '🎯', color: '#60a5fa' },
    { value: 'great', emoji: '🌟', color: '#4ade80' },
];

export default function JournalScreen() {
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterMood, setFilterMood] = useState<Mood | null>(null);

    const loadEntries = useCallback(async () => {
        const all = await getAllJournalEntries();
        all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setEntries(all);
    }, []);

    useEffect(() => { loadEntries(); }, []);

    const handleNewEntry = () => {
        const entry = createNewJournalEntry({ title: formatDateTitle(new Date()) });
        setSelectedEntry(entry);
        setIsEditing(true);
    };

    const handleSave = async (entry: JournalEntry) => {
        await saveJournalEntry(entry);
        await refreshBehaviorEngine();
        setIsEditing(false);
        setSelectedEntry(null);
        loadEntries();
    };

    const handleDelete = (id: string) => {
        Alert.alert('Delete Entry', 'Delete this journal entry permanently?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    await deleteJournalEntry(id);
                    await refreshBehaviorEngine();
                    setSelectedEntry(null);
                    setIsEditing(false);
                    loadEntries();
                }
            },
        ]);
    };

    const filtered = entries.filter((e) => {
        const matchesSearch = !searchQuery || e.title.toLowerCase().includes(searchQuery.toLowerCase()) || e.content.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesMood = !filterMood || e.mood === filterMood;
        return matchesSearch && matchesMood;
    });

    if (isEditing && selectedEntry) {
        return (
            <EditEntryScreen
                entry={selectedEntry}
                onSave={handleSave}
                onDelete={() => handleDelete(selectedEntry.id)}
                onClose={() => { setIsEditing(false); setSelectedEntry(null); }}
            />
        );
    }

    return (
        <LinearGradient colors={['#0a0a1a', '#0d1230', '#0a0a1a']} style={styles.gradient}>
            <SafeAreaView style={styles.safe}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.headerTitle}>Journal</Text>
                        <Text style={styles.headerSubtitle}>{entries.length} entries</Text>
                    </View>
                    <TouchableOpacity style={styles.newBtn} onPress={handleNewEntry}>
                        <Ionicons name="create-outline" size={20} color="#7C9EFF" />
                        <Text style={styles.newBtnText}>New</Text>
                    </TouchableOpacity>
                </View>

                {/* Search */}
                <View style={styles.searchRow}>
                    <Ionicons name="search-outline" size={16} color="#4a4a6a" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder="Search entries..."
                        placeholderTextColor="#3a3a5a"
                    />
                    {searchQuery ? (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={16} color="#4a4a6a" />
                        </TouchableOpacity>
                    ) : null}
                </View>

                {/* Mood Filter */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moodFilter}>
                    <TouchableOpacity
                        style={[styles.moodFilterChip, !filterMood && styles.moodFilterChipActive]}
                        onPress={() => setFilterMood(null)}
                    >
                        <Text style={styles.moodFilterText}>All</Text>
                    </TouchableOpacity>
                    {MOODS.map((m) => (
                        <TouchableOpacity
                            key={m.value}
                            style={[styles.moodFilterChip, filterMood === m.value && { borderColor: m.color, backgroundColor: `${m.color}15` }]}
                            onPress={() => setFilterMood(filterMood === m.value ? null : m.value)}
                        >
                            <Text>{m.emoji}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Entry List */}
                {filtered.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={{ fontSize: 48 }}>📔</Text>
                        <Text style={styles.emptyTitle}>{entries.length === 0 ? 'Your journal is empty' : 'No matching entries'}</Text>
                        <Text style={styles.emptySubtitle}>
                            {entries.length === 0
                                ? 'Start writing — your twin reads your journals to give more personalized advice.'
                                : 'Try a different search or mood filter.'}
                        </Text>
                        {entries.length === 0 && (
                            <TouchableOpacity style={styles.emptyBtn} onPress={handleNewEntry}>
                                <Text style={styles.emptyBtnText}>Write First Entry →</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ) : (
                    <FlatList
                        data={filtered}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.list}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.entryCard}
                                onPress={() => { setSelectedEntry(item); setIsEditing(true); }}
                                activeOpacity={0.75}
                            >
                                <View style={styles.entryHeader}>
                                    <Text style={styles.entryDate}>{formatRelativeDate(item.date)}</Text>
                                    {item.mood && (
                                        <Text>{MOODS.find((m) => m.value === item.mood)?.emoji ?? ''}</Text>
                                    )}
                                </View>
                                <Text style={styles.entryTitle} numberOfLines={1}>
                                    {item.title || 'Untitled Entry'}
                                </Text>
                                <Text style={styles.entryPreview} numberOfLines={2}>
                                    {item.content || 'No content yet...'}
                                </Text>
                                <View style={styles.entryFooter}>
                                    <Text style={styles.wordCount}>{item.wordCount} words</Text>
                                    {item.aiReflection && (
                                        <View style={styles.aiBadge}>
                                            <Text style={styles.aiBadgeText}>✨ AI Reflection</Text>
                                        </View>
                                    )}
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                )}
            </SafeAreaView>
        </LinearGradient>
    );
}

// ─── Edit Entry Screen ────────────────────────────────────────────────────────
function EditEntryScreen({ entry, onSave, onDelete, onClose }: {
    entry: JournalEntry; onSave: (e: JournalEntry) => void;
    onDelete: () => void; onClose: () => void;
}) {
    const [title, setTitle] = useState(entry.title);
    const [content, setContent] = useState(entry.content);
    const [mood, setMood] = useState<Mood | undefined>(entry.mood);
    const [aiReflection, setAiReflection] = useState(entry.aiReflection ?? '');
    const [loadingAI, setLoadingAI] = useState(false);

    const handleGetAIReflection = async () => {
        if (!content.trim()) return;
        setLoadingAI(true);
        try {
            const profile = await getProfile();
            const response = await getAIDecision(
                `Please reflect on this journal entry and give me a thoughtful insight about what it reveals:\n\n"${content}"`,
                [], [], profile
            );
            setAiReflection(formatAIResponseForChat(response));
        } catch {
            setAiReflection('Could not get AI reflection. Try again later.');
        } finally {
            setLoadingAI(false);
        }
    };

    const handleSave = () => {
        onSave({
            ...entry,
            title: title || formatDateTitle(new Date(entry.date)),
            content,
            mood,
            aiReflection: aiReflection || undefined,
            wordCount: countWords(content),
            updatedAt: new Date().toISOString(),
        });
    };

    return (
        <LinearGradient colors={['#0a0a1a', '#0d1230', '#0a0a1a']} style={styles.gradient}>
            <SafeAreaView style={styles.safe}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    {/* Toolbar */}
                    <View style={styles.editToolbar}>
                        <TouchableOpacity onPress={onClose}>
                            <Text style={styles.toolbarCancel}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.toolbarWords}>{countWords(content)} words</Text>
                        <View style={styles.toolbarRight}>
                            <TouchableOpacity onPress={onDelete} style={{ marginRight: 16 }}>
                                <Ionicons name="trash-outline" size={20} color="#ff6b6b" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSave}>
                                <Text style={styles.toolbarSave}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView contentContainerStyle={styles.editScroll}>
                        {/* Title */}
                        <TextInput
                            style={[styles.titleInput, { fontSize: 24 }]}
                            value={title}
                            onChangeText={setTitle}
                            placeholder="Title..."
                            placeholderTextColor="#2a2a4a"
                        />

                        {/* Date */}
                        <Text style={styles.editDate}>{formatRelativeDate(entry.date)}</Text>

                        {/* Mood selector */}
                        <View style={styles.moodRow}>
                            {MOODS.map((m) => (
                                <TouchableOpacity
                                    key={m.value}
                                    style={[styles.moodDot, mood === m.value && { backgroundColor: `${m.color}30`, borderColor: m.color }]}
                                    onPress={() => setMood(mood === m.value ? undefined : m.value)}
                                >
                                    <Text style={{ fontSize: 20 }}>{m.emoji}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Content */}
                        <TextInput
                            style={styles.contentInput}
                            value={content}
                            onChangeText={setContent}
                            placeholder="What's on your mind today?&#10;&#10;Write freely — your twin will read this to give you better advice..."
                            placeholderTextColor="#2a2a4a"
                            multiline
                            textAlignVertical="top"
                            autoFocus={!content}
                        />

                        {/* AI Reflection */}
                        {aiReflection ? (
                            <View style={styles.aiReflectionCard}>
                                <View style={styles.aiReflectionHeader}>
                                    <Text style={styles.aiReflectionTitle}>✨ Twin's Reflection</Text>
                                    <TouchableOpacity onPress={handleGetAIReflection}>
                                        <Ionicons name="refresh-outline" size={16} color="#7C9EFF" />
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.aiReflectionText}>{aiReflection}</Text>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={[styles.aiReflectBtn, (!content.trim() || loadingAI) && { opacity: 0.4 }]}
                                onPress={handleGetAIReflection}
                                disabled={!content.trim() || loadingAI}
                            >
                                <Ionicons name="sparkles-outline" size={16} color="#a78bfa" />
                                <Text style={styles.aiReflectText}>
                                    {loadingAI ? 'Getting reflection...' : 'Get AI Reflection'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </LinearGradient>
    );
}

// ─── Utils ────────────────────────────────────────────────────────────────────
function formatDateTitle(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function formatRelativeDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safe: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12,
    },
    headerTitle: { fontSize: 28, fontWeight: '800', color: '#e8eeff', letterSpacing: -0.5 },
    headerSubtitle: { fontSize: 12, color: '#4a4a6a', marginTop: 2 },
    newBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10,
        borderRadius: 20, backgroundColor: 'rgba(124,158,255,0.12)', borderWidth: 1, borderColor: 'rgba(124,158,255,0.25)',
    },
    newBtnText: { color: '#7C9EFF', fontWeight: '700', fontSize: 13 },
    searchRow: {
        flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 12,
        backgroundColor: 'rgba(20,24,60,0.8)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1, borderColor: 'rgba(124,158,255,0.12)',
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, color: '#e8eeff', fontSize: 14 },
    moodFilter: { paddingHorizontal: 20, marginBottom: 16 },
    moodFilterChip: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5,
        borderColor: 'rgba(124,158,255,0.15)', backgroundColor: 'rgba(20,24,60,0.6)', marginRight: 8,
    },
    moodFilterChipActive: { borderColor: '#7C9EFF', backgroundColor: 'rgba(124,158,255,0.12)' },
    moodFilterText: { color: '#7C9EFF', fontWeight: '600', fontSize: 12 },
    list: { paddingHorizontal: 20, paddingBottom: 110 },
    entryCard: {
        backgroundColor: 'rgba(20,24,60,0.8)', borderRadius: 18, padding: 18, marginBottom: 12,
        borderWidth: 1, borderColor: 'rgba(124,158,255,0.1)',
    },
    entryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    entryDate: { fontSize: 11, color: '#4a4a6a', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    entryTitle: { color: '#e8eeff', fontSize: 16, fontWeight: '700', marginBottom: 6 },
    entryPreview: { color: '#6a7090', fontSize: 13, lineHeight: 20 },
    entryFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
    wordCount: { fontSize: 11, color: '#3a3a5a' },
    aiBadge: {
        backgroundColor: 'rgba(167,139,250,0.15)', paddingHorizontal: 10, paddingVertical: 3,
        borderRadius: 10, borderWidth: 1, borderColor: 'rgba(167,139,250,0.3)',
    },
    aiBadgeText: { color: '#a78bfa', fontSize: 10, fontWeight: '700' },
    emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 },
    emptyTitle: { color: '#e8eeff', fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 8 },
    emptySubtitle: { color: '#4a4a6a', fontSize: 14, textAlign: 'center', lineHeight: 22 },
    emptyBtn: {
        marginTop: 24, backgroundColor: 'rgba(124,158,255,0.15)', borderWidth: 1,
        borderColor: 'rgba(124,158,255,0.4)', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 14,
    },
    emptyBtnText: { color: '#7C9EFF', fontWeight: '700', fontSize: 14 },
    // Edit screen
    editToolbar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(124,158,255,0.1)',
    },
    toolbarCancel: { color: '#4a4a6a', fontSize: 15 },
    toolbarWords: { color: '#4a4a6a', fontSize: 12 },
    toolbarRight: { flexDirection: 'row', alignItems: 'center' },
    toolbarSave: { color: '#7C9EFF', fontWeight: '700', fontSize: 15 },
    editScroll: { padding: 24, paddingBottom: 100 },
    titleInput: { color: '#e8eeff', fontWeight: '700', marginBottom: 6 },
    editDate: { color: '#4a4a6a', fontSize: 12, marginBottom: 18, textTransform: 'uppercase', letterSpacing: 0.5 },
    moodRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    moodDot: {
        width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(20,24,60,0.6)',
    },
    contentInput: {
        color: '#c8d8ff', fontSize: 15, lineHeight: 26, minHeight: 280,
    },
    aiReflectionCard: {
        marginTop: 24, padding: 18, borderRadius: 18,
        backgroundColor: 'rgba(167,139,250,0.08)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.25)',
    },
    aiReflectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    aiReflectionTitle: { color: '#a78bfa', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    aiReflectionText: { color: '#c8d8ff', fontSize: 14, lineHeight: 22 },
    aiReflectBtn: {
        marginTop: 24, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14,
        paddingHorizontal: 20, borderRadius: 14, borderWidth: 1,
        borderColor: 'rgba(167,139,250,0.3)', backgroundColor: 'rgba(167,139,250,0.06)',
    },
    aiReflectText: { color: '#a78bfa', fontWeight: '600', fontSize: 13 },
});
