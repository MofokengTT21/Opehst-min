import { View, Text, StyleSheet, Image } from 'react-native';

export default function ExploreScreen() {
  return (
    <View className="flex-1 bg-surface-background items-center justify-center p-6">
      <Image 
        source={require('../../../assets/images/logo.png')} 
        style={styles.logo} 
      />
      <Text className="text-text-secondary text-base text-center mt-4">
        Use this tab to display info, settings, or other screens.
      </Text>
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
