import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Message } from '../types';

interface ChatBubbleProps {
    message: Message;
}

export default function ChatBubble({ message }: ChatBubbleProps) {
    const isUser = message.role === 'user';
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(isUser ? 20 : -20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
            Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
        ]).start();
    }, []);

    const timestamp = new Date(message.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <Animated.View
            style={[
                styles.wrapper,
                isUser ? styles.userWrapper : styles.assistantWrapper,
                { opacity: fadeAnim, transform: [{ translateX: slideAnim }] },
            ]}
        >
            {!isUser && (
                <View style={styles.avatarDot}>
                    <View style={styles.avatarDotInner} />
                </View>
            )}

            <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
                {message.isVoice && (
                    <Text style={styles.voiceTag}>🎙️ Voice</Text>
                )}
                <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
                    {message.content}
                </Text>
                <Text style={styles.timestamp}>{timestamp}</Text>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        marginVertical: 5,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'flex-end',
        maxWidth: '100%',
    },
    userWrapper: {
        justifyContent: 'flex-end',
    },
    assistantWrapper: {
        justifyContent: 'flex-start',
    },
    avatarDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(124, 158, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        borderWidth: 1.5,
        borderColor: 'rgba(124, 158, 255, 0.4)',
    },
    avatarDotInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#7C9EFF',
    },
    bubble: {
        maxWidth: '80%',
        borderRadius: 18,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    userBubble: {
        backgroundColor: '#1e2a5e',
        borderBottomRightRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(124, 158, 255, 0.2)',
    },
    assistantBubble: {
        backgroundColor: 'rgba(20, 20, 50, 0.85)',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: 'rgba(124, 158, 255, 0.15)',
    },
    voiceTag: {
        fontSize: 10,
        color: '#7C9EFF',
        marginBottom: 4,
        opacity: 0.8,
    },
    messageText: {
        fontSize: 14.5,
        lineHeight: 21,
        letterSpacing: 0.2,
    },
    userText: {
        color: '#e8eeff',
    },
    assistantText: {
        color: '#c8d8ff',
    },
    timestamp: {
        fontSize: 10,
        color: '#4a4a6a',
        marginTop: 5,
        alignSelf: 'flex-end',
    },
});
