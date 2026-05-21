import AsyncStorage from '@react-native-async-storage/async-storage';
import { Habit, HabitEntry, HabitFrequency, HabitWithStats } from '../types';
import { localDateString } from './memoryService';

const HABITS_KEY = '@digital_twin_habits';
const HABIT_ENTRIES_KEY = '@digital_twin_habit_entries';
const MAX_HABIT_ENTRIES = 400; // per-habit * ~10 habits

// ─── Habits CRUD ──────────────────────────────────────────────────────────────

export async function getAllHabits(): Promise<Habit[]> {
    try {
        const raw = await AsyncStorage.getItem(HABITS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export async function saveHabit(habit: Habit): Promise<void> {
    const all = await getAllHabits();
    const idx = all.findIndex((h) => h.id === habit.id);
    if (idx >= 0) {
        all[idx] = habit;
    } else {
        all.push(habit);
    }
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(all));
}

export async function deleteHabit(id: string): Promise<void> {
    const all = await getAllHabits();
    await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(all.filter((h) => h.id !== id)));
    // also remove entries
    const entries = await getAllHabitEntries();
    await AsyncStorage.setItem(HABIT_ENTRIES_KEY, JSON.stringify(entries.filter((e) => e.habitId !== id)));
}

// ─── Habit Entries ────────────────────────────────────────────────────────────

export async function getAllHabitEntries(): Promise<HabitEntry[]> {
    try {
        const raw = await AsyncStorage.getItem(HABIT_ENTRIES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export async function toggleHabitEntry(habitId: string, date: string): Promise<boolean> {
    const entries = await getAllHabitEntries();
    const existing = entries.find((e) => e.habitId === habitId && e.date === date);
    if (existing) {
        // toggle off
        const filtered = entries.filter((e) => !(e.habitId === habitId && e.date === date));
        await AsyncStorage.setItem(HABIT_ENTRIES_KEY, JSON.stringify(filtered));
        return false;
    } else {
        const newEntry: HabitEntry = {
            id: `${habitId}-${date}-${Date.now()}`,
            habitId,
            date,
            completed: true,
            completedAt: new Date().toISOString(),
        };
        const updated = [...entries, newEntry];
        // Prune oldest entries while keeping all recent ones
        const pruned = updated
            .sort((a, b) => (b.date > a.date ? 1 : -1))
            .slice(0, MAX_HABIT_ENTRIES);
        await AsyncStorage.setItem(HABIT_ENTRIES_KEY, JSON.stringify(pruned));
        return true;
    }
}

export async function getHabitEntriesForDate(date: string): Promise<HabitEntry[]> {
    const all = await getAllHabitEntries();
    return all.filter((e) => e.date === date && e.completed);
}

// ─── Stats Computation ────────────────────────────────────────────────────────

// Returns true if a date (YYYY-MM-DD) is a scheduled day for the given frequency
export function isScheduledDay(dateStr: string, frequency: HabitFrequency): boolean {
    if (frequency === 'daily') return true;
    // Parse weekday without UTC shift: treat YYYY-MM-DD as local noon
    const [year, month, day] = dateStr.split('-').map(Number);
    const dayOfWeek = new Date(year, month - 1, day).getDay(); // 0=Sun, 6=Sat
    if (frequency === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5;
    if (frequency === 'weekends') return dayOfWeek === 0 || dayOfWeek === 6;
    return true;
}

export async function getHabitsWithStats(): Promise<HabitWithStats[]> {
    const habits = await getAllHabits();
    const entries = await getAllHabitEntries();
    const today = localDateString();

    return habits
        .filter((h) => h.isActive)
        .map((habit) => {
            const habitEntries = entries.filter((e) => e.habitId === habit.id && e.completed);
            const completedDates = new Set(habitEntries.map((e) => e.date));

            // Last 30 days — only count scheduled days
            const last30Days: boolean[] = [];
            for (let i = 29; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = localDateString(d);
                if (!isScheduledDay(dateStr, habit.frequency)) {
                    // Skip non-scheduled days (don't add to heatmap slot)
                    last30Days.push(true); // treat as "not required"
                } else {
                    last30Days.push(completedDates.has(dateStr));
                }
            }

            // Current streak — skip non-scheduled days
            let currentStreak = 0;
            const checkDate = new Date();
            let safetyLimit = 400;
            while (safetyLimit-- > 0) {
                const dateStr = localDateString(checkDate);
                if (!isScheduledDay(dateStr, habit.frequency)) {
                    // Skip this day — doesn't break the streak
                    checkDate.setDate(checkDate.getDate() - 1);
                    continue;
                }
                if (completedDates.has(dateStr)) {
                    currentStreak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                } else {
                    break;
                }
            }

            // Longest streak — skip non-scheduled days
            let longestStreak = 0;
            let tempStreak = 0;
            for (let i = 29; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = localDateString(d);
                if (!isScheduledDay(dateStr, habit.frequency)) continue; // skip, don't reset
                if (completedDates.has(dateStr)) {
                    tempStreak++;
                    longestStreak = Math.max(longestStreak, tempStreak);
                } else {
                    tempStreak = 0;
                }
            }

            // Completion rate: completed / scheduled days in last 30
            const scheduledDays = last30Days.length; // all 30 days are included
            // Recount correctly among actual scheduled slots
            let scheduledCount = 0;
            let completedCount = 0;
            for (let i = 29; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = localDateString(d);
                if (!isScheduledDay(dateStr, habit.frequency)) continue;
                scheduledCount++;
                if (completedDates.has(dateStr)) completedCount++;
            }
            const completionRate = scheduledCount > 0 ? completedCount / scheduledCount : 0;

            return {
                ...habit,
                currentStreak,
                longestStreak,
                completionRate,
                todayCompleted: completedDates.has(today),
                last30Days,
            };
        });
}

export function computeHabitStreakRisk(habits: HabitWithStats[]): boolean {
    if (habits.length === 0) return false;
    const today = localDateString();
    return habits.some(
        (h) => h.currentStreak >= 3 && !h.todayCompleted && isScheduledDay(today, h.frequency)
    );
}
