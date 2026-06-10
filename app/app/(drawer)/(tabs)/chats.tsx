import { View, Text, TouchableOpacity, useColorScheme, StatusBar, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from 'expo-router';

const FriesIcon = ({ size = 26, color = '#000' }: { size?: number, color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path stroke={color} strokeWidth="2" strokeLinecap="round" d="M4 6h16 M4 12h10 M4 18h14" />
  </Svg>
);

export default function ChatsScreen() {
  const navigation = useNavigation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const glassmorphicBg = isDark ? 'rgba(255, 255, 255, 0.12)' : '#ffffff';
  const iconColor = isDark ? '#ffffff' : '#1a1718';
  const textColor = isDark ? '#ffffff' : '#1a1718';

  return (
    <View className="flex-1 bg-surface-background">
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
      
      <SafeAreaView edges={['top']} className="bg-surface-background">
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 14,
        }}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
            onPress={() => (navigation as any).openDrawer()}
          >
            <FriesIcon size={26} color={iconColor} />
          </TouchableOpacity>

          <View className="flex-1 items-center justify-center">
            <Text style={{ fontSize: 20, fontWeight: '700', color: textColor, letterSpacing: -0.5 }}>
              Chats
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.7}
            style={{ backgroundColor: glassmorphicBg, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="ellipsis-horizontal" size={26} color={iconColor} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <View className="flex-1 items-center justify-center p-6">
        <Image 
          source={require('../../../assets/images/logo.png')} 
          style={styles.logo} 
        />
        <Text className="text-text-secondary text-base text-center mt-4">
          Use this tab to display info, settings, or other screens.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  logo: {
    width: 200,
    height: 60,
    resizeMode: 'contain',
  },
});
