import AsyncStorage from '@react-native-async-storage/async-storage';
import { DailyEntry, FeatureVector, HabitWithStats, JournalEntry, Message, Mood } from '../types';
import { parseDateString, toLocalDateString } from '../utils/dateUtils';

const FEATURE_KEY = '@digital_twin_feature_vectors';

function initMoodCounts(): Record<Mood, number> {
    return {
        overwhelmed: 0,
        stressed: 0,
        neutral: 0,
        focused: 0,
        great: 0,
    };
}

export async function getFeatureVectors(): Promise<FeatureVector[]> {
    try {
        const raw = await AsyncStorage.getItem(FEATURE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export async function saveFeatureVector(vector: FeatureVector): Promise<void> {
    const existing = await getFeatureVectors();
    existing.push(vector);
    const trimmed = existing.slice(-60);
    await AsyncStorage.setItem(FEATURE_KEY, JSON.stringify(trimmed));
}

export async function getLatestFeatureVector(): Promise<FeatureVector | null> {
    const all = await getFeatureVectors();
    return all.length > 0 ? all[all.length - 1] : null;
}

export function computeFeatureVector(
    entries: DailyEntry[],
    habits: HabitWithStats[],
    journals: JournalEntry[],
    messages: Message[],
    windowDays = 30,
): FeatureVector {
    const today = toLocalDateString(new Date());
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - windowDays);

    const recentEntries = entries.filter((e) => parseDateString(e.date) >= cutoff);
    const recentJournals = journals.filter((j) => parseDateString(j.date) >= cutoff);
    const recentMessages = messages.filter((m) => new Date(m.timestamp) >= cutoff);

    const totals = recentEntries.reduce(
        (acc, e) => {
            acc.planned += e.tasksPlanned.length;
            acc.completed += e.tasksCompleted.length;
            acc.energy += e.energyLevel;
            acc.count += 1;
            acc.moods[e.mood] += 1;
            return acc;
        },
        { planned: 0, completed: 0, energy: 0, count: 0, moods: initMoodCounts() }
    );

    const completionRate = totals.planned === 0 ? 1 : totals.completed / totals.planned;
    const avgEnergy = totals.count === 0 ? 3 : totals.energy / totals.count;
    const habitCompletionRate = habits.length === 0
        ? 0
        : habits.reduce((a, h) => a + h.completionRate, 0) / habits.length;

    return {
        id: `features-${Date.now()}`,
        date: today,
        windowDays,
        totalEntries: recentEntries.length,
        totalTasksPlanned: totals.planned,
        totalTasksCompleted: totals.completed,
        completionRate,
        avgEnergy,
        moodCounts: totals.moods,
        habitCompletionRate,
        journalCount: recentJournals.length,
        messageCount: recentMessages.length,
        createdAt: new Date().toISOString(),
    };
}
