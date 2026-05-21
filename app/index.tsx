import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getSupabaseClient, isSupabaseConfigured } from '../services/supabaseClient';

export default function Root() {
    const router = useRouter();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        let isMounted = true;

        const resolveEntryRoute = async () => {
            try {
                if (!isSupabaseConfigured()) {
                    router.replace('/(tabs)' as any);
                    return;
                }

                const supabase = getSupabaseClient();
                if (!supabase) {
                    router.replace('/auth' as any);
                    return;
                }

                const { data, error } = await supabase.auth.getSession();
                const hasSession = !error && !!data.session;
                router.replace((hasSession ? '/(tabs)' : '/auth') as any);
            } finally {
                if (isMounted) setChecking(false);
            }
        };

        resolveEntryRoute();

        return () => {
            isMounted = false;
        };
    }, [router]);

    if (checking) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a1a' }}>
                <ActivityIndicator color="#7C9EFF" size="large" />
            </View>
        );
    }

    return null;
}
