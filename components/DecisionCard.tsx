import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AIResponse } from '../types';

interface DecisionCardProps {
    response: AIResponse;
}

export default function DecisionCard({ response }: DecisionCardProps) {
    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <View style={styles.indicator} />
                <Text style={styles.headerText}>Decision Analysis</Text>
            </View>

            <Text style={styles.adviceText}>{response.advice}</Text>

            {response.patternInsight && (
                <View style={styles.insightBox}>
                    <Text style={styles.insightLabel}>Pattern Detected</Text>
                    <Text style={styles.insightText}>{response.patternInsight}</Text>
                </View>
            )}

            <View style={styles.actionBox}>
                <Text style={styles.actionLabel}>→ Suggested Action</Text>
                <Text style={styles.actionText}>{response.suggestedAction}</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: 'rgba(20, 24, 60, 0.95)',
        borderRadius: 20,
        padding: 18,
        marginHorizontal: 16,
        borderWidth: 1,
        borderColor: 'rgba(124, 158, 255, 0.2)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    indicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#7C9EFF',
        marginRight: 8,
    },
    headerText: {
        color: '#7C9EFF',
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    adviceText: {
        color: '#c8d8ff',
        fontSize: 14,
        lineHeight: 22,
        marginBottom: 14,
    },
    insightBox: {
        backgroundColor: 'rgba(124, 158, 255, 0.08)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#a78bfa',
    },
    insightLabel: {
        color: '#a78bfa',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    insightText: {
        color: '#c8d8ff',
        fontSize: 13,
        lineHeight: 20,
    },
    actionBox: {
        backgroundColor: 'rgba(124, 158, 255, 0.12)',
        borderRadius: 12,
        padding: 12,
        borderLeftWidth: 3,
        borderLeftColor: '#7C9EFF',
    },
    actionLabel: {
        color: '#7C9EFF',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    actionText: {
        color: '#e8eeff',
        fontSize: 14,
        fontWeight: '600',
        lineHeight: 20,
    },
});
