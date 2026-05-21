import AsyncStorage from '@react-native-async-storage/async-storage';
import { BehaviorState } from '../types';
import { getAllEntries, getAllMessages } from './memoryService';
import { getAllJournalEntries } from './journalService';
import { getHabitsWithStats } from './habitService';
import { getProfile } from './profileService';
import { computeFeatureVector, saveFeatureVector } from './featureStoreService';
import { buildBehaviorModel, getBehaviorModel, saveBehaviorModel } from './modelService';
import { computeForecast, computeTemporalInsight } from '../utils/temporalAnalysis';
import { buildXAIExplanation } from './xaiService';
import { syncSnapshot } from './supabaseSyncService';

const STATE_KEY = '@digital_twin_behavior_state';

export async function getBehaviorState(): Promise<BehaviorState | null> {
    try {
        const raw = await AsyncStorage.getItem(STATE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export async function refreshBehaviorEngine(): Promise<BehaviorState> {
    const [entries, habits, journals, messages, prevModel, profile] = await Promise.all([
        getAllEntries(),
        getHabitsWithStats(),
        getAllJournalEntries(),
        getAllMessages(),
        getBehaviorModel(),
        getProfile(),
    ]);

    const features = computeFeatureVector(entries, habits, journals, messages, 30);
    await saveFeatureVector(features);

    const model = buildBehaviorModel(prevModel, features, entries);
    await saveBehaviorModel(model);

    const temporal = computeTemporalInsight(entries);
    const forecast = computeForecast(temporal, model.baselineEnergy, model.baselineCompletionRate);
    const xai = buildXAIExplanation(features, model, temporal, forecast);

    const state: BehaviorState = {
        features,
        model,
        temporal,
        forecast,
        xai,
        updatedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(state));
    await syncSnapshot({ entries, habits, journals, messages, profile, features, model, temporal, forecast, xai });
    return state;
}
