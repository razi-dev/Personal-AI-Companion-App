import { BehaviorModel, FeatureVector, Forecast, TemporalInsight, XAIExplanation } from '../types';

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function buildXAIExplanation(
    features: FeatureVector | null,
    model: BehaviorModel | null,
    temporal: TemporalInsight | null,
    forecast: Forecast | null,
): XAIExplanation {
    const factors: string[] = [];

    if (features) {
        if (features.completionRate < 0.5) factors.push('low completion rate');
        if (features.avgEnergy < 2.5) factors.push('low average energy');
        if (features.habitCompletionRate < 0.4) factors.push('habit adherence is low');
        if (features.totalEntries < 5) factors.push('limited recent data');
    }

    if (model) {
        if (model.energyCompletionSlope > 0.4) factors.push('completion strongly tied to energy');
        if (model.taskLoadThreshold <= 3) factors.push('high sensitivity to task load');
        if (model.consistencyScore < 40) factors.push('inconsistent logging');
    }

    if (temporal) {
        if (temporal.trend === 'down') factors.push('recent trend is downward');
        if (temporal.trend === 'up') factors.push('recent trend is upward');
    }

    if (forecast && forecast.riskLevel === 'high') factors.push('forecast suggests elevated risk');

    const confidenceBase = features ? clamp(features.totalEntries / 20, 0.3, 0.85) : 0.35;
    const confidence = clamp(confidenceBase + (factors.includes('limited recent data') ? -0.15 : 0), 0.2, 0.9);

    const explanation = factors.length === 0
        ? 'No strong signals detected; recommendation is based on your baseline patterns.'
        : `Recommendation driven by ${factors.slice(0, 3).join(', ')}.`;

    return {
        explanation,
        factors: factors.length > 0 ? factors : ['baseline patterns'],
        confidence,
    };
}
