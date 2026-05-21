import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile, PersonalityTone } from '../types';

const PROFILE_KEY = '@digital_twin_profile';

export const DEFAULT_PROFILE: UserProfile = {
    name: '',
    role: '',
    primaryGoal: '',
    personalityTone: 'calm',
    workStartHour: 9,
    workEndHour: 18,
    morningCheckInHour: 8,
    eveningCheckInHour: 21,
    onboardingComplete: false,
    createdAt: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

export async function getProfile(): Promise<UserProfile> {
    try {
        const raw = await AsyncStorage.getItem(PROFILE_KEY);
        if (!raw) return { ...DEFAULT_PROFILE };
        return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
    } catch {
        return { ...DEFAULT_PROFILE };
    }
}

export async function saveProfile(profile: UserProfile): Promise<void> {
    try {
        await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch (err) {
        console.error('profileService.saveProfile error:', err);
    }
}

export async function updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const current = await getProfile();
    const updated = { ...current, ...updates };
    await saveProfile(updated);
    return updated;
}

export async function isOnboardingComplete(): Promise<boolean> {
    const profile = await getProfile();
    return profile.onboardingComplete;
}

export function getToneSystemInstruction(tone: PersonalityTone): string {
    switch (tone) {
        case 'warm':
            return 'Be warm, encouraging, and emotionally supportive like a caring friend. Use gentle language.';
        case 'direct':
            return 'Be direct, concise, and action-oriented. Skip pleasantries and give clear recommendations fast.';
        case 'calm':
        default:
            return 'Be calm, analytical, and non-judgmental. Speak thoughtfully without excessive emotion.';
    }
}
