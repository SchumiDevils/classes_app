import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';

import { colors } from '@/components/ui';
import { esteTutore, useSession } from '@/lib/ctx';

function TabIcon({ icon, color }: { icon: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{icon}</Text>;
}

export default function AppLayout() {
  const { profile } = useSession();
  const tutore = esteTutore(profile?.rol);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: tutore ? 'Elevii mei' : 'Elevi',
          tabBarIcon: ({ color }) => <TabIcon icon="👥" color={color} />,
        }}
      />
      <Tabs.Screen
        name="lectii"
        options={{
          title: 'Lecții',
          href: tutore ? null : '/lectii',
          tabBarIcon: ({ color }) => <TabIcon icon="📅" color={color} />,
        }}
      />
      <Tabs.Screen
        name="plati"
        options={{
          title: tutore ? 'Achitări' : 'Plăți',
          tabBarIcon: ({ color }) => <TabIcon icon="💳" color={color} />,
        }}
      />
      <Tabs.Screen
        name="setari"
        options={{ title: 'Setări', tabBarIcon: ({ color }) => <TabIcon icon="⚙️" color={color} /> }}
      />

      {/* Rute ascunse din bara de tab-uri */}
      <Tabs.Screen name="student/[id]" options={{ href: null, title: 'Fișă elev' }} />
      <Tabs.Screen name="elev-nou" options={{ href: null, title: 'Elev nou' }} />
      <Tabs.Screen name="lectie/[id]" options={{ href: null, title: 'Lecție' }} />
      <Tabs.Screen name="invite" options={{ href: null, title: 'Invită utilizator' }} />
      <Tabs.Screen name="grupe" options={{ href: null, title: 'Grupe & orar' }} />
      <Tabs.Screen name="grupa/[id]" options={{ href: null, title: 'Grupă' }} />
    </Tabs>
  );
}
