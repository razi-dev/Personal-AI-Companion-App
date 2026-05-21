import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { UserProfile } from '../types';

let notificationsModule: typeof import('expo-notifications') | null = null;
let notificationsInitAttempted = false;

function isExpoGo(): boolean {
    return Constants.appOwnership === 'expo';
}

async function getNotifications(): Promise<typeof import('expo-notifications') | null> {
    if (isExpoGo()) {
        if (!notificationsInitAttempted) {
            console.warn('expo-notifications is disabled in Expo Go. Use a development build for push notifications.');
            notificationsInitAttempted = true;
        }
        return null;
    }
    if (notificationsModule) return notificationsModule;
    const mod = await import('expo-notifications');
    mod.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
    notificationsModule = mod;
    return mod;
}

export async function requestNotificationPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
        console.warn('Notifications only work on physical devices');
        return false;
    }
    const Notifications = await getNotifications();
    if (!Notifications) return false;
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('digital-twin', {
            name: 'Digital Twin',
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
        });
    }
    return status === 'granted';
}

export async function scheduleAllNotifications(profile: UserProfile): Promise<void> {
    const Notifications = await getNotifications();
    if (!Notifications) return;
    // Cancel existing first
    await Notifications.cancelAllScheduledNotificationsAsync();

    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) return;

    // Morning check-in
    await scheduleDailyNotification(
        'morning-checkin',
        '🌅 Good Morning, ' + (profile.name || 'there') + '!',
        "Your Twin is ready. Log today's plan and let's make it count.",
        profile.morningCheckInHour,
        0,
    );

    // Evening reflection
    await scheduleDailyNotification(
        'evening-reflection',
        '🌙 Evening Check-In',
        "How did today go? Log your reflection before you wind down.",
        profile.eveningCheckInHour,
        0,
    );
}

async function scheduleDailyNotification(
    identifier: string,
    title: string,
    body: string,
    hour: number,
    minute: number,
): Promise<void> {
    const Notifications = await getNotifications();
    if (!Notifications) return;
    await Notifications.scheduleNotificationAsync({
        identifier,
        content: { title, body, sound: true },
        trigger: {
            type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
            repeats: true,
            hour,
            minute,
        },
    });
}

export async function sendLowEnergyAlert(name: string): Promise<void> {
    const Notifications = await getNotifications();
    if (!Notifications) return;
    await Notifications.scheduleNotificationAsync({
        content: {
            title: '⚡ Low Energy Detected',
            body: `Hey ${name || 'there'}, you've logged low energy 3 days in a row. Your Twin wants to check in.`,
            sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, repeats: false },
    });
}

export async function sendStreakMilestoneAlert(habitName: string, streak: number): Promise<void> {
    const Notifications = await getNotifications();
    if (!Notifications) return;
    await Notifications.scheduleNotificationAsync({
        content: {
            title: `🔥 ${streak}-Day Streak!`,
            body: `Your "${habitName}" habit is on a ${streak}-day streak. Keep it going!`,
            sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2, repeats: false },
    });
}

export async function sendWeeklyReviewReady(name: string): Promise<void> {
    const Notifications = await getNotifications();
    if (!Notifications) return;
    await Notifications.scheduleNotificationAsync({
        content: {
            title: '📋 Weekly Review Ready',
            body: `${name || 'Your'} Twin has analyzed your week. Tap to see your personalized review.`,
            sound: true,
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 3, repeats: false },
    });
}

export async function cancelAllNotifications(): Promise<void> {
    const Notifications = await getNotifications();
    if (!Notifications) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
}
