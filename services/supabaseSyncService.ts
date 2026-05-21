import { BehaviorModel, DailyEntry, FeatureVector, Forecast, HabitWithStats, JournalEntry, Message, TemporalInsight, XAIExplanation, UserProfile } from '../types';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient';
import { getCurrentUserId } from './authService';

type SyncSnapshot = {
    entries: DailyEntry[];
    habits: HabitWithStats[];
    journals: JournalEntry[];
    messages: Message[];
    profile?: UserProfile;
    features: FeatureVector;
    model: BehaviorModel;
    temporal: TemporalInsight;
    forecast: Forecast;
    xai: XAIExplanation;
};

export async function syncSnapshot(snapshot: SyncSnapshot): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const userId = await getCurrentUserId();
    if (!userId) return;

    try {
        if (snapshot.profile) {
            await supabase.from('profiles').upsert([{
                user_id: userId,
                name: snapshot.profile.name,
                role: snapshot.profile.role,
                primary_goal: snapshot.profile.primaryGoal,
                personality_tone: snapshot.profile.personalityTone,
                work_start_hour: snapshot.profile.workStartHour,
                work_end_hour: snapshot.profile.workEndHour,
                morning_check_in_hour: snapshot.profile.morningCheckInHour,
                evening_check_in_hour: snapshot.profile.eveningCheckInHour,
                onboarding_complete: snapshot.profile.onboardingComplete,
                created_at: snapshot.profile.createdAt,
                timezone: snapshot.profile.timezone,
            }], { onConflict: 'user_id' });
        }

        const entryRows = snapshot.entries.map((e) => ({
            id: e.id,
            user_id: userId,
            date: e.date,
            tasks_planned: e.tasksPlanned,
            tasks_completed: e.tasksCompleted,
            energy_level: e.energyLevel,
            mood: e.mood,
            notes: e.notes,
            created_at: e.createdAt,
        }));
        await supabase.from('daily_entries').upsert(entryRows, { onConflict: 'id' });

        const habitRows = snapshot.habits.map((h) => ({
            id: h.id,
            user_id: userId,
            name: h.name,
            icon: h.icon,
            color: h.color,
            frequency: h.frequency,
            target_days: h.targetDays,
            created_at: h.createdAt,
            is_active: h.isActive,
        }));
        await supabase.from('habits').upsert(habitRows, { onConflict: 'id' });

        const journalRows = snapshot.journals.map((j) => ({
            id: j.id,
            user_id: userId,
            date: j.date,
            title: j.title,
            content: j.content,
            mood: j.mood,
            energy_level: j.energyLevel,
            tags: j.tags,
            ai_reflection: j.aiReflection,
            created_at: j.createdAt,
            updated_at: j.updatedAt,
            word_count: j.wordCount,
        }));
        await supabase.from('journal_entries').upsert(journalRows, { onConflict: 'id' });

        const messageRows = snapshot.messages.map((m) => ({
            id: m.id,
            user_id: userId,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            is_voice: m.isVoice ?? false,
            is_proactive: m.isProactive ?? false,
        }));
        await supabase.from('messages').upsert(messageRows, { onConflict: 'id' });

        await supabase.from('feature_vectors').upsert([{
            id: snapshot.features.id,
            user_id: userId,
            date: snapshot.features.date,
            window_days: snapshot.features.windowDays,
            total_entries: snapshot.features.totalEntries,
            total_tasks_planned: snapshot.features.totalTasksPlanned,
            total_tasks_completed: snapshot.features.totalTasksCompleted,
            completion_rate: snapshot.features.completionRate,
            avg_energy: snapshot.features.avgEnergy,
            mood_counts: snapshot.features.moodCounts,
            habit_completion_rate: snapshot.features.habitCompletionRate,
            journal_count: snapshot.features.journalCount,
            message_count: snapshot.features.messageCount,
            created_at: snapshot.features.createdAt,
        }], { onConflict: 'id' });

        await supabase.from('behavior_models').upsert([{
            id: snapshot.model.id,
            user_id: userId,
            updated_at: snapshot.model.updatedAt,
            baseline_completion_rate: snapshot.model.baselineCompletionRate,
            baseline_energy: snapshot.model.baselineEnergy,
            energy_completion_slope: snapshot.model.energyCompletionSlope,
            weekday_completion: snapshot.model.weekdayCompletion,
            task_load_threshold: snapshot.model.taskLoadThreshold,
            habit_adherence: snapshot.model.habitAdherence,
            consistency_score: snapshot.model.consistencyScore,
        }], { onConflict: 'id' });

        await supabase.from('temporal_insights').upsert([{
            id: `temporal-${userId}`,
            user_id: userId,
            trend: snapshot.temporal.trend,
            energy_trend: snapshot.temporal.energyTrend,
            completion_trend: snapshot.temporal.completionTrend,
            seasonality: snapshot.temporal.seasonality,
            peak_day: snapshot.temporal.peakDay,
        }], { onConflict: 'id' });

        await supabase.from('forecasts').upsert([{
            id: `forecast-${userId}`,
            user_id: userId,
            date: snapshot.forecast.date,
            expected_energy: snapshot.forecast.expectedEnergy,
            expected_completion_rate: snapshot.forecast.expectedCompletionRate,
            risk_level: snapshot.forecast.riskLevel,
        }], { onConflict: 'id' });

        await supabase.from('xai_explanations').upsert([{
            id: `xai-${userId}`,
            user_id: userId,
            explanation: snapshot.xai.explanation,
            factors: snapshot.xai.factors,
            confidence: snapshot.xai.confidence,
        }], { onConflict: 'id' });
    } catch (err) {
        console.warn('supabaseSyncService syncSnapshot error:', err);
    }
}
