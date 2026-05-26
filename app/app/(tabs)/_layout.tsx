import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Image, useColorScheme } from 'react-native';

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Ophest Dual-Theme styling configurations
  const canvas         = isDark ? '#15202b' : '#f0edee'; // soft warm grey canvas / X.com Dim canvas
  const headerBgColor  = isDark ? '#15202b' : '#f0edee'; // matches canvas so header is flush
  const borderBottomColor = 'transparent';               // no visible header border
  const headerTextColor = isDark ? '#ffffff' : '#1a1718';
  const tabBgColor     = isDark ? '#313b44' : '#ffffff'; // white tab bar / X.com Dim card matched tab bar
  const activeColor    = isDark ? '#ffffff' : '#1a1718';
  const inactiveColor  = isDark ? '#8899a6' : '#7a7577';

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: headerBgColor,
          borderBottomWidth: 1,
          borderBottomColor: borderBottomColor,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: headerTextColor,
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 20,
        },
        tabBarStyle: {
          backgroundColor: tabBgColor,
          borderTopWidth: 1,
          borderTopColor: borderBottomColor,
          height: Platform.OS === 'ios' ? 92 : 70,
          paddingBottom: Platform.OS === 'ios' ? 32 : 12,
          paddingTop: 11,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Logs',
          tabBarLabel: 'Logs',
          headerShown: false,   // Custom header is built inside index.tsx
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'reader' : 'reader-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ci"
        options={{
          title: 'CI Board',
          tabBarLabel: 'CI Board',
          headerTitle: 'CI Board',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'clipboard' : 'clipboard-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarLabel: 'Explore',
          headerTitle: 'Explore',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'compass' : 'compass-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
