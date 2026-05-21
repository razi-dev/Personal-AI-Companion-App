import { DailyEntry, Forecast, TemporalInsight } from '../types';
import { addDays, parseDateString, toLocalDateString } from './dateUtils';

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function computeTemporalInsight(entries: DailyEntry[]): TemporalInsight {
    if (entries.length === 0) {
        return {
            trend: 'stable',
            energyTrend: 0,
            completionTrend: 0,
            seasonality: {},
            peakDay: null,
        };
    }

    const sorted = [...entries].sort((a, b) => parseDateString(a.date).getTime() - parseDateString(b.date).getTime());
    const recent = sorted.slice(-7);
    const prior = sorted.slice(-14, -7);

    const avgEnergy = (list: DailyEntry[]) => list.length === 0 ? 3 : list.reduce((a, e) => a + e.energyLevel, 0) / list.length;
    const avgCompletion = (list: DailyEntry[]) => list.length === 0 ? 0 : list.reduce((a, e) => {
        const ratio = e.tasksPlanned.length === 0 ? 1 : e.tasksCompleted.length / e.tasksPlanned.length;
        return a + ratio;
    }, 0) / list.length;

    const energyTrend = avgEnergy(recent) - avgEnergy(prior);
    const completionTrend = avgCompletion(recent) - avgCompletion(prior);
    const trend = energyTrend + completionTrend > 0.15 ? 'up' : energyTrend + completionTrend < -0.15 ? 'down' : 'stable';

    const seasonality: Record<string, number[]> = {};
    sorted.forEach((e) => {
        const day = parseDateString(e.date).toLocaleDateString('en-US', { weekday: 'long' });
        if (!seasonality[day]) seasonality[day] = [];
        const ratio = e.tasksPlanned.length === 0 ? 1 : e.tasksCompleted.length / e.tasksPlanned.length;
        seasonality[day].push(ratio);
    });
    const seasonalityAvg: Record<string, number> = {};
    let peakDay: string | null = null;
    let peakScore = -1;
    Object.entries(seasonality).forEach(([day, ratios]) => {
        const avg = ratios.reduce((a, b) => a + b, 0) / ratios.length;
        seasonalityAvg[day] = avg;
        if (avg > peakScore) {
            peakScore = avg;
            peakDay = day;
        }
    });

    return {
        trend,
        energyTrend,
        completionTrend,
        seasonality: seasonalityAvg,
        peakDay,
    };
}

export function computeForecast(
    temporal: TemporalInsight,
    baselineEnergy: number,
    baselineCompletion: number,
): Forecast {
    const expectedEnergy = clamp(baselineEnergy + temporal.energyTrend * 0.5, 1, 5);
    const expectedCompletionRate = clamp(baselineCompletion + temporal.completionTrend * 0.5, 0, 1);
    const riskLevel: Forecast['riskLevel'] =
        expectedEnergy < 2.3 || expectedCompletionRate < 0.4
            ? 'high'
            : expectedEnergy < 3 || expectedCompletionRate < 0.6
                ? 'medium'
                : 'low';

    return {
        date: toLocalDateString(addDays(new Date(), 1)),
        expectedEnergy,
        expectedCompletionRate,
        riskLevel,
    };
}
