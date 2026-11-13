// Four bottom tabs: Home, Map, AI, Profile. Same blue-black bar on every page; orange marks the selected tab.
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/ui/Icon';
import { colors, TAB_BAR_HEIGHT } from '@/ui/theme';

/** One tab: thin-line icon above a short label. */
function tab(name: string, title: string, icon: IconName) {
  return (
    <Tabs.Screen
      name={name}
      options={{
        title,
        tabBarIcon: ({ color }) => <Icon name={icon} size={22} color={color} />,
        tabBarButtonTestID: `tab-${name}`,
      }}
    />
  );
}

/** Tab navigator with the design's bottom bar (64 px + safe area, hairline top border). */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: colors.orange,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: 2 },
        tabBarStyle: {
          backgroundColor: '#0D0E20',
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      }}
    >
      {tab('index', 'Home', 'home-outline')}
      {tab('map', 'Map', 'map-outline')}
      {tab('ai', 'AI', 'chatbubble-ellipses-outline')}
      {tab('profile', 'Profile', 'person-outline')}
    </Tabs>
  );
}
