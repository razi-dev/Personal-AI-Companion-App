import AsyncStorage from '@react-native-async-storage/async-storage';
import { BehaviorModel, DailyEntry, FeatureVector } from '../types';
import { parseDateString, toLocalDateString } from '../utils/dateUtils';

const MODEL_KEY = '@digital_twin_behavior_model';

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function ema(prev: number | null, next: number, alpha = 0.3): number {
    if (prev === null || Number.isNaN(prev)) return next;
    return prev * (1 - alpha) + next * alpha;
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
    return clamp(cov / (sdX * sdY), -1, 1);
}

export async function getBehaviorModel(): Promise<BehaviorModel | null> {
    try {
        const raw = await AsyncStorage.getItem(MODEL_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export async function saveBehaviorModel(model: BehaviorModel): Promise<void> {
    await AsyncStorage.setItem(MODEL_KEY, JSON.stringify(model));
}

export function buildBehaviorModel(
    prev: BehaviorModel | null,
    features: FeatureVector,
    entries: DailyEntry[],
): BehaviorModel {
    const today = toLocalDateString(new Date());

    const weekdayCompletion: Record<string, number[]> = {};
    const energySeries: number[] = [];
    const completionSeries: number[] = [];

    entries.forEach((e) => {
        const d = parseDateString(e.date);
        const day = d.toLocaleDateString('en-US', { weekday: 'long' });
        const ratio = e.tasksPlanned.length === 0 ? 1 : e.tasksCompleted.length / e.tasksPlanned.length;
        if (!weekdayCompletion[day]) weekdayCompletion[day] = [];
        weekdayCompletion[day].push(ratio);
        energySeries.push(e.energyLevel);
        completionSeries.push(ratio);
    });

    const weekdayCompletionAvg: Record<string, number> = {};
    Object.entries(weekdayCompletion).forEach(([day, ratios]) => {
        weekdayCompletionAvg[day] = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    });

    const energyCompletionSlope = computeCorrelation(energySeries, completionSeries);

    const lowCompletionDays = entries.filter((e) => {
        const ratio = e.tasksPlanned.length === 0 ? 1 : e.tasksCompleted.length / e.tasksPlanned.length;
        return ratio < 0.5;
    });
    const taskLoadThreshold = lowCompletionDays.length === 0
        ? 4
        : Math.round(lowCompletionDays.reduce((a, e) => a + e.tasksPlanned.length, 0) / lowCompletionDays.length);

    const consistencyScore = Math.round((features.totalEntries / Math.max(features.windowDays, 1)) * 100);

    return {
        id: prev?.id ?? `model-${Date.now()}`,
        updatedAt: new Date().toISOString(),
        baselineCompletionRate: clamp(ema(prev?.baselineCompletionRate ?? null, features.completionRate), 0, 1),
        baselineEnergy: clamp(ema(prev?.baselineEnergy ?? null, features.avgEnergy), 1, 5),
        energyCompletionSlope: clamp(ema(prev?.energyCompletionSlope ?? null, energyCompletionSlope, 0.4), -1, 1),
        weekdayCompletion: Object.keys(weekdayCompletionAvg).length > 0 ? weekdayCompletionAvg : (prev?.weekdayCompletion ?? {}),
        taskLoadThreshold: clamp(ema(prev?.taskLoadThreshold ?? null, taskLoadThreshold, 0.5), 1, 12),
        habitAdherence: clamp(ema(prev?.habitAdherence ?? null, features.habitCompletionRate), 0, 1),
        consistencyScore,
    };
}
