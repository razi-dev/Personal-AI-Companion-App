import { AIResponse, DailyEntry, DecisionContext, Message, UserProfile, HabitWithStats, JournalEntry, BehaviorInsights, WeeklyReview } from '../types';
import { computeAvgEnergy, computeCompletionRatio, getDominantMood, localDateString } from './memoryService';
import { getToneSystemInstruction } from './profileService';
import { buildJournalSummaryForAI } from './journalService';
import { getBehaviorState } from './behaviorEngine';

const AI_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const AI_API_KEY = (
    process.env.EXPO_PUBLIC_OPENAI_API_KEY ??
    process.env.OPENAI_API_KEY ??
    ''
).trim();
const AI_MODEL = 'llama-3.3-70b-versatile';
const MAX_HISTORY_MESSAGES = 8;
let warnedAboutMissingKey = false;

function hasConfiguredApiKey(): boolean {
    return !!AI_API_KEY && AI_API_KEY !== 'YOUR_OPENAI_API_KEY';
}

function hashSeed(seed: string): number {
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
        hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return hash;
}

function pickBySeed<T>(items: T[], seed: string): T {
    return items[hashSeed(seed) % items.length];
}

function detectIntent(input: string): 'PERSONAL' | 'GENERAL' {
    const personalRegex = /\b(my|me|i|today|habit|energy|mood|tired|feel|productive|twin|stress|overwhelmed)\b/i;
    return personalRegex.test(input) ? 'PERSONAL' : 'GENERAL';
}

function buildGeneralPrompt(context: DecisionContext): string {
    const { userProfile } = context;
    const toneInstruction = userProfile ? getToneSystemInstruction(userProfile.personalityTone) : '';
    
    return `You are a helpful AI assistant.

${toneInstruction}

Answer the user's question clearly and naturally.
DO NOT include personal data like habits, energy, or logs unless explicitly asked.

Response rules:
1. Answer the question directly in the "advice" field.
2. Provide background or reasoning in the "reasoning" field.
3. Suggest a relevant follow-up action in "suggestedAction".
4. Keep the total response concise.

Return ONLY JSON with keys: advice, reasoning, suggestedAction, patternInsight, explanation, confidence, factors`;
}

