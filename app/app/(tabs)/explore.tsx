import { View, Text, StyleSheet, Image } from 'react-native';

export default function ExploreScreen() {
  return (
    <View style={styles.container}>
      <Image 
        source={require('../../assets/images/logo.png')} 
        style={styles.logo} 
      />
      <Text style={styles.subtitle}>Use this tab to display info, settings, or other screens.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff', // Clean white background
    alignItems: 'center',
    justifyContent: 'center',
    padding: 25,
  },
  logo: {
    width: 200,
    height: 60,
    resizeMode: 'contain',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b', // Slate 500
    textAlign: 'center',
  },
});
