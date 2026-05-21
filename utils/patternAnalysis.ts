import { DailyEntry, BehaviorInsights, Message, InsightData } from '../types';

/**
 * Analyze user behavior patterns to extract deep insights.
 */
export function computeBehaviorInsights(
    entries: DailyEntry[],
    messages: Message[] = []
): BehaviorInsights {
    if (entries.length === 0) {
        return {
            peakProductivityHour: null,
            peakProductivityDay: null,
            mostSkippedTaskTypes: [],
            moodProductivityCorrelation: {},
            energyCompletionCorrelation: 0,
            topicsMentioned: [],
            consistencyScore: 0,
            streakRisk: false,
        };
    }

    const localDateString = (date: Date = new Date()): string => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    // Mood → productivity correlation
    const moodProductivityCorrelation: Record<string, number> = {};
    const moodGroups: Record<string, number[]> = {};
    entries.forEach((e) => {
        if (!moodGroups[e.mood]) moodGroups[e.mood] = [];
        const ratio = e.tasksPlanned.length === 0 ? 1 : e.tasksCompleted.length / e.tasksPlanned.length;
        moodGroups[e.mood].push(ratio);
    });
    for (const [mood, ratios] of Object.entries(moodGroups)) {
        moodProductivityCorrelation[mood] = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    }

    // Energy → completion correlation
    const energyCompletionCorrelation = computeCorrelation(
        entries.map((e) => e.energyLevel),
        entries.map((e) => e.tasksPlanned.length === 0 ? 1 : e.tasksCompleted.length / e.tasksPlanned.length)
    );

    // Peak productivity day
    const dayCompletions: Record<string, number[]> = {};
    entries.forEach((e) => {
        const day = new Date(e.date).toLocaleDateString('en-US', { weekday: 'long' });
        if (!dayCompletions[day]) dayCompletions[day] = [];
        const ratio = e.tasksPlanned.length === 0 ? 1 : e.tasksCompleted.length / e.tasksPlanned.length;
        dayCompletions[day].push(ratio);
    });
    let peakProductivityDay: string | null = null;
    let peakDayScore = 0;
    for (const [day, ratios] of Object.entries(dayCompletions)) {
        const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
        if (avg > peakDayScore) { peakDayScore = avg; peakProductivityDay = day; }
    }

    // Most skipped task types
    const skippedWords: Record<string, number> = {};
    entries.forEach((e) => {
        const completedSet = new Set(e.tasksCompleted.map((t) => t.toLowerCase()));
        e.tasksPlanned.forEach((task) => {
            const lower = task.toLowerCase();
            if (!completedSet.has(lower)) {
                lower.split(/\s+/).forEach((word) => {
                    if (word.length > 3) skippedWords[word] = (skippedWords[word] ?? 0) + 1;
                });
            }
        });
    });
    const mostSkippedTaskTypes = Object.entries(skippedWords)
        .sort((a, b) => b[1] - a[1]).slice(0, 3).map(([word]) => word);

    // Topics mentioned in chat
    const userMessages = messages.filter((m) => m.role === 'user').slice(-30);
    const topicWords: Record<string, number> = {};
    const stopwords = new Set(['the', 'and', 'for', 'that', 'this', 'with', 'have', 'not', 'are', 'was', 'can', 'will', 'but', 'like', 'just', 'feel', 'need', 'want', 'help', 'what', 'how']);
    userMessages.forEach((m) => {
        m.content.toLowerCase().split(/\W+/).forEach((word) => {
            if (word.length > 4 && !stopwords.has(word)) {
                topicWords[word] = (topicWords[word] ?? 0) + 1;
            }
        });
    });
    const topicsMentioned = Object.entries(topicWords)
        .sort((a, b) => b[1] - a[1]).slice(0, 5).map(([word]) => word);

    // Consistency score
    const last30 = new Array(30).fill(0).map((_, i) => {
        const d = new Date(); d.setDate(d.getDate() - i);
        return localDateString(d);
    });
    const loggedDates = new Set(entries.map((e) => e.date));
    const loggedDays = last30.filter((d) => loggedDates.has(d)).length;
    const consistencyScore = Math.round((loggedDays / 30) * 100);
    const today = localDateString();
    const streakRisk = consistencyScore > 50 && !loggedDates.has(today);

    return {
        peakProductivityHour: null,
        peakProductivityDay,
        mostSkippedTaskTypes,
        moodProductivityCorrelation,
        energyCompletionCorrelation,
        topicsMentioned,
        consistencyScore,
        streakRisk,
    };
}