function buildPersonalPrompt(context: DecisionContext): string {
    const { recentEntries, recentMessages, completionRatio, avgEnergyLevel, dominantMood, userProfile, recentHabits, recentJournals, behaviorInsights, behaviorModel, temporalInsight, forecast, xai } = context;

    const toneInstruction = userProfile ? getToneSystemInstruction(userProfile.personalityTone) : '';
    const userName = userProfile?.name ? `The user's name is ${userProfile.name}.` : '';
    const userRole = userProfile?.role ? `They work as: ${userProfile.role}.` : '';
    const userGoal = userProfile?.primaryGoal ? `Their primary goal: ${userProfile.primaryGoal}.` : '';

    const entrySummaries = recentEntries
        .slice(0, 14)
        .map((entry) => {
            const date = new Date(entry.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            return `- ${date}: energy ${entry.energyLevel}/5, mood ${entry.mood}, planned ${entry.tasksPlanned.length}, completed ${entry.tasksCompleted.length}, notes "${entry.notes || 'none'}"`;
        })
        .join('\n');

    const historySummary = recentMessages
        .slice(-MAX_HISTORY_MESSAGES)
        .map((message) => `${message.role}: ${message.content}`)
        .join('\n');

    const habitSummary = recentHabits && recentHabits.length > 0
        ? recentHabits.map((h) => `- ${h.icon} ${h.name}: ${h.currentStreak}-day streak, ${Math.round(h.completionRate * 100)}% rate, today: ${h.todayCompleted ? '✓' : '✗'}`).join('\n')
        : 'No habits tracked yet.';

    const journalSummary = recentJournals ? buildJournalSummaryForAI(recentJournals) : 'No journal entries yet.';

    const behaviorSummary = behaviorInsights
        ? `- Consistency: ${behaviorInsights.consistencyScore}%
- Peak day: ${behaviorInsights.peakProductivityDay ?? 'unknown'}
- Energy↔completion correlation: ${behaviorInsights.energyCompletionCorrelation.toFixed(2)}
- Mood→productivity: ${Object.entries(behaviorInsights.moodProductivityCorrelation).map(([m, r]) => `${m}=${Math.round(r * 100)}%`).join(', ')}
- Topics discussed: ${behaviorInsights.topicsMentioned.join(', ') || 'none'}`
        : '';


    const modelSummary = behaviorModel
        ? `- Baseline completion: ${Math.round(behaviorModel.baselineCompletionRate * 100)}%
- Baseline energy: ${behaviorModel.baselineEnergy.toFixed(1)}/5
- Energy sensitivity: ${behaviorModel.energyCompletionSlope.toFixed(2)}
- Task load threshold: ${Math.round(behaviorModel.taskLoadThreshold)} tasks`
        : '';

    const temporalSummary = temporalInsight
        ? `- Trend: ${temporalInsight.trend}
- Energy trend: ${temporalInsight.energyTrend.toFixed(2)}
- Completion trend: ${temporalInsight.completionTrend.toFixed(2)}
- Peak day (by completion): ${temporalInsight.peakDay ?? 'unknown'}`
        : '';

    const forecastSummary = forecast
        ? `- Tomorrow expected energy: ${forecast.expectedEnergy.toFixed(1)}/5
- Tomorrow expected completion: ${Math.round(forecast.expectedCompletionRate * 100)}%
- Risk level: ${forecast.riskLevel}`
        : '';

    const xaiSummary = xai
        ? `- Explanation: ${xai.explanation}
- Factors: ${xai.factors.slice(0, 4).join(', ')}
- Confidence: ${Math.round(xai.confidence * 100)}%`
        : '';
    return `You are a calm, practical AI Digital Twin — a personal companion who knows this user deeply.

${toneInstruction}
${userName} ${userRole} ${userGoal}

Personality:
- Empathetic and non-judgmental
- Personalized, specific, and concise
- No generic motivation cliches
- Reference the user's actual data and patterns
- Use second person voice

User daily logs (last ${recentEntries.length} days):
${entrySummaries || '- No logs yet. Encourage daily logging.'}

Habit tracking:
${habitSummary}

Recent journal entries:
${journalSummary}

Behavior patterns:
${behaviorSummary || '- Not enough data yet.'}

Behavior model:
${modelSummary || '- Not enough model data yet.'}

Temporal insights:
${temporalSummary || '- Not enough temporal data yet.'}

Forecast:
${forecastSummary || '- No forecast available yet.'}

Explainability (XAI):
${xaiSummary || '- No explanation available yet.'}

Recent chat context:
${historySummary || '- No prior messages in this session.'}

Computed stats:
- Completion ratio: ${Math.round(completionRatio * 100)}%
- Average energy: ${avgEnergyLevel.toFixed(1)}/5
- Dominant mood: ${dominantMood}

Response rules:
1. Reference at least one concrete behavior pattern from the user's data
2. Give a clear, personalized recommendation
3. Keep total response concise (under 120 words)
4. End with one immediate action
5. Provide a short explanation and 2-4 factors

Return ONLY JSON with keys: advice, reasoning, suggestedAction, patternInsight, explanation, confidence, factors`;
}

function buildConversationMessages(userMessage: string, recentMessages: Message[]) {
    const history = recentMessages
        .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
        .slice(-MAX_HISTORY_MESSAGES)
        .map((msg) => ({ role: msg.role, content: msg.content }));

    const hasCurrentUserAtEnd =
        history.length > 0 &&
        history[history.length - 1].role === 'user' &&
        history[history.length - 1].content.trim() === userMessage.trim();

    if (!hasCurrentUserAtEnd) {
        history.push({ role: 'user', content: userMessage });
    }
    return history;
}

function hydrateAIResponse(response: AIResponse, context: DecisionContext): AIResponse {
    if (!context.xai) return response;
    return {
        ...response,
        explanation: response.explanation ?? context.xai.explanation,
        confidence: response.confidence ?? context.xai.confidence,
        factors: response.factors ?? context.xai.factors,
    };
}

export async function getAIDecision(
    userMessage: string,
    recentEntries: DailyEntry[],
    recentMessages: Message[] = [],
    userProfile?: UserProfile,
    recentHabits?: HabitWithStats[],
    recentJournals?: JournalEntry[],
    behaviorInsights?: BehaviorInsights,
): Promise<AIResponse> {
    const completionRatio = computeCompletionRatio(recentEntries);
    const avgEnergyLevel = computeAvgEnergy(recentEntries);
    const dominantMood = getDominantMood(recentEntries);
    const behaviorState = await getBehaviorState();

    const context: DecisionContext = {
        userMessage,
        recentEntries,
        recentMessages,
        completionRatio,
        avgEnergyLevel,
        dominantMood,
        userProfile,
        recentHabits,
        recentJournals,
        behaviorInsights,
        behaviorModel: behaviorState?.model ?? undefined,
        temporalInsight: behaviorState?.temporal ?? undefined,
        forecast: behaviorState?.forecast ?? undefined,
        xai: behaviorState?.xai ?? undefined,
    };

    if (!hasConfiguredApiKey()) {
        if (!warnedAboutMissingKey) {
            console.warn('AI API key missing. Using local fallback responses.');
            warnedAboutMissingKey = true;
        }
        return localDecisionEngine(userMessage, context);
    }

    try {
        const intent = detectIntent(userMessage);
        const systemPrompt = intent === 'PERSONAL' ? buildPersonalPrompt(context) : buildGeneralPrompt(context);

        const response = await fetch(AI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${AI_API_KEY}`,
            },
            body: JSON.stringify({
                model: AI_MODEL,
                messages: [{ role: 'system', content: systemPrompt }, ...buildConversationMessages(userMessage, recentMessages)],
                temperature: 0.8,
                max_tokens: 400,
                response_format: { type: 'json_object' },
            }),
        });

        if (!response.ok) {
            if (response.status === 401) throw new Error('AI API error: 401');
            throw new Error(`AI API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        return hydrateAIResponse(JSON.parse(content) as AIResponse, context);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (!message.includes('401')) console.error('aiService error:', err);
        return localDecisionEngine(userMessage, context);
    }
}

// ─── Proactive Twin Message Generator ────────────────────────────────────────

export async function generateProactiveMessage(
    type: 'morning' | 'evening' | 'low_energy' | 'streak_risk' | 'weekly_ready',
    context: { profile?: UserProfile; entries?: DailyEntry[]; habits?: HabitWithStats[] }
): Promise<string> {
    const { profile, entries = [], habits = [] } = context;
    const name = profile?.name || 'there';
    const avgEnergy = computeAvgEnergy(entries);

    const messages: Record<string, string[]> = {
        morning: [
            `Good morning, ${name}. Your energy averaged ${avgEnergy.toFixed(1)}/5 this week. What's the most important thing to move forward today?`,
            `Morning, ${name}. Based on your patterns, ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}s tend to be your ${avgEnergy > 3 ? 'stronger' : 'quieter'} days. Plan accordingly.`,
            `Hey ${name} — ready to log today? Your twin is here when you need a decision check.`,
        ],
        evening: [
            `Evening, ${name}. How did today's plan hold up? Log your reflection to keep your patterns sharp.`,
            `Before you wind down, ${name} — a 60-second log helps your twin give you sharper advice tomorrow.`,
            `End-of-day check-in, ${name}. Logging even a rough summary is enough. Your twin will do the rest.`,
        ],
        low_energy: [
            `${name}, I've noticed your energy has been below 2/5 for a few days. This isn't a push to do more — it's a signal to protect rest. Want to talk through it?`,
            `Your energy logs suggest you might be running low, ${name}. Let's adjust today's plan to match what you actually have. Open the chat anytime.`,
        ],
        streak_risk: [
            `${name}, you have some habits with active streaks that you haven't checked in on yet today. A quick tap is all it takes.`,
            `Streak check: ${habits.filter((h) => !h.todayCompleted && h.currentStreak > 0).map((h) => h.name).join(', ')} — still open today.`,
        ],
        weekly_ready: [
            `Your weekly review is ready, ${name}. Your twin has analyzed last week's patterns and has a personalized summary waiting.`,
        ],
    };

    const options = messages[type] ?? messages.morning;
    // Use local date string so the seed is timezone-correct
    const seed = `${type}-${localDateString()}-${name}`;
    return pickBySeed(options, seed);
}

// ─── Weekly Review Generator ──────────────────────────────────────────────────

export async function generateWeeklyReview(
    entries: DailyEntry[],
    habits: HabitWithStats[],
    journalCount: number,
    profile?: UserProfile,
): Promise<WeeklyReview> {
    // Compute current week Mon–Sun in LOCAL time
    // (getDay()+6)%7 gives 0=Mon … 6=Sun, preventing the Sunday jump
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekStartStr = localDateString(weekStart);
    const weekEndStr = localDateString(weekEnd);

    const weekEntries = entries.filter((e) => e.date >= weekStartStr && e.date <= weekEndStr);

    const avgCompletion = weekEntries.length === 0 ? 0
        : weekEntries.reduce((acc, e) => acc + (e.tasksPlanned.length === 0 ? 1 : e.tasksCompleted.length / e.tasksPlanned.length), 0) / weekEntries.length;
    const avgEnergy = weekEntries.length === 0 ? 3
        : weekEntries.reduce((a, e) => a + e.energyLevel, 0) / weekEntries.length;

    const moodCounts: Record<string, number> = {};
    weekEntries.forEach((e) => { moodCounts[e.mood] = (moodCounts[e.mood] ?? 0) + 1; });
    const dominantMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'neutral';

    const totalTasksPlanned = weekEntries.reduce((a, e) => a + e.tasksPlanned.length, 0);
    const totalTasksCompleted = weekEntries.reduce((a, e) => a + e.tasksCompleted.length, 0);

    const habitsCompleted = habits.reduce((a, h) => a + (h.todayCompleted ? 1 : 0), 0);
    const totalHabitOpportunities = habits.length * 7;

    const name = profile?.name || 'You';
    const completionPercent = Math.round(avgCompletion * 100);

    const twinSummary = generateWeeklySummary(name, completionPercent, avgEnergy, dominantMood, weekEntries.length);
    const recommendation = generateWeeklyRecommendation(completionPercent, avgEnergy, dominantMood, habits);

    const topWins: string[] = [];
    if (completionPercent >= 80) topWins.push('Strong task completion this week');
    if (avgEnergy >= 4) topWins.push('High energy levels maintained');
    if (habits.some((h) => h.currentStreak >= 7)) topWins.push('7+ day habit streaks active');
    if (journalCount >= 3) topWins.push('Consistent journaling habit');
    if (topWins.length === 0) topWins.push('Showed up and logged your data');

    const areasToImprove: string[] = [];
    if (completionPercent < 50) areasToImprove.push('Task completion — try planning fewer, more realistic tasks');
    if (avgEnergy < 2.5) areasToImprove.push('Energy management — review sleep and rest habits');
    if (dominantMood === 'overwhelmed' || dominantMood === 'stressed') areasToImprove.push('Stress reduction — consider reducing daily task scope');
    if (areasToImprove.length === 0) areasToImprove.push('Keep the momentum going into next week');

    return {
        id: `review-${weekStartStr}`,
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        avgCompletion,
        avgEnergy,
        dominantMood,
        totalTasksPlanned,
        totalTasksCompleted,
        habitsCompleted,
        totalHabitOpportunities,
        journalEntriesCount: journalCount,
        topWins,
        areasToImprove,
        twinSummary,
        recommendation,
        generatedAt: new Date().toISOString(),
    };
}

function generateWeeklySummary(name: string, completion: number, energy: number, mood: string, daysLogged: number): string {
    if (daysLogged === 0) return `${name}, there's no data logged this week yet. Start logging daily to unlock your weekly review.`;
    if (completion >= 80 && energy >= 3.5) return `Strong week, ${name}. Your completion rate of ${completion}% with ${energy.toFixed(1)}/5 energy shows you were well-calibrated. Your planning matched your actual capacity.`;
    if (completion < 50) return `${name}, this week's completion was ${completion}%. Your data suggests the task load may have exceeded your available energy (${energy.toFixed(1)}/5). Scaling back next week's plan by 20% could make a real difference.`;
    if (mood === 'overwhelmed' || mood === 'stressed') return `${name}, your dominant mood this week was ${mood}. Even with ${completion}% completion, the emotional cost seems high. Your twin recommends prioritizing recovery over output next week.`;
    return `Decent week, ${name}. ${completion}% completion with ${energy.toFixed(1)}/5 average energy. Consistent, though there's room to improve your planning-to-completion ratio.`;
}

function generateWeeklyRecommendation(completion: number, energy: number, mood: string, habits: HabitWithStats[]): string {
    const activeStreaks = habits.filter((h) => h.currentStreak >= 3);
    if (completion >= 80 && energy >= 4) return "Your baseline is strong. Next week, consider tackling one important goal you've been deferring.";
    if (energy < 2.5) return 'Prioritize sleep and recovery next week. Plan lighter cognitive tasks and protect your rest windows.';
    if (mood === 'overwhelmed') return 'Set a hard limit of 3 tasks per day next week. Use your twin to help prioritize which 3 matter most.';
    if (activeStreaks.length > 0) return `Protect your ${activeStreaks.map((h) => h.name).join(', ')} streak${activeStreaks.length > 1 ? 's' : ''} — they're your momentum anchors.`;
    return 'Focus on logging daily next week — the more data your twin has, the sharper the advice becomes.';
}

export function formatAIResponseForChat(response: AIResponse): string {
    const parts = [response.advice];
    if (response.patternInsight) parts.push(`\n${response.patternInsight}`);
    if (response.explanation) parts.push(`\nWhy: ${response.explanation}`);
    if (response.confidence !== undefined) parts.push(`Confidence: ${Math.round(response.confidence * 100)}%`);
    parts.push(`\n-> ${response.suggestedAction}`);
    return parts.join('\n');
}

// ─── Local Fallback ───────────────────────────────────────────────────────────
function localDecisionEngine(userMessage: string, context: DecisionContext): AIResponse {
    const { completionRatio, avgEnergyLevel, dominantMood, recentEntries, recentMessages, userProfile } = context;
    const msg = userMessage.toLowerCase();
    const name = userProfile?.name ? `${userProfile.name}, ` : '';

    const isOverwhelmed = msg.includes('overwhelm') || msg.includes('stressed') || dominantMood === 'overwhelmed';
    const isLowEnergy = avgEnergyLevel < 2.5 || msg.includes('tired') || msg.includes('exhausted');
    const isPlanningIntent = msg.includes('plan') || msg.includes('focus') || msg.includes('priority') || msg.includes('decide');

    const completionPercent = Math.round(completionRatio * 100);
    const dailySeed = `${localDateString()}|${userMessage}|${dominantMood}`;

    let advice = '', reasoning = '', suggestedAction = '', patternInsight = '';

    if (isOverwhelmed || (isPlanningIntent && completionRatio < 0.55)) {
        advice = `${name}your logs suggest pressure rises when task volume exceeds capacity. You're completing about ${completionPercent}% of planned tasks.`;
        reasoning = 'A smaller plan improves finish rate and reduces cognitive drag.';
        suggestedAction = 'Pick one must-do task and one optional task for today. Ignore everything else until those are done.';
        patternInsight = 'You perform better when daily scope matches realistic energy, not ideal ambition.';
    } else if (isLowEnergy) {
        advice = `${name}your average energy is ${avgEnergyLevel.toFixed(1)}/5, so heavy tasks will feel harder than usual.`;
        reasoning = 'When energy dips, matching task intensity to capacity preserves momentum.';
        suggestedAction = 'Do one low-friction task in the next 20 minutes, then take a short reset break.';
        patternInsight = 'Your productivity is energy-dependent — pacing strategy matters more than motivation.';
    } else {
        advice = `${name}you're in a stable range with ${completionPercent}% completion and ${avgEnergyLevel.toFixed(1)}/5 energy.`;
        reasoning = 'No major warning signal visible in your recent logs.';
        suggestedAction = pickBySeed([
            'Select one important but delayed task and move it forward by one concrete step today.',
            'Use your next uninterrupted block for a single high-value task.',
            'Commit to one measurable outcome before end of day.',
        ], dailySeed);
        patternInsight = 'Consistency is building. Use it to compound progress with one focused action.';
    }

    return {
        advice,
        reasoning,
        suggestedAction,
        patternInsight,
        explanation: context.xai?.explanation,
        confidence: context.xai?.confidence,
        factors: context.xai?.factors,
    };
}
