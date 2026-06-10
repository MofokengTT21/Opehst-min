import { Tabs } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { Home, Copy, MessageCircle, Bell } from 'lucide-react-native';
import { Platform, useColorScheme, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
// Custom Home Icon that matches Lucide's rounded shape but properly hollows out the door when solid-filled
const RoundedHomeIcon = ({ focused, color, size = 24 }: { focused: boolean, color: string, size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={focused ? color : 'none'} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <Path 
      fillRule="evenodd"
      clipRule="evenodd"
      d={focused 
        ? "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10z" // Closed door path so fill-rule punches it out
        : "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10"   // Open door path so the stroke looks exactly like Lucide
      } 
    />
  </Svg>
);

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Ophest Dual-Theme styling configurations
  const canvas         = isDark ? '#15202b' : '#f2f2f7'; 
  const headerBgColor  = isDark ? '#15202b' : '#f2f2f7'; 
  const borderBottomColor = 'transparent';               
  const headerTextColor = isDark ? '#ffffff' : '#1a1718';
  const tabBgColor     = isDark ? '#15202b' : '#ffffff'; 
  const tabBorderColor = isDark ? '#253341' : '#e8e4e5'; 
  const activeColor    = isDark ? '#880034' : '#780532';
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
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderTopWidth: 0.5,
          borderLeftWidth: 0,
          borderRightWidth: 0,
          borderColor: tabBorderColor,
          height: Platform.OS === 'ios' ? 92 : 72,
          paddingBottom: Platform.OS === 'ios' ? 32 : 14,
          paddingTop: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: isDark ? 0.4 : 0.1,
          shadowRadius: 16,
          elevation: 24,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
        },
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarButton: (props) => (
          <TouchableOpacity {...props} activeOpacity={0.7} />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          headerShown: false,   // Custom header is built inside index.tsx
          tabBarIcon: ({ color, focused }) => (
            <RoundedHomeIcon focused={focused} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="updates"
        options={{
          title: 'Updates',
          tabBarLabel: 'Updates',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons name={focused ? 'cards' : 'cards-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarLabel: 'Chats',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <MessageCircle size={24} color={color} strokeWidth={2} fill={focused ? color : 'transparent'} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarLabel: 'Activity',
          headerShown: false,
          tabBarIcon: ({ color, focused }) => (
            <Bell size={24} color={color} strokeWidth={2} fill={focused ? color : 'transparent'} />
          ),
        }}
      />
      <Tabs.Screen
        name="channel/[id]"
        options={{
          href: null,
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      />
    </Tabs>
  );
}
