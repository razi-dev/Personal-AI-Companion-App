import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

export interface SpeechOptions {
    rate?: number;
    pitch?: number;
    language?: string;
    onStart?: () => void;
    onDone?: () => void;
    onError?: (error: string) => void;
}

const OPENAI_API_KEY = (
    process.env.EXPO_PUBLIC_OPENAI_API_KEY ??
    process.env.OPENAI_API_KEY ??
    ''
).trim();

let isSpeaking = false;
let activeRecording: Audio.Recording | null = null;

function hasConfiguredApiKey(): boolean {
    return !!OPENAI_API_KEY && OPENAI_API_KEY !== 'YOUR_OPENAI_API_KEY';
}

export async function speak(text: string, options: SpeechOptions = {}): Promise<void> {
    const {
        rate = 0.88,
        pitch = 0.95,
        language = 'en-US',
        onStart,
        onDone,
        onError,
    } = options;

    await stopSpeaking();

    isSpeaking = true;
    onStart?.();

    return new Promise((resolve) => {
        Speech.speak(text, {
            rate,
            pitch,
            language,
            onStart: () => {
                isSpeaking = true;
            },
            onDone: () => {
                isSpeaking = false;
                onDone?.();
                resolve();
            },
            onError: (err) => {
                isSpeaking = false;
                onError?.(String(err));
                resolve();
            },
            onStopped: () => {
                isSpeaking = false;
                resolve();
            },
        });
    });
}

export async function stopSpeaking(): Promise<void> {
    if (await Speech.isSpeakingAsync()) {
        await Speech.stop();
    }
    isSpeaking = false;
}

export function getIsSpeaking(): boolean {
    return isSpeaking;
}

export async function startVoiceCapture(): Promise<void> {
    const permission = await Audio.requestPermissionsAsync();
    if (permission.status !== 'granted') {
        throw new Error('Microphone permission is required for voice input.');
    }

    await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
    });

    if (activeRecording) {
        await stopVoiceCapture();
    }

    const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    activeRecording = recording;
}

export async function stopVoiceCapture(): Promise<string | null> {
    if (!activeRecording) {
        return null;
    }

    const recording = activeRecording;
    activeRecording = null;

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();

    await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
    });

    return uri;
}

export async function stopVoiceCaptureAndTranscribe(): Promise<string> {
    const uri = await stopVoiceCapture();
    if (!uri) {
        return '';
    }
    return transcribeAudio(uri);
}

async function transcribeAudio(uri: string): Promise<string> {
    if (!hasConfiguredApiKey()) {
        throw new Error('Missing API key. Please add EXPO_PUBLIC_OPENAI_API_KEY with a valid API key in your .env file to use voice features.');
    }

    const formData = new FormData();
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('file', {
        uri,
        name: `voice-${Date.now()}.m4a`,
        type: 'audio/m4a',
    } as any);

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
    });

    if (!response.ok) {
        throw new Error(`Voice transcription failed: ${response.status}`);
    }

    const data = await response.json();
    return (data?.text ?? '').trim();
}
