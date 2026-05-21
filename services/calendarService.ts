import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import { CalendarEvent } from '../types';

export async function requestCalendarPermissions(): Promise<boolean> {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
}

export async function getTodayCalendarEvents(): Promise<CalendarEvent[]> {
    try {
        const granted = await requestCalendarPermissions();
        if (!granted) return [];

        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const calendarIds = calendars.map((c) => c.id);

        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);

        const events = await Calendar.getEventsAsync(calendarIds, start, end);

        return events.map((e) => ({
            id: e.id,
            title: e.title || 'Untitled Event',
            startDate: e.startDate as unknown as string,
            endDate: e.endDate as unknown as string,
            isAllDay: e.allDay ?? false,
            location: e.location,
        }));
    } catch (err) {
        console.warn('calendarService error:', err);
        return [];
    }
}

export async function getUpcomingCalendarEvents(days = 3): Promise<CalendarEvent[]> {
    try {
        const granted = await requestCalendarPermissions();
        if (!granted) return [];

        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const calendarIds = calendars.map((c) => c.id);

        const start = new Date();
        const end = new Date();
        end.setDate(end.getDate() + days);

        const events = await Calendar.getEventsAsync(calendarIds, start, end);

        return events
            .filter((e) => e.title)
            .slice(0, 10)
            .map((e) => ({
                id: e.id,
                title: e.title,
                startDate: e.startDate as unknown as string,
                endDate: e.endDate as unknown as string,
                isAllDay: e.allDay ?? false,
                location: e.location,
            }));
    } catch (err) {
        console.warn('calendarService error:', err);
        return [];
    }
}

export function buildCalendarContextForAI(events: CalendarEvent[]): string {
    if (events.length === 0) return 'No upcoming calendar events.';
    return events.map((e) => {
        const start = new Date(e.startDate);
        const timeStr = e.isAllDay ? 'All day' : start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const dayStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        return `- ${e.title} | ${dayStr} ${timeStr}`;
    }).join('\n');
}
