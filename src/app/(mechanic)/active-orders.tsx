import { View, Text, StyleSheet } from 'react-native';

export default function MechanicActiveOrdersScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Order Aktif</Text>
      <Text style={styles.subtitle}>Belum ada order aktif saat ini.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#60646c',
    textAlign: 'center',
  },
});
