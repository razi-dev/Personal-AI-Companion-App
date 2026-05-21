/**
 * demoSeed.ts
 * ─────────────────────────────────────────────────────────────────
 * One-shot seeder that fills AsyncStorage with 30 days of realistic
 * demo data so the teacher can see every feature of the Digital Twin.
 *
 * Call:  await seedDemoData()
 * Clear: await clearDemoData()
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DailyEntry, Habit, HabitEntry, JournalEntry, Message, UserProfile } from '../types';
import { localDateString } from './memoryService';

// ─── Storage Keys (must match the rest of the app) ────────────────
const PROFILE_KEY = '@digital_twin_profile';
const ENTRIES_KEY = '@digital_twin_entries';
const MESSAGES_KEY = '@digital_twin_messages';
const HABITS_KEY = '@digital_twin_habits';
const HABIT_ENTRIES_KEY = '@digital_twin_habit_entries';
const JOURNAL_KEY = '@digital_twin_journals';
const SEED_FLAG_KEY = '@demo_seed_applied';

// ─── Helpers ──────────────────────────────────────────────────────
function daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return localDateString(d);
}

function isoOf(daysBack: number, hour = 10, minute = 0): string {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
}

// ─── Profile ──────────────────────────────────────────────────────
const DEMO_PROFILE: UserProfile = {
    name: 'Alex',
    role: 'Computer Science Student',
    primaryGoal: 'Build consistent study habits and reduce stress during exams',
    personalityTone: 'calm',
    workStartHour: 9,
    workEndHour: 18,
    morningCheckInHour: 8,
    eveningCheckInHour: 21,
    onboardingComplete: true,
    createdAt: isoOf(35),
    timezone: 'Asia/Kolkata',
};

// ─── Habits ───────────────────────────────────────────────────────
const DEMO_HABITS: Habit[] = [
    { id: 'h-1', name: 'Morning Run', icon: '🏃', color: '#4ade80', frequency: 'weekdays', targetDays: 30, createdAt: isoOf(32), isActive: true },
    { id: 'h-2', name: 'Deep Study Block', icon: '📚', color: '#7C9EFF', frequency: 'daily', targetDays: 30, createdAt: isoOf(32), isActive: true },
    { id: 'h-3', name: 'Meditation', icon: '🧘', color: '#a78bfa', frequency: 'daily', targetDays: 21, createdAt: isoOf(32), isActive: true },
    { id: 'h-4', name: 'Drink 2L Water', icon: '💧', color: '#60a5fa', frequency: 'daily', targetDays: 30, createdAt: isoOf(32), isActive: true },
    { id: 'h-5', name: 'Weekend Gym', icon: '💪', color: '#ffa94d', frequency: 'weekends', targetDays: 8, createdAt: isoOf(30), isActive: true },
];

// ─── Habit Entries ────────────────────────────────────────────────
// dayIndex = 0 is the OLDEST day (29 days ago), 29 = today
// Listed indices are SKIP days (habit NOT completed that day).
const SKIP_DAYS: Record<string, Set<number>> = {
    'h-1': new Set([0, 3, 8, 15, 22]),         // Morning Run — 5 misses
    'h-2': new Set([6, 7, 15, 28]),              // Deep Study  — 4 gaps (missed yesterday)
    'h-3': new Set([0, 1, 7, 8, 22, 23, 24, 28]),// Meditation  — broke streak twice + missed yesterday
    'h-4': new Set([3, 10, 17, 22, 28]),         // Water       — 5 misses (missed yesterday)
    'h-5': new Set([]),                          // Weekend Gym — perfect
};

function buildHabitEntries(): HabitEntry[] {
    const entries: HabitEntry[] = [];
    for (let i = 29; i >= 0; i--) {
        const dateStr = daysAgo(i);
        const [y, m, d] = dateStr.split('-').map(Number);
        const dow = new Date(y, m - 1, d).getDay(); // 0=Sun … 6=Sat
        const dayIndex = 29 - i;

        for (const habit of DEMO_HABITS) {
            if (habit.frequency === 'weekdays' && (dow === 0 || dow === 6)) continue;
            if (habit.frequency === 'weekends' && dow >= 1 && dow <= 5) continue;
            if ((SKIP_DAYS[habit.id] ?? new Set()).has(dayIndex)) continue;

            entries.push({
                id: `he-${habit.id}-${dateStr}`,
                habitId: habit.id,
                date: dateStr,
                completed: true,
                completedAt: isoOf(i, 9, 30),
            });
        }
    }
    return entries;
}

// ─── Daily Log Entries ────────────────────────────────────────────
type Mood = 'overwhelmed' | 'stressed' | 'neutral' | 'focused' | 'great';

const TASK_SETS: Array<{ planned: string[]; completed: string[]; mood: Mood; energy: 1 | 2 | 3 | 4 | 5; note: string }> = [
    {
        planned: ['Review DSA notes', 'Complete OS assignment', 'Attend lecture', 'Read 20 pages'],
        completed: ['Review DSA notes', 'Attend lecture', 'Read 20 pages'],
        mood: 'focused', energy: 4,
        note: 'Skipped the OS assignment — ran out of time after the lecture went long.',
    },
    {
        planned: ['Solve 3 LeetCode problems', 'Group project meeting', 'Email professor'],
        completed: ['Solve 3 LeetCode problems', 'Group project meeting', 'Email professor'],
        mood: 'great', energy: 5,
        note: 'Productive day! Solved two hard LeetCode problems in one sitting.',
    },
    {
        planned: ['Study for midterm', 'Gym', 'Grocery run'],
        completed: ['Study for midterm'],
        mood: 'stressed', energy: 2,
        note: 'Felt overwhelmed with midterm prep. Skipped gym. Need better balance.',
    },
    {
        planned: ['Complete ML assignment', 'Read research paper', 'Code review session'],
        completed: ['Complete ML assignment', 'Code review session'],
        mood: 'neutral', energy: 3,
        note: 'Decent day. Could not get through the paper — will try tomorrow morning.',
    },
    {
        planned: ['Attend workshop', 'Work on side project', 'Call home'],
        completed: ['Attend workshop', 'Work on side project', 'Call home'],
        mood: 'great', energy: 5,
        note: 'The workshop on AI ethics was inspiring. Side project is coming along nicely.',
    },
    {
        planned: ['Revise databases chapter', 'Mock interview prep', 'Evening walk'],
        completed: ['Mock interview prep', 'Evening walk'],
        mood: 'focused', energy: 4,
        note: 'Did not get to databases but the mock interview went surprisingly well.',
    },
    {
        planned: ['Submit project report', 'Study algorithms', 'Cooking experiment'],
        completed: ['Submit project report', 'Study algorithms'],
        mood: 'focused', energy: 4,
        note: 'Project submitted on time. Feeling relieved.',
    },
    {
        planned: ['Morning run', 'Deep work session', 'Team standup'],
        completed: [],
        mood: 'overwhelmed', energy: 1,
        note: 'Could not get myself to do anything today. Burnout setting in.',
    },
    {
        planned: ['Light study', 'Take a break', 'Journal reflection'],
        completed: ['Light study', 'Take a break', 'Journal reflection'],
        mood: 'neutral', energy: 3,
        note: 'Recovery day. Decided to be gentle with myself. Feeling better.',
    },
    {
        planned: ['Python project', 'Data structures revision', 'Study group'],
        completed: ['Python project', 'Study group'],
        mood: 'focused', energy: 4,
        note: 'Good session with the study group. We figured out the tree traversal problem.',
    },
];

const YESTERDAY_TASK_SET: { planned: string[]; completed: string[]; mood: Mood; energy: 1 | 2 | 3 | 4 | 5; note: string } = {
    planned: ['Finish OS assignment', 'Study algorithms', 'Evening walk', 'Inbox cleanup'],
    completed: ['Study algorithms'],
    mood: 'stressed',
    energy: 2,
    note: 'Missed three tasks and felt behind by the evening.',
};

function buildDailyEntries(): DailyEntry[] {
    const entries: DailyEntry[] = [];
    for (let i = 29; i >= 0; i--) {
        const set = i === 1 ? YESTERDAY_TASK_SET : TASK_SETS[i % TASK_SETS.length];
        entries.push({
            id: `entry-${daysAgo(i)}`,
            date: daysAgo(i),
            tasksPlanned: set.planned,
            tasksCompleted: set.completed,
            energyLevel: set.energy,
            mood: set.mood,
            notes: set.note,
            createdAt: isoOf(i, 7, 15),
        });
    }
    return entries;
}

// ─── Journal Entries ──────────────────────────────────────────────
interface JournalSeed {
    daysBack: number; title: string; content: string;
    mood: Mood; energy: 1 | 2 | 3 | 4 | 5; tags: string[]; reflection: string;
}

const JOURNAL_DATA: JournalSeed[] = [
    {
        daysBack: 29,
        title: 'Starting Fresh',
        content: `It's the beginning of a new month and I'm determined to build better habits. I've been reading about the science of habit formation and the key insight is consistency over intensity. I don't need to run a marathon — I just need to show up every day.

My goals for this month:
- Study at least 2 hours of focused work daily
- Morning run on weekdays
- Meditate for 10 minutes each night
- Drink enough water (I'm chronically dehydrated)

I'm also going to use the Digital Twin app to track progress and see patterns I can't see day to day. #goals #habits #productivity`,
        mood: 'great', energy: 5,
        tags: ['goals', 'habits', 'productivity'],
        reflection: 'You demonstrate strong intention-setting and self-awareness. Starting with clear, measurable goals is a proven foundation for lasting behavior change. Your instinct to focus on consistency rather than perfection aligns with how habits actually form in the brain.',
    },
    {
        daysBack: 22,
        title: 'Midterm Week Survival',
        content: `Midterm week has arrived and I can feel the anxiety creeping in. I studied until 2am last night and still feel behind. The thing is, I knew this was coming and still procrastinated on one of the chapters.

I keep telling myself I work better under pressure but I'm starting to think that's a story I tell myself to justify avoidance. What would it look like to actually be prepared?

Also noticed I completely dropped my morning run this week. And I haven't meditated in 5 days. The habits are the first things to go when I feel stressed, which is exactly when I need them most. #stress #exams #selfawareness`,
        mood: 'stressed', energy: 2,
        tags: ['stress', 'exams', 'selfawareness'],
        reflection: "You've identified a critical pattern: habits dissolve when stress peaks, precisely when they provide the most benefit. This is extremely common and rooted in cognitive load theory. The key insight you've had — that \"working under pressure\" may be avoidance — shows real self-awareness. Consider doing a brief 5-minute version of each habit during high-stress periods rather than skipping entirely.",
    },
    {
        daysBack: 15,
        title: 'Finding My Rhythm',
        content: `Two weeks in and I'm starting to notice patterns. My best study sessions happen between 9am and noon — after that my focus degrades sharply. I used to wonder why my afternoon sessions felt so unproductive, now I realize I was fighting my own biology.

I've restructured my schedule to do deep work in the mornings and lighter tasks (emails, admin, reading) in the afternoons. It's only been 3 days but it already feels much better.

The meditation is becoming something I actually look forward to rather than a task on a checklist. Strange how that happens. #focus #rhythm #meditation #productivity`,
        mood: 'focused', energy: 4,
        tags: ['focus', 'rhythm', 'meditation', 'productivity'],
        reflection: "Excellent observation about your chronotype. Research confirms cognitive performance peaks in the late morning for most people. You've done the rare thing of actually acting on self-knowledge rather than just acknowledging it. This schedule restructuring could be one of the highest-leverage changes you make this semester.",
    },
    {
        daysBack: 8,
        title: 'Burnout Warning Signs',
        content: `I had a completely unproductive day today. Stared at my screen for three hours and accomplished almost nothing. I know the warning signs now — disrupted sleep, difficulty concentrating, irritability, that hollow feeling.

The irony of tracking productivity is seeing clearly how the system broke down. My completion rate has been dropping for 5 days. I should have caught this earlier.

Going to take tomorrow as a recovery day. Light study, a long walk, cooking something from scratch. My brain needs permission to rest without guilt. #burnout #mentalhealth #recovery`,
        mood: 'overwhelmed', energy: 1,
        tags: ['burnout', 'mentalhealth', 'recovery'],
        reflection: "Your self-diagnosis is accurate and your proposed response is appropriate. Burnout follows a predictable arc that you've described precisely. The most important thing you wrote: \"permission to rest without guilt.\" Rest is not the opposite of productivity — it is the foundation of it.",
    },
    {
        daysBack: 3,
        title: 'Back on Track',
        content: `Feeling like myself again after the rough week. The recovery day made a huge difference — I underestimate how much a single intentional rest day can reset things.

Did my morning run today for the first time in 8 days. It was slow and uncomfortable but it happened. The meditation streak is back at 4 days. Study block was 2.5 hours of actual focus.

Looking back at the month in the app, the pattern is clear: I do well, overextend, crash, recover, do well again. The goal is to flatten that cycle — catch the signs earlier and recover before it becomes a crash.

#recovery #consistency #habits #growth`,
        mood: 'great', energy: 4,
        tags: ['recovery', 'consistency', 'habits', 'growth'],
        reflection: "You've named the boom-bust cycle and articulated the correct solution: early pattern detection. The data in your logs shows energy drops precede completion drops by 2 days on average. Treat 2+ consecutive low-energy days as an early warning signal to lighten your task load proactively.",
    },
    {
        daysBack: 1,
        title: 'Week in Review — Personal Notes',
        content: `Solid week overall after the burnout recovery. Things I'm proud of:
- Completed 4/5 morning runs
- Deep study block every single day
- Solved 8 LeetCode problems
- Had a great group project presentation

Things to improve:
- Still reaching for my phone first thing in the morning
- Water intake drops on busy days

The digital twin insights page showed me that my Wednesdays are consistently my most productive day and Fridays are the weakest. I'm going to experiment with scheduling my hardest tasks on Wednesday and keeping Friday lighter. #weeklyreview #growth #datadriven`,
        mood: 'focused', energy: 4,
        tags: ['weeklyreview', 'growth', 'datadriven'],
        reflection: "An impressive weekly review with specific, actionable takeaways. Using your Wednesday/Friday pattern to schedule tasks is exactly the kind of evidence-based self-optimization this app is designed to support. Your ability to name both wins and gaps without harsh self-judgment reflects a healthy and sustainable growth mindset.",
    },
];

function buildJournalEntries(): JournalEntry[] {
    return JOURNAL_DATA.map((j) => {
        const now = isoOf(j.daysBack, 22, 0);
        return {
            id: `journal-${daysAgo(j.daysBack)}`,
            date: daysAgo(j.daysBack),
            title: j.title,
            content: j.content,
            mood: j.mood,
            energyLevel: j.energy,
            tags: j.tags,
            aiReflection: j.reflection,
            createdAt: now,
            updatedAt: now,
            wordCount: j.content.split(/\s+/).length,
        };
    });
}

// ─── Chat Messages ────────────────────────────────────────────────
const CHAT_SEED: Array<{ role: 'user' | 'assistant'; content: string; daysBack: number; hour: number }> = [
    { role: 'user', daysBack: 24, hour: 20, content: "I've been feeling overwhelmed lately. I have 3 assignments due, a midterm next week, and I can't seem to focus." },
    { role: 'assistant', daysBack: 24, hour: 20, content: "I can see from your recent logs that your energy has been at 2–3 and your completion rate dropped to around 40% over the past few days.\n\nHere's what I'd suggest: identify which assignment has the earliest deadline and do a focused 25-minute session on just that one tonight — then stop. Momentum builds from small completions.\n\nFor the midterm: which chapter feels most uncertain to you right now?" },
    { role: 'user', daysBack: 24, hour: 21, content: 'The databases chapter. I keep rereading it but nothing sticks.' },
    { role: 'assistant', daysBack: 24, hour: 21, content: "Rereading is one of the least effective study methods — it creates the illusion of learning without retention. Try retrieval practice instead: close the notes and write from memory everything you can recall about databases for 10 minutes.\n\nThen open your notes and only re-read what you couldn't recall. Your brain will retain it much better.\n\nBased on your energy patterns, 9–11am tends to be your strongest focus window. How does your morning look tomorrow?" },
    { role: 'user', daysBack: 17, hour: 19, content: "That actually helped a lot. I tried the retrieval thing and realized I knew more than I thought. How do I stop burning out every few weeks?" },
    { role: 'assistant', daysBack: 17, hour: 19, content: "Looking at your data, I see a clear pattern: high-output phases of 5–7 days, then a 1–2 day crash, then recovery. This boom-bust cycle is common in students who push hard without built-in recovery.\n\nThe fix isn't working harder on recovery — it's preventing the crash:\n\n1. **Energy budget**: Treat daily energy like a bank account. Heavy withdrawals (deep work, exercise) require deposits (sleep, low-stimulation time).\n\n2. **Early warning signals**: Your logs show energy drops 2 days before completion drops. Two consecutive low-energy days should trigger a lighter schedule.\n\n3. **Scheduled rest**: One light day per week is maintenance, not laziness. Your output stays higher overall.\n\nYou've shown you can recover well. The goal is to need less recovery by catching the signals earlier." },
    { role: 'user', daysBack: 10, hour: 21, content: "What do you think my biggest strength is, based on what you've seen?" },
    { role: 'assistant', daysBack: 10, hour: 21, content: "Based on your logs, journals, and patterns over the past month: your biggest strength is **self-awareness combined with action**.\n\nMany people notice patterns about themselves but don't change anything. You identified that 'I work well under pressure' might be avoidance — and then restructured your schedule. You noticed your energy-peak window and acted on it.\n\nYour completion rate on high-energy days (4–5) is 78%. On low-energy days (1–2), it drops to 23%. You're starting to use that knowledge in real time. That feedback loop — observe, reflect, adjust — is what growth actually looks like." },
    { role: 'user', daysBack: 5, hour: 18, content: 'I want to improve my LeetCode skills before placements. Any advice based on my habits?' },
    { role: 'assistant', daysBack: 5, hour: 18, content: "Good timing. Based on your patterns:\n\n**Schedule**: Your Wednesday mornings are your highest-performing blocks. Lock in LeetCode there — 2 medium problems, non-negotiable.\n\n**Approach**: Don't grind easy problems. Do 1 medium daily, spend 30 minutes on it before solutions, then study the optimal approach deeply. Pattern recognition over volume.\n\n**Foundation**: Your current study block habit (~80% completion this month) is the platform — just redirect it through: arrays → strings → trees → graphs → dynamic programming.\n\nAvoid LeetCode after 6pm (your evening energy averages 2.8 — too low for novel problem-solving). 3+ months before placement season is enough time to be genuinely competitive if you stay consistent." },
];

function buildChatMessages(): Message[] {
    return CHAT_SEED.map((m, i) => ({
        id: `msg-demo-${i}`,
        role: m.role,
        content: m.content,
        timestamp: isoOf(m.daysBack, m.hour, i % 2 === 0 ? 5 : 12),
    }));
}

// ─── Public API ───────────────────────────────────────────────────
export async function isDemoSeeded(): Promise<boolean> {
    const flag = await AsyncStorage.getItem(SEED_FLAG_KEY);
    return flag === 'true';
}

export async function seedDemoData(): Promise<void> {
    const habitEntries = buildHabitEntries();
    const dailyEntries = buildDailyEntries();
    const journalEntries = buildJournalEntries();
    const chatMessages = buildChatMessages();

    await Promise.all([
        AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(DEMO_PROFILE)),
        AsyncStorage.setItem(HABITS_KEY, JSON.stringify(DEMO_HABITS)),
        AsyncStorage.setItem(HABIT_ENTRIES_KEY, JSON.stringify(habitEntries)),
        AsyncStorage.setItem(ENTRIES_KEY, JSON.stringify(dailyEntries)),
        AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(journalEntries)),
        AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(chatMessages)),
        AsyncStorage.setItem(SEED_FLAG_KEY, 'true'),
    ]);

    console.log('[demoSeed] Seeded successfully:', {
        habits: DEMO_HABITS.length,
        habitEntries: habitEntries.length,
        dailyEntries: dailyEntries.length,
        journals: journalEntries.length,
        chatMessages: chatMessages.length,
    });
}

export async function clearDemoData(): Promise<void> {
    await AsyncStorage.multiRemove([
        PROFILE_KEY, HABITS_KEY, HABIT_ENTRIES_KEY,
        ENTRIES_KEY, JOURNAL_KEY, MESSAGES_KEY, SEED_FLAG_KEY,
    ]);
    console.log('[demoSeed] Demo data cleared.');
}