function computeCorrelation(xs: number[], ys: number[]): number {
    const n = xs.length;
    if (n === 0) return 0;
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    const cov = xs.reduce((sum, x, i) => sum + (x - meanX) * (ys[i] - meanY), 0) / n;
    const sdX = Math.sqrt(xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0) / n);
    const sdY = Math.sqrt(ys.reduce((sum, y) => sum + (y - meanY) ** 2, 0) / n);
    if (sdX === 0 || sdY === 0) return 0;
    return Math.max(-1, Math.min(1, cov / (sdX * sdY)));
}

export function analyzeCompletionPattern(entries: DailyEntry[]): string {
    if (entries.length < 3) return 'Not enough data yet. Log at least 3 days to see patterns.';
    const ratio = entries.reduce((acc, e) => {
        const r = e.tasksPlanned.length === 0 ? 1 : e.tasksCompleted.length / e.tasksPlanned.length;
        return acc + r;
    }, 0) / entries.length;
    const overplanDays = entries.filter(
        (e) => e.tasksPlanned.length > 3 && e.tasksCompleted.length < e.tasksPlanned.length / 2
    ).length;
    if (overplanDays > entries.length * 0.5) {
        return `You tend to overplan — on ${overplanDays}/${entries.length} days, you planned more than you could complete. Reducing your daily task count by 1–2 could significantly lower your stress.`;
    }
    if (ratio > 0.8) return `Your task completion is strong — ${Math.round(ratio * 100)}% average. You estimate your capacity well.`;
    return `Your average completion rate is ${Math.round(ratio * 100)}%. Focus on estimating realistic daily task limits.`;
}

export function analyzeEnergyTrend(entries: DailyEntry[]): string {
    if (entries.length < 3) return 'Log more entries to see energy trends.';
    const recent = entries.slice(0, 3);
    const older = entries.slice(3);
    if (older.length === 0) return 'Keep logging to build energy trend data.';
    const recentAvg = recent.reduce((a, e) => a + e.energyLevel, 0) / recent.length;
    const olderAvg = older.reduce((a, e) => a + e.energyLevel, 0) / older.length;
    const diff = recentAvg - olderAvg;
    if (diff <= -0.5) return `Your energy has been declining (${olderAvg.toFixed(1)} → ${recentAvg.toFixed(1)}/5). Protect your rest.`;
    if (diff >= 0.5) return `Your energy is trending upward (${olderAvg.toFixed(1)} → ${recentAvg.toFixed(1)}/5). A good time to tackle something important.`;
    return `Your energy has been stable at around ${recentAvg.toFixed(1)}/5.`;
}

export function predictOverwhelmRisk(entries: DailyEntry[], todayTaskCount: number): 'high' | 'medium' | 'low' {
    if (entries.length === 0) return 'low';
    const overwhelmDays = entries.filter((e) => e.mood === 'overwhelmed' || e.mood === 'stressed');
    const overwhelmAvgTasks = overwhelmDays.length > 0
        ? overwhelmDays.reduce((a, e) => a + e.tasksPlanned.length, 0) / overwhelmDays.length : 9999;
    const recentEnergy = entries.slice(0, 3).reduce((a, e) => a + e.energyLevel, 0) / Math.min(entries.length, 3);
    if (todayTaskCount >= overwhelmAvgTasks && recentEnergy < 3) return 'high';
    if (todayTaskCount >= overwhelmAvgTasks) return 'medium';
    return 'low';
}

export function buildInsightData(entries: DailyEntry[]): InsightData {
    const sorted = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const labels = sorted.map((e) => new Date(e.date).toLocaleDateString('en-US', { weekday: 'short' }));
    const planned = sorted.map((e) => e.tasksPlanned.length);
    const completed = sorted.map((e) => e.tasksCompleted.length);
    const energyValues = sorted.map((e) => e.energyLevel);
    const avgCompletionRate = entries.length === 0 ? 0
        : entries.reduce((acc, e) => acc + (e.tasksPlanned.length === 0 ? 1 : e.tasksCompleted.length / e.tasksPlanned.length), 0) / entries.length;
    const avgEnergyLevel = entries.length === 0 ? 3 : entries.reduce((a, e) => a + e.energyLevel, 0) / entries.length;
    const weeklyPattern = analyzeCompletionPattern(entries);
    return { planningVsCompletion: { labels, planned, completed }, energyTrend: { labels, values: energyValues }, weeklyPattern, avgCompletionRate, avgEnergyLevel };
}
