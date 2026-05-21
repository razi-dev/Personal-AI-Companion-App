import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AvatarViewer from '../components/AvatarViewer';

const TOTAL_TASKS = 10;

export default function AvatarScreen() {
  const [completedTasks, setCompletedTasks] = useState(0);

  const progress = useMemo(() => {
    if (TOTAL_TASKS <= 0) return 0;
    const ratio = completedTasks / TOTAL_TASKS;
    return Math.min(100, Math.max(0, ratio * 100));
  }, [completedTasks]);

  const mood = progress >= 80 ? 'Happy' : progress >= 40 ? 'Idle' : 'Sad';

  const increment = () =>
    setCompletedTasks((prev) => Math.min(TOTAL_TASKS, prev + 1));
  const decrement = () =>
    setCompletedTasks((prev) => Math.max(0, prev - 1));
  const reset = () => setCompletedTasks(0);
  const completeAll = () => setCompletedTasks(TOTAL_TASKS);

  return (
    <LinearGradient colors={['#0a0a1a', '#0d1230', '#0a0a1a']} style={styles.gradient}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>Avatar Progress Demo</Text>
          <Text style={styles.subtitle}>Task completion drives emotion</Text>

          <View style={styles.avatarCard}>
            <AvatarViewer
              localAsset={require('../assets/model.glb')}
              size={220}
              progress={progress}
            />
            <View style={styles.moodRow}>
              <Text style={styles.moodLabel}>Mood</Text>
              <Text style={styles.moodValue}>{mood}</Text>
            </View>
          </View>

          <View style={styles.progressCard}>
            <Text style={styles.progressValue}>{Math.round(progress)}%</Text>
            <Text style={styles.progressMeta}>
              {completedTasks}/{TOTAL_TASKS} tasks completed
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress)}%` }]} />
            </View>
          </View>

          <View style={styles.buttonRow}>
            <ActionButton
              label="Complete Task"
              onPress={increment}
              disabled={completedTasks >= TOTAL_TASKS}
            />
            <ActionButton
              label="Undo Task"
              onPress={decrement}
              disabled={completedTasks <= 0}
              variant="ghost"
            />
          </View>
          <View style={styles.buttonRow}>
            <ActionButton label="Complete All" onPress={completeAll} />
            <ActionButton label="Reset" onPress={reset} variant="ghost" />
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function ActionButton({ label, onPress, disabled = false, variant = 'solid' }) {
  const isGhost = variant === 'ghost';
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      disabled={disabled}
      style={[
        styles.button,
        isGhost && styles.buttonGhost,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text style={[styles.buttonText, isGhost && styles.buttonTextGhost]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safe: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#e8eeff',
  },
  subtitle: {
    fontSize: 12,
    color: '#8a9cc8',
    marginTop: 4,
  },
  avatarCard: {
    marginTop: 24,
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(20,24,60,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(124,158,255,0.18)',
  },
  moodRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  moodLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#7C9EFF',
    fontWeight: '700',
  },
  moodValue: {
    fontSize: 12,
    color: '#c8d8ff',
    fontWeight: '600',
  },
  progressCard: {
    marginTop: 18,
    width: '100%',
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(20,24,60,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(124,158,255,0.12)',
  },
  progressValue: {
    fontSize: 26,
    color: '#7C9EFF',
    fontWeight: '800',
  },
  progressMeta: {
    fontSize: 12,
    color: '#8a9cc8',
    marginTop: 4,
  },
  progressTrack: {
    height: 10,
    backgroundColor: 'rgba(124,158,255,0.1)',
    borderRadius: 999,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7C9EFF',
  },
  buttonRow: {
    marginTop: 14,
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(124,158,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(124,158,255,0.35)',
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(124,158,255,0.25)',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#c8d8ff',
    fontWeight: '600',
    fontSize: 12,
  },
  buttonTextGhost: {
    color: '#7C9EFF',
  },
});
