import { View, Text, StyleSheet } from 'react-native';

export default function CIBoardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Continuous Improvement</Text>
      <Text style={styles.subtitle}>Digitised SHEQ cross and performance boards will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
  },
});
