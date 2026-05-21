import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withDelay,
    Easing,
    interpolate,
    cancelAnimation,
    withSequence,
} from 'react-native-reanimated';
import Svg, {
    Circle,
    Ellipse,
    Path,
    Defs,
    RadialGradient,
    Stop,
    LinearGradient,
} from 'react-native-svg';

interface AvatarProps {
    isSpeaking: boolean;
    isListening?: boolean;
    size?: number;
}

export default function Avatar({ isSpeaking, isListening = false, size = 180 }: AvatarProps) {
    // Breathing animation
    const breathScale = useSharedValue(1);
    // Lip sync animation (mouth openness)
    const mouthOpen = useSharedValue(0);
    // Glow pulse
    const glowOpacity = useSharedValue(0.3);
    // Eye blink
    const eyeBlink = useSharedValue(1);
    // Float up/down
    const floatY = useSharedValue(0);

    // ── Breathing ──────────────────────────────────────────────────────────────
    useEffect(() => {
        breathScale.value = withRepeat(
            withTiming(1.025, { duration: 3600, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
        floatY.value = withRepeat(
            withTiming(-6, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, []);

    // ── Eye blink ──────────────────────────────────────────────────────────────
    useEffect(() => {
        const blinkLoop = () => {
            eyeBlink.value = withSequence(
                withDelay(3000 + Math.random() * 2000, withTiming(0.05, { duration: 80 })),
                withTiming(1, { duration: 100 })
            );
        };
        const interval = setInterval(blinkLoop, 4000);
        return () => clearInterval(interval);
    }, []);

    // ── Lip sync (speaking) ───────────────────────────────────────────────────
    useEffect(() => {
        if (isSpeaking) {
            mouthOpen.value = withRepeat(
                withSequence(
                    withTiming(1, { duration: 150, easing: Easing.out(Easing.ease) }),
                    withTiming(0.3, { duration: 120, easing: Easing.in(Easing.ease) }),
                    withTiming(0.85, { duration: 130, easing: Easing.out(Easing.ease) }),
                    withTiming(0.1, { duration: 100, easing: Easing.in(Easing.ease) })
                ),
                -1,
                false
            );
            glowOpacity.value = withRepeat(
                withTiming(0.9, { duration: 600, easing: Easing.inOut(Easing.ease) }),
                -1,
                true
            );
        } else {
            cancelAnimation(mouthOpen);
            mouthOpen.value = withTiming(0, { duration: 250 });
            glowOpacity.value = isListening
                ? withRepeat(withTiming(0.7, { duration: 400 }), -1, true)
                : withTiming(0.3, { duration: 500 });
        }
    }, [isSpeaking, isListening]);

    // ── Animated styles ────────────────────────────────────────────────────────
    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ scale: breathScale.value }, { translateY: floatY.value }],
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
    }));

    const s = size;
    const cx = s / 2;
    const cy = s / 2;
    const faceR = s * 0.38;

    // Derived mouth path animation
    const mouthY = cy + faceR * 0.35;
    const mouthW = faceR * 0.45;

    return (
        <View style={[styles.wrapper, { width: s, height: s }]}>
            {/* Glow ring */}
            <Animated.View style={[styles.glow, { width: s * 1.2, height: s * 1.2, borderRadius: s * 0.6, top: -s * 0.1, left: -s * 0.1 }, glowStyle]} />

            {/* Main avatar */}
            <Animated.View style={[styles.avatarContainer, { width: s, height: s }, containerStyle]}>
                <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
                    <Defs>
                        <RadialGradient id="faceGrad" cx="50%" cy="40%" r="55%">
                            <Stop offset="0%" stopColor="#1e2a5e" />
                            <Stop offset="100%" stopColor="#0d1230" />
                        </RadialGradient>
                        <RadialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
                            <Stop offset="0%" stopColor="#4f72ff" stopOpacity="0.4" />
                            <Stop offset="100%" stopColor="#7C9EFF" stopOpacity="0" />
                        </RadialGradient>
                        <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <Stop offset="0%" stopColor="#7C9EFF" />
                            <Stop offset="50%" stopColor="#a78bfa" />
                            <Stop offset="100%" stopColor="#60a5fa" />
                        </LinearGradient>
                    </Defs>

                    {/* Outer ring */}
                    <Circle
                        cx={cx}
                        cy={cy}
                        r={faceR + 14}
                        fill="none"
                        stroke="url(#ringGrad)"
                        strokeWidth={1.5}
                        strokeDasharray="4 8"
                        opacity={0.7}
                    />

                    {/* Face base */}
                    <Circle cx={cx} cy={cy} r={faceR} fill="url(#faceGrad)" />

                    {/* Face highlight */}
                    <Ellipse
                        cx={cx - faceR * 0.1}
                        cy={cy - faceR * 0.25}
                        rx={faceR * 0.55}
                        ry={faceR * 0.35}
                        fill="rgba(255,255,255,0.04)"
                    />

                    {/* Eyes */}
                    <AnimatedEye
                        cx={cx - faceR * 0.28}
                        cy={cy - faceR * 0.1}
                        eyeBlink={eyeBlink}
                        isSpeaking={isSpeaking}
                    />
                    <AnimatedEye
                        cx={cx + faceR * 0.28}
                        cy={cy - faceR * 0.1}
                        eyeBlink={eyeBlink}
                        isSpeaking={isSpeaking}
                    />

                    {/* Mouth */}
                    <AnimatedMouth
                        cx={cx}
                        cy={mouthY}
                        width={mouthW}
                        mouthOpen={mouthOpen}
                    />

                    {/* Neural dots decoration */}
                    {[...Array(6)].map((_, i) => {
                        const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
                        const dotR = faceR * 0.88;
                        const dx = cx + Math.cos(angle) * dotR;
                        const dy = cy + Math.sin(angle) * dotR;
                        return (
                            <Circle
                                key={i}
                                cx={dx}
                                cy={dy}
                                r={2.5}
                                fill="#7C9EFF"
                                opacity={0.5}
                            />
                        );
                    })}
                </Svg>
            </Animated.View>
        </View>
    );
}

// ── Eye sub-component ──────────────────────────────────────────────────────────
function AnimatedEye({
    cx,
    cy,
    eyeBlink,
    isSpeaking,
}: {
    cx: number;
    cy: number;
    eyeBlink: Animated.SharedValue<number>;
    isSpeaking: boolean;
}) {
    const eyeStyle = useAnimatedStyle(() => ({
        transform: [{ scaleY: eyeBlink.value }],
    }));

    return (
        <Animated.View
            style={[
                {
                    position: 'absolute',
                    left: cx - 8,
                    top: cy - 8,
                    width: 16,
                    height: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                },
                eyeStyle,
            ]}
        >
            <Svg width={16} height={16}>
                <Defs>
                    <RadialGradient id={`eyeGrad${cx}`} cx="35%" cy="35%" r="60%">
                        <Stop offset="0%" stopColor="#a0c4ff" />
                        <Stop offset="100%" stopColor="#4f72ff" />
                    </RadialGradient>
                </Defs>
                <Ellipse cx={8} cy={8} rx={7} ry={isSpeaking ? 6.5 : 7} fill={`url(#eyeGrad${cx})`} />
                <Circle cx={8} cy={8} r={4} fill="#1a2040" />
                <Circle cx={9.5} cy={6.5} r={1.5} fill="white" opacity={0.8} />
                {isSpeaking && (
                    <Circle cx={8} cy={8} r={7} fill="none" stroke="#7C9EFF" strokeWidth={1} opacity={0.5} />
                )}
            </Svg>
        </Animated.View>
    );
}

// ── Mouth sub-component ────────────────────────────────────────────────────────
function AnimatedMouth({
    cx,
    cy,
    width,
    mouthOpen,
}: {
    cx: number;
    cy: number;
    width: number;
    mouthOpen: Animated.SharedValue<number>;
}) {
    // We use a View with border-radius to simulate mouth
    const mouthStyle = useAnimatedStyle(() => {
        const openAmount = interpolate(mouthOpen.value, [0, 1], [2, 10]);
        const mouthWidth = interpolate(mouthOpen.value, [0, 1], [width * 0.6, width]);
        return {
            height: openAmount,
            width: mouthWidth,
            borderRadius: openAmount / 2,
        };
    });

    return (
        <Animated.View
            style={[
                {
                    position: 'absolute',
                    left: cx - width / 2,
                    top: cy - 5,
                    backgroundColor: '#4f72ff',
                    opacity: 0.85,
                },
                mouthStyle,
            ]}
        />
    );
}

const styles = StyleSheet.create({
    wrapper: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    glow: {
        position: 'absolute',
        backgroundColor: 'transparent',
        shadowColor: '#7C9EFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 1,
        shadowRadius: 40,
        elevation: 20,
        borderWidth: 1,
        borderColor: 'rgba(124, 158, 255, 0.15)',
    },
    avatarContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
