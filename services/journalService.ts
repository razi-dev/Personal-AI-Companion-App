import AsyncStorage from '@react-native-async-storage/async-storage';
import { JournalEntry, Mood, EnergyLevel } from '../types';

const JOURNAL_KEY = '@digital_twin_journal';

export async function getAllJournalEntries(): Promise<JournalEntry[]> {
    try {
        const raw = await AsyncStorage.getItem(JOURNAL_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export async function getRecentJournalEntries(days = 14): Promise<JournalEntry[]> {
    const all = await getAllJournalEntries();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return all
        .filter((e) => new Date(e.date) >= cutoff)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

const MAX_JOURNAL_ENTRIES = 365;

export async function saveJournalEntry(entry: JournalEntry): Promise<void> {
    try {
        const all = await getAllJournalEntries();
        const idx = all.findIndex((e) => e.id === entry.id);
        if (idx >= 0) {
            all[idx] = { ...entry, updatedAt: new Date().toISOString() };
        } else {
            all.push(entry);
        }
        // Prune to most recent MAX_JOURNAL_ENTRIES, sorted newest first
        const pruned = all
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, MAX_JOURNAL_ENTRIES);
        await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(pruned));
    } catch (err) {
        console.error('journalService.saveJournalEntry error:', err);
    }
}

export async function deleteJournalEntry(id: string): Promise<void> {
    const all = await getAllJournalEntries();
    await AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(all.filter((e) => e.id !== id)));
}

export async function getJournalEntryByDate(date: string): Promise<JournalEntry | null> {
    const all = await getAllJournalEntries();
    return all.find((e) => e.date === date) ?? null;
}

/** Returns YYYY-MM-DD in the device's local timezone. */
export function localDateString(date: Date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function createNewJournalEntry(overrides?: Partial<JournalEntry>): JournalEntry {
    const now = new Date();
    return {
        id: `journal-${Date.now()}`,
        date: localDateString(now),
        title: '',
        content: '',
        mood: undefined,
        energyLevel: undefined,
        tags: [],
        aiReflection: undefined,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        wordCount: 0,
        ...overrides,
    };
}

export function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

export function extractTagsFromContent(content: string): string[] {
    const matches = content.match(/#\w+/g) ?? [];
    return [...new Set(matches.map((t) => t.slice(1).toLowerCase()))];
}

// Build a concise summary of recent journals for AI context
export function buildJournalSummaryForAI(entries: JournalEntry[]): string {
    if (entries.length === 0) return 'No journal entries yet.';
    return entries
        .slice(0, 5)
        .map((e) => {
            const date = new Date(e.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            const preview = e.content.slice(0, 120).replace(/\n/g, ' ');
            return `- ${date} [${e.mood ?? 'no mood'}]: "${preview}${e.content.length > 120 ? '...' : ''}"`;
        })
        .join('\n');
}
