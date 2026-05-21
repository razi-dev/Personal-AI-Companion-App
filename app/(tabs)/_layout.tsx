import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

export default function TabsLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: styles.tabBar,
                tabBarActiveTintColor: '#7C9EFF',
                tabBarInactiveTintColor: '#4a4a6a',
                tabBarBackground: () => (
                    <View style={styles.tabBarBackground} />
                ),
                tabBarLabelStyle: styles.tabBarLabel,
                tabBarHideOnKeyboard: true,
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Twin',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="person-circle-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="chat"
                options={{
                    title: 'Chat',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="chatbubble-ellipses-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="log"
                options={{
                    title: 'Log',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="journal-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="habits"
                options={{
                    title: 'Habits',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="repeat-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="training"
                options={{
                    title: 'Training',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="barbell-outline" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="journal"
                options={{
                    title: 'Journal',
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="book-outline" size={size} color={color} />
                    ),
                }}
            />
            {/* Hidden from tab bar but accessible via navigation */}
            <Tabs.Screen
                name="insights"
                options={{
                    title: 'Insights',
                    href: null,
                }}
            />
            <Tabs.Screen
                name="review"
                options={{
                    title: 'Review',
                    href: null,
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        position: 'absolute',
        elevation: 0,
        height: 75,
        paddingBottom: 14,
        paddingTop: 8,
        backgroundColor: 'rgba(12, 12, 30, 0.97)',
        borderTopColor: 'rgba(124, 158, 255, 0.15)',
        borderTopWidth: 1,
    },
    tabBarBackground: {
        flex: 1,
        backgroundColor: 'rgba(10, 10, 26, 0.98)',
    },
    tabBarLabel: {
        fontSize: 10,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
});
