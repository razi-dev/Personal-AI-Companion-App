import AsyncStorage from '@react-native-async-storage/async-storage';
import { DailyEntry, Message } from '../types';

const ENTRIES_KEY = '@digital_twin_entries';
const MESSAGES_KEY = '@digital_twin_messages';
const MAX_ENTRIES = 730; // ~2 years of daily logs

/** Returns YYYY-MM-DD in the device's local timezone (no UTC shift). */
export function localDateString(date: Date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// ─── Daily Entries ────────────────────────────────────────────────────────────

export async function saveEntry(entry: DailyEntry): Promise<void> {
    try {
        const existing = await getAllEntries();
        const idx = existing.findIndex((e) => e.id === entry.id);
        if (idx >= 0) {
            existing[idx] = entry;
        } else {
            existing.push(entry);
        }
        // Prune oldest entries, keep newest MAX_ENTRIES
        const pruned = existing
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, MAX_ENTRIES);
        await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(pruned));
    } catch (err) {
        console.error('memoryService.saveEntry error:', err);
    }
}

export async function getAllEntries(): Promise<DailyEntry[]> {
    try {
        const raw = await AsyncStorage.getItem(ENTRIES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export async function getRecentEntries(days = 7): Promise<DailyEntry[]> {
    const all = await getAllEntries();
    // Compute cutoff as a local YYYY-MM-DD string to avoid UTC shift
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoff = localDateString(cutoffDate);
    return all
        .filter((e) => e.date >= cutoff)
        .sort((a, b) => (b.date > a.date ? 1 : -1));
}

export async function getEntryByDate(date: string): Promise<DailyEntry | null> {
    const all = await getAllEntries();
    return all.find((e) => e.date === date) ?? null;
}

export async function deleteEntry(id: string): Promise<void> {
    const existing = await getAllEntries();
    const filtered = existing.filter((e) => e.id !== id);
    await AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(filtered));
}

// ─── Chat Messages ────────────────────────────────────────────────────────────

export async function saveMessage(message: Message): Promise<void> {
    try {
        const existing = await getAllMessages();
        existing.push(message);
        // Keep only last 100 messages
        const trimmed = existing.slice(-100);
        await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(trimmed));
    } catch (err) {
        console.error('memoryService.saveMessage error:', err);
    }
}

export async function getAllMessages(): Promise<Message[]> {
    try {
        const raw = await AsyncStorage.getItem(MESSAGES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export async function clearMessages(): Promise<void> {
    await AsyncStorage.removeItem(MESSAGES_KEY);
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function computeCompletionRatio(entries: DailyEntry[]): number {
    if (entries.length === 0) return 0;
    const total = entries.reduce(
        (acc, e) => {
            acc.planned += e.tasksPlanned.length;
            acc.completed += e.tasksCompleted.length;
            return acc;
        },
        { planned: 0, completed: 0 }
    );
    return total.planned === 0 ? 1 : total.completed / total.planned;
}

export function computeAvgEnergy(entries: DailyEntry[]): number {
    if (entries.length === 0) return 3;
    const sum = entries.reduce((acc, e) => acc + e.energyLevel, 0);
    return sum / entries.length;
}

export function getDominantMood(entries: DailyEntry[]): string {
    if (entries.length === 0) return 'neutral';
    const counts: Record<string, number> = {};
    entries.forEach((e) => {
        counts[e.mood] = (counts[e.mood] ?? 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}
