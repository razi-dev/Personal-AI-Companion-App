import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { speak, stopSpeaking } from '../../services/voiceService';

type Exercise = {
    id: string;
    title: string;
    detail: string;
    icon: keyof typeof Ionicons.glyphMap;
    instructions: string[];
};

const PHYSICAL_EXERCISES: Exercise[] = [
    {
        id: 'pushups',
        title: 'Push-ups',
        detail: '10 reps',
        icon: 'barbell-outline',
        instructions: [
            'Start in a high plank with hands under shoulders.',
            'Lower your chest toward the floor in a controlled motion.',
            'Press back up while keeping your body in a straight line.',
        ],
    },
    {
        id: 'squats',
        title: 'Squats',
        detail: '15 reps',
        icon: 'walk-outline',
        instructions: [
            'Stand with feet shoulder-width apart.',
            'Push your hips back and bend your knees.',
            'Drive through your heels to stand back up.',
        ],
    },
    {
        id: 'plank',
        title: 'Plank',
        detail: '2 mins',
        icon: 'body-outline',
        instructions: [
            'Place forearms on the floor and extend your legs.',
            'Keep your core tight and hips level.',
            'Hold steady and breathe slowly.',
        ],
    },
];

const MENTAL_EXERCISES: Exercise[] = [
    {
        id: 'memory',
        title: 'Memory Game',
        detail: '5 mins',
        icon: 'game-controller-outline',
        instructions: [
            'Look at a list of 8 random words for 30 seconds.',
            'Hide the list and recall as many as you can.',
            'Repeat twice and try to improve each round.',
        ],
    },
    {
        id: 'focus',
        title: 'Focus Timer',
        detail: '10 mins',
        icon: 'timer-outline',
        instructions: [
            'Pick one task you want to finish.',
            'Set a timer for 10 minutes.',
            'Work only on that task until the timer ends.',
        ],
    },
    {
        id: 'breathing',
        title: 'Breathing',
        detail: '2 mins',
        icon: 'leaf-outline',
        instructions: [
            'Inhale for 4 seconds.',
            'Hold for 4 seconds.',
            'Exhale for 4 seconds.',
            'Hold for 4 seconds and repeat.',
        ],
    },
];

export default function TrainingScreen() {
    const [speakingId, setSpeakingId] = useState<string | null>(null);

    const handleStart = async (exercise: Exercise) => {
        try {
            if (speakingId === exercise.id) {
                await stopSpeaking();
                setSpeakingId(null);
                return;
            }
            setSpeakingId(exercise.id);
            const text = `${exercise.title}. ${exercise.detail}. ${exercise.instructions.join(' ')}`;
            await speak(text, {
                rate: 0.9,
                pitch: 0.98,
                onDone: () => setSpeakingId(null),
                onError: () => setSpeakingId(null),
            });
        } catch (err) {
            setSpeakingId(null);
            Alert.alert('Voice unavailable', 'Unable to play instructions right now.');
        }
    };

    return (
        <LinearGradient colors={['#0a0a1a', '#0d1230', '#0a0a1a']} style={styles.gradient}>
            <SafeAreaView style={styles.safe}>
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Twin Training</Text>
                        <Text style={styles.headerSubtitle}>
                            Train with your AI twin to become your best version
                        </Text>
                    </View>

                    {/* Physical Exercises */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="barbell-outline" size={16} color="#7C9EFF" />
                            <Text style={styles.sectionTitle}>PHYSICAL EXERCISES</Text>
                        </View>
                        <View style={styles.cardList}>
                            {PHYSICAL_EXERCISES.map((exercise) => (
                                <ExerciseCard
                                    key={exercise.id}
                                    exercise={exercise}
                                    onStart={handleStart}
                                    isSpeaking={speakingId === exercise.id}
                                />
                            ))}
                        </View>
                        <Text style={styles.insightText}>
                            Your twin suggests a quick workout since you have been inactive for 2 hours.
                        </Text>
                    </View>

                    {/* Mental Fitness */}
                    <View style={styles.section}>
                        <View style={styles.sectionHeader}>
                            <Ionicons name="flash-outline" size={16} color="#a78bfa" />
                            <Text style={styles.sectionTitle}>MENTAL FITNESS</Text>
                        </View>
                        <View style={styles.cardList}>
                            {MENTAL_EXERCISES.map((exercise) => (
                                <ExerciseCard
                                    key={exercise.id}
                                    exercise={exercise}
                                    accent="purple"
                                    onStart={handleStart}
                                    isSpeaking={speakingId === exercise.id}
                                />
                            ))}
                        </View>
                        <Text style={styles.insightText}>
                            Your focus level is slightly low today. Try a short breathing session.
                        </Text>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </LinearGradient>
    );
}

function ExerciseCard({
    exercise,
    accent,
    onStart,
    isSpeaking,
}: {
    exercise: Exercise;
    accent?: 'purple';
    onStart: (exercise: Exercise) => void;
    isSpeaking: boolean;
}) {
    const isPurple = accent === 'purple';
    return (
        <View style={[styles.card, isPurple && styles.cardAlt]}>
            <View style={styles.cardLeft}>
                <View style={[styles.iconWrap, isPurple && styles.iconWrapAlt]}>
                    <Ionicons
                        name={exercise.icon}
                        size={18}
                        color={isPurple ? '#a78bfa' : '#7C9EFF'}
                    />
                </View>
                <View>
                    <Text style={styles.cardTitle}>{exercise.title}</Text>
                    <Text style={styles.cardDetail}>{exercise.detail}</Text>
                </View>
            </View>
            <TouchableOpacity
                style={[styles.startBtn, isPurple && styles.startBtnAlt]}
                activeOpacity={0.85}
                onPress={() => onStart(exercise)}
            >
                <Text style={[styles.startBtnText, isPurple && styles.startBtnTextAlt]}>
                    {isSpeaking ? 'Stop' : 'Start'}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safe: { flex: 1 },
    scroll: { paddingBottom: 110, paddingHorizontal: 20, paddingTop: 10 },
    header: { marginBottom: 22 },
    headerTitle: { fontSize: 24, fontWeight: '700', color: '#e8eeff', letterSpacing: -0.3 },
    headerSubtitle: { color: '#4a4a6a', fontSize: 13, marginTop: 6, lineHeight: 18 },
    section: { marginBottom: 26 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    sectionTitle: { color: '#7C9EFF', fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
    cardList: { gap: 10 },
    card: {
        backgroundColor: 'rgba(20,24,60,0.7)',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(124,158,255,0.12)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    cardAlt: { borderColor: 'rgba(167,139,250,0.18)', backgroundColor: 'rgba(20,24,60,0.75)' },
    cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconWrap: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(124,158,255,0.14)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(124,158,255,0.3)',
    },
    iconWrapAlt: { backgroundColor: 'rgba(167,139,250,0.15)', borderColor: 'rgba(167,139,250,0.3)' },
    cardTitle: { color: '#e8eeff', fontSize: 14, fontWeight: '700' },
    cardDetail: { color: '#4a4a6a', fontSize: 12, marginTop: 3 },
    startBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(124,158,255,0.2)',
        borderWidth: 1,
        borderColor: 'rgba(124,158,255,0.4)',
    },
    startBtnAlt: { backgroundColor: 'rgba(167,139,250,0.2)', borderColor: 'rgba(167,139,250,0.4)' },
    startBtnText: { color: '#7C9EFF', fontWeight: '700', fontSize: 12 },
    startBtnTextAlt: { color: '#a78bfa' },
    insightText: { color: '#8a9cc8', fontSize: 12.5, lineHeight: 18, marginTop: 10 },
});
