import React, { useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Animated,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VoiceInputProps {
    onSubmit: (text: string) => void;
    isLoading?: boolean;
    transcript?: string;
    isListening?: boolean;
    onStartListening: () => void;
    onStopListening: () => void;
}

export default function VoiceInput({
    onSubmit,
    isLoading = false,
    transcript = '',
    isListening = false,
    onStartListening,
    onStopListening,
}: VoiceInputProps) {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const ringAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isListening) {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.18, duration: 700, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
                ])
            ).start();
            Animated.loop(
                Animated.timing(ringAnim, { toValue: 1, duration: 1200, useNativeDriver: true })
            ).start();
        } else {
            pulseAnim.stopAnimation();
            ringAnim.stopAnimation();
            Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true }).start();
        }
    }, [isListening]);

    const ringOpacity = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });
    const ringScale = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });

    return (
        <View style={styles.container}>
            {/* Transcript preview */}
            {(isListening || transcript) ? (
                <View style={styles.transcriptBox}>
                    <Text style={styles.transcriptText} numberOfLines={2}>
                        {isListening && !transcript ? '🎙 Listening...' : transcript}
                    </Text>
                </View>
            ) : null}

            {/* Mic button */}
            <View style={styles.micRow}>
                <TouchableOpacity
                    style={styles.micWrapper}
                    onPress={isListening ? onStopListening : onStartListening}
                    disabled={isLoading}
                    activeOpacity={0.8}
                >
                    {/* Ripple ring */}
                    <Animated.View
                        style={[
                            styles.ring,
                            {
                                opacity: ringOpacity,
                                transform: [{ scale: ringScale }],
                            },
                        ]}
                    />

                    {/* Button */}
                    <Animated.View
                        style={[
                            styles.micButton,
                            isListening && styles.micButtonActive,
                            { transform: [{ scale: pulseAnim }] },
                        ]}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#fff" size="small" />
                        ) : (
                            <Ionicons
                                name={isListening ? 'stop' : 'mic'}
                                size={28}
                                color={isListening ? '#ff6b6b' : '#fff'}
                            />
                        )}
                    </Animated.View>
                </TouchableOpacity>

                {/* Send transcript button */}
                {transcript && !isListening && (
                    <TouchableOpacity
                        style={styles.sendButton}
                        onPress={() => onSubmit(transcript)}
                        disabled={isLoading}
                    >
                        <Ionicons name="arrow-up" size={20} color="#0a0a1a" />
                    </TouchableOpacity>
                )}
            </View>

            <Text style={styles.hint}>
                {isListening ? 'Tap to stop' : 'Tap mic to speak'}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingBottom: 12,
    },
    transcriptBox: {
        backgroundColor: 'rgba(124, 158, 255, 0.1)',
        borderRadius: 16,
        paddingHorizontal: 18,
        paddingVertical: 10,
        marginBottom: 16,
        maxWidth: '90%',
        borderWidth: 1,
        borderColor: 'rgba(124, 158, 255, 0.25)',
    },
    transcriptText: {
        color: '#c8d8ff',
        fontSize: 14,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    micRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    micWrapper: {
        width: 72,
        height: 72,
        alignItems: 'center',
        justifyContent: 'center',
    },
    ring: {
        position: 'absolute',
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 2,
        borderColor: '#7C9EFF',
        backgroundColor: 'transparent',
    },
    micButton: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#1e2a5e',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(124, 158, 255, 0.5)',
        shadowColor: '#7C9EFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
        elevation: 8,
    },
    micButtonActive: {
        backgroundColor: '#2d1a3e',
        borderColor: '#ff6b6b',
        shadowColor: '#ff6b6b',
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#7C9EFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    hint: {
        color: '#4a4a6a',
        fontSize: 12,
        marginTop: 8,
        letterSpacing: 0.5,
    },
});
