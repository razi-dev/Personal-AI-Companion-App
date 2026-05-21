import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ChatBubble from '../../components/ChatBubble';
import { Message } from '../../types';
import { getAllMessages, getRecentEntries, saveMessage } from '../../services/memoryService';
import { formatAIResponseForChat, getAIDecision } from '../../services/aiService';
import { speak, startVoiceCapture, stopSpeaking, stopVoiceCaptureAndTranscribe } from '../../services/voiceService';
import { refreshBehaviorEngine } from '../../services/behaviorEngine';
import { getProfile } from '../../services/profileService';
import { getHabitsWithStats } from '../../services/habitService';
import { getRecentJournalEntries } from '../../services/journalService';
import { computeBehaviorInsights } from '../../utils/patternAnalysis';

export default function ChatScreen() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [isKeyboardVisible, setKeyboardVisible] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        loadMessages();

        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
        const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, []);

    const loadMessages = async () => {
        const stored = await getAllMessages();
        if (stored.length === 0) {
            const welcome: Message = {
                id: 'welcome',
                role: 'assistant',
                content: "Hello. I'm your Digital Twin, a calm advisor that learns from your daily patterns.\n\nTell me what is on your mind, or ask me to help you decide something.",
                timestamp: new Date().toISOString(),
            };
            setMessages([welcome]);
            return;
        }
        setMessages(stored);
    };

    const scrollToBottom = useCallback(() => {
        setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }, []);

    const sendMessage = async (text: string, isVoice = false) => {
        if (!text.trim() || isLoading) return;

        Keyboard.dismiss();
        setInputText('');
        setTranscript('');

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: text.trim(),
            timestamp: new Date().toISOString(),
            isVoice,
        };

        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        await saveMessage(userMsg);
        scrollToBottom();
        setIsLoading(true);

        try {
            const [recentEntries, allMessages, profile, habits, journals] = await Promise.all([
                getRecentEntries(30),
                getAllMessages(),
                getProfile(),
                getHabitsWithStats(),
                getRecentJournalEntries(14),
            ]);
            const behaviorInsights = computeBehaviorInsights(recentEntries, allMessages);

            const aiResponse = await getAIDecision(
                text.trim(),
                recentEntries,
                newMessages.slice(-8),
                profile ?? undefined,
                habits,
                journals,
                behaviorInsights,
            );
            const aiText = formatAIResponseForChat(aiResponse);

            const assistantMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: aiText,
                timestamp: new Date().toISOString(),
            };

            setMessages((prev) => [...prev, assistantMsg]);
            await saveMessage(assistantMsg);
            await refreshBehaviorEngine();
            scrollToBottom();

            setIsSpeaking(true);
            await speak(aiText, {
                onDone: () => setIsSpeaking(false),
                onError: () => setIsSpeaking(false),
            });
        } catch {
            Alert.alert('Error', 'Could not get a response. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleStopSpeaking = async () => {
        await stopSpeaking();
        setIsSpeaking(false);
    };

    const handleStartListening = async () => {
        if (isLoading || isListening || isTranscribing) return;

        try {
            Keyboard.dismiss();
            setTranscript('');
            await startVoiceCapture();
            setIsListening(true);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Could not start voice recording.';
            Alert.alert('Voice Input Error', message);
            setIsListening(false);
        }
    };

    const handleStopListening = async () => {
        if (!isListening) return;
        setIsListening(false);
        setIsTranscribing(true);

        try {
            const text = await stopVoiceCaptureAndTranscribe();
            setTranscript(text);

            if (!text.trim()) {
                Alert.alert('No speech detected', 'Try again and speak clearly into your microphone.');
                return;
            }

            await sendMessage(text, true);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Voice transcription failed.';
            Alert.alert('Voice Input Error', message);
        } finally {
            setIsTranscribing(false);
        }
    };

    const renderItem = useCallback(({ item }: { item: Message }) => <ChatBubble message={item} />, []);

    const statusText = isSpeaking
        ? 'Speaking...'
        : isListening
            ? 'Listening...'
            : isTranscribing
                ? 'Transcribing...'
                : isLoading
                    ? 'Thinking...'
                    : 'Online';

    return (
        <LinearGradient colors={['#0a0a1a', '#0d1230', '#0a0a1a']} style={styles.gradient}>
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <View style={styles.avatarRow}>
                        <View style={styles.chatAvatarFallback}>
                            <Ionicons name="person-circle-outline" size={56} color="#7C9EFF" />
                        </View>
                        <View style={styles.headerText}>
                            <Text style={styles.headerTitle}>Digital Twin</Text>
                            <Text style={styles.headerStatus}>{statusText}</Text>
                        </View>
                        {isSpeaking && (
                            <TouchableOpacity onPress={handleStopSpeaking} style={styles.stopBtn}>
                                <Ionicons name="stop-circle-outline" size={22} color="#ff6b6b" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
                >
                    <FlatList
                        ref={flatListRef}
                        data={messages}
                        renderItem={renderItem}
                        keyExtractor={(item) => item.id}
                        style={{ flex: 1 }}
                        contentContainerStyle={styles.messagesList}
                        onContentSizeChange={scrollToBottom}
                        showsVerticalScrollIndicator={false}
                    />

                    <View style={styles.inputArea}>
                        <View style={styles.textRow}>
                            <TouchableOpacity
                                style={[styles.micButton, isListening && styles.micButtonActive]}
                                onPress={isListening ? handleStopListening : handleStartListening}
                                disabled={isLoading || isTranscribing}
                            >
                                <Ionicons
                                    name={isListening ? 'stop' : 'mic-outline'}
                                    size={18}
                                    color={isListening ? '#ff6b6b' : '#7C9EFF'}
                                />
                            </TouchableOpacity>

                            <TextInput
                                style={styles.textInput}
                                value={inputText}
                                onChangeText={setInputText}
                                placeholder="Type a message..."
                                placeholderTextColor="#3a3a5a"
                                multiline={false}
                                maxLength={500}
                                returnKeyType="send"
                                editable={!isLoading && !isTranscribing}
                                onSubmitEditing={() => sendMessage(inputText)}
                            />

                            <TouchableOpacity
                                style={[styles.sendBtn, (!inputText.trim() || isLoading || isTranscribing) && styles.sendBtnDisabled]}
                                onPress={() => sendMessage(inputText)}
                                disabled={!inputText.trim() || isLoading || isTranscribing}
                            >
                                <Ionicons
                                    name="arrow-up"
                                    size={18}
                                    color={inputText.trim() && !isLoading && !isTranscribing ? '#0a0a1a' : '#3a3a5a'}
                                />
                            </TouchableOpacity>
                        </View>

                        {(isListening || isTranscribing || transcript) ? (
                            <View style={styles.voiceHintRow}>
                                <Text style={styles.voiceHintText} numberOfLines={2}>
                                    {isListening ? 'Listening...' : isTranscribing ? 'Transcribing...' : `Voice captured: ${transcript}`}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                    {!isKeyboardVisible && <View style={{ height: 75 }} />}
                </KeyboardAvoidingView>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safe: { flex: 1 },
    header: {
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(124,158,255,0.1)',
    },
    avatarRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerText: {
        marginLeft: 12,
        flex: 1,
    },
    headerTitle: {
        color: '#e8eeff',
        fontSize: 17,
        fontWeight: '700',
    },
    headerStatus: {
        color: '#4a4a6a',
        fontSize: 12,
        marginTop: 2,
    },
    stopBtn: {
        padding: 6,
    },
    messagesList: {
        paddingTop: 12,
        paddingBottom: 12,
    },
    inputArea: {
        paddingHorizontal: 12,
        paddingTop: 10,
        paddingBottom: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(124,158,255,0.1)',
        backgroundColor: 'rgba(10,10,26,0.97)',
    },
    textRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    micButton: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(124,158,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(124,158,255,0.2)',
    },
    micButtonActive: {
        borderColor: 'rgba(255,107,107,0.5)',
        backgroundColor: 'rgba(255,107,107,0.08)',
    },
    textInput: {
        flex: 1,
        backgroundColor: 'rgba(20,24,60,0.8)',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        color: '#e8eeff',
        fontSize: 14,
        maxHeight: 100,
        borderWidth: 1,
        borderColor: 'rgba(124,158,255,0.15)',
    },
    sendBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#7C9EFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendBtnDisabled: {
        backgroundColor: 'rgba(20,24,60,0.8)',
    },
    voiceHintRow: {
        marginTop: 8,
        paddingHorizontal: 12,
    },
    voiceHintText: {
        color: '#7C9EFF',
        fontSize: 12,
    },
    chatAvatarFallback: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(124,158,255,0.1)',
        borderWidth: 1,
        borderColor: 'rgba(124,158,255,0.2)',
    },
});

