// ─── Core Enums ───────────────────────────────────────────────────────────────
export type EnergyLevel = 1 | 2 | 3 | 4 | 5;
export type Mood = 'overwhelmed' | 'stressed' | 'neutral' | 'focused' | 'great';
export type PersonalityTone = 'calm' | 'warm' | 'direct';
export type HabitFrequency = 'daily' | 'weekdays' | 'weekends';

// ─── Daily Entry ──────────────────────────────────────────────────────────────
export interface DailyEntry {
    id: string;
    date: string; // ISO date string
    tasksPlanned: string[];
    tasksCompleted: string[];
    energyLevel: EnergyLevel;
    mood: Mood;
    notes: string;
    createdAt: string;
}

// ─── Chat Message ─────────────────────────────────────────────────────────────
export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    isVoice?: boolean;
    isProactive?: boolean; // Twin-initiated messages
}

// ─── AI Decision Context ──────────────────────────────────────────────────────
export interface DecisionContext {
    userMessage: string;
    recentEntries: DailyEntry[];
    recentMessages: Message[];
    completionRatio: number;
    avgEnergyLevel: number;
    dominantMood: string;
    userProfile?: UserProfile;
    recentHabits?: HabitWithStats[];
    recentJournals?: JournalEntry[];
    behaviorInsights?: BehaviorInsights;
    behaviorModel?: BehaviorModel;
    temporalInsight?: TemporalInsight;
    forecast?: Forecast;
    xai?: XAIExplanation;
}

// ─── AI Response ──────────────────────────────────────────────────────────────
export interface AIResponse {
    advice: string;
    reasoning: string;
    suggestedAction: string;
    patternInsight?: string;
    explanation?: string;
    confidence?: number;
    factors?: string[];
}

// ─── Insights Data ────────────────────────────────────────────────────────────
export interface InsightData {
    planningVsCompletion: {
        labels: string[];
        planned: number[];
        completed: number[];
    };
    energyTrend: {
        labels: string[];
        values: number[];
    };
    weeklyPattern: string;
    avgCompletionRate: number;
    avgEnergyLevel: number;
}

// ─── User Profile ─────────────────────────────────────────────────────────────
export interface UserProfile {
    name: string;
    role: string; // e.g. "Software Engineer", "Student"
    primaryGoal: string; // e.g. "Be more productive", "Reduce stress"
    personalityTone: PersonalityTone;
    workStartHour: number; // 0-23
    workEndHour: number;
    morningCheckInHour: number; // notification hour
    eveningCheckInHour: number;
    onboardingComplete: boolean;
    createdAt: string;
    timezone: string;
}

// ─── Habit ───────────────────────────────────────────────────────────────────
export interface Habit {
    id: string;
    name: string;
    icon: string; // emoji
    color: string; // hex
    frequency: HabitFrequency;
    targetDays: number; // total target days for streak
    createdAt: string;
    isActive: boolean;
}

// ─── Habit Entry (Daily Check-off) ───────────────────────────────────────────
export interface HabitEntry {
    id: string;
    habitId: string;
    date: string; // ISO date
    completed: boolean;
    completedAt?: string;
}

// ─── Habit with Stats ─────────────────────────────────────────────────────────
export interface HabitWithStats extends Habit {
    currentStreak: number;
    longestStreak: number;
    completionRate: number; // 0-1
    todayCompleted: boolean;
    last30Days: boolean[]; // index 0 = oldest, index 29 = today
}

// ─── Journal Entry ────────────────────────────────────────────────────────────
export interface JournalEntry {
    id: string;
    date: string; // ISO date
    title: string;
    content: string;
    mood?: Mood;
    energyLevel?: EnergyLevel;
    tags: string[];
    aiReflection?: string; // AI-generated reflection
    createdAt: string;
    updatedAt: string;
    wordCount: number;
}

// ─── Weekly Review ────────────────────────────────────────────────────────────
export interface WeeklyReview {
    id: string;
    weekStart: string; // ISO date (Monday)
    weekEnd: string;   // ISO date (Sunday)
    avgCompletion: number;
    avgEnergy: number;
    dominantMood: string;
    totalTasksPlanned: number;
    totalTasksCompleted: number;
    habitsCompleted: number;
    totalHabitOpportunities: number;
    journalEntriesCount: number;
    topWins: string[];
    areasToImprove: string[];
    twinSummary: string; // AI-generated narrative
    recommendation: string;
    generatedAt: string;
}

// ─── Behavior Insights ────────────────────────────────────────────────────────
export interface BehaviorInsights {
    peakProductivityHour: number | null; // hour of day (0-23)
    peakProductivityDay: string | null;  // day of week name
    mostSkippedTaskTypes: string[];
    moodProductivityCorrelation: Record<string, number>; // mood -> avg completion
    energyCompletionCorrelation: number; // -1 to 1
    topicsMentioned: string[]; // from chat history
    consistencyScore: number; // 0-100
    streakRisk: boolean; // true if patterns suggest streak break coming
}

// ─── Calendar Event ───────────────────────────────────────────────────────────
export interface CalendarEvent {
    id: string;
    title: string;
    startDate: string; // ISO
    endDate: string;
    isAllDay: boolean;
    location?: string;
}

// ─── Proactive Message ────────────────────────────────────────────────────────
export interface ProactiveMessage {
    type: 'morning_checkin' | 'evening_reminder' | 'low_energy_alert' | 'streak_milestone' | 'followup' | 'habit_nudge' | 'weekly_ready';
    content: string;
    timestamp: string;
}

// --- Feature Store ---
export interface FeatureVector {
    id: string;
    userId?: string;
    date: string; // ISO date (local)
    windowDays: number;
    totalEntries: number;
    totalTasksPlanned: number;
    totalTasksCompleted: number;
    completionRate: number;
    avgEnergy: number;
    moodCounts: Record<Mood, number>;
    habitCompletionRate: number;
    journalCount: number;
    messageCount: number;
    createdAt: string;
}

// --- Behavioral Model ---
export interface BehaviorModel {
    id: string;
    userId?: string;
    updatedAt: string;
    baselineCompletionRate: number;
    baselineEnergy: number;
    energyCompletionSlope: number;
    weekdayCompletion: Record<string, number>;
    taskLoadThreshold: number;
    habitAdherence: number;
    consistencyScore: number;
}

// --- Temporal Insight ---
export interface TemporalInsight {
    trend: 'up' | 'down' | 'stable';
    energyTrend: number;
    completionTrend: number;
    seasonality: Record<string, number>;
    peakDay: string | null;
}

// --- Forecast ---
export interface Forecast {
    date: string;
    expectedEnergy: number;
    expectedCompletionRate: number;
    riskLevel: 'low' | 'medium' | 'high';
}

// --- Explainable AI ---
export interface XAIExplanation {
    explanation: string;
    factors: string[];
    confidence: number;
}

export interface BehaviorState {
    features: FeatureVector | null;
    model: BehaviorModel | null;
    temporal: TemporalInsight | null;
    forecast: Forecast | null;
    xai: XAIExplanation | null;
    updatedAt: string;
}
