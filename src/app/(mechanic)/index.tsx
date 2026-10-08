import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Link } from 'expo-router';

export default function MechanicDashboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dashboard Montir</Text>
      <Text style={styles.subtitle}>Order masuk dan status online Anda akan tampil di sini.</Text>
      <Link href="/(mechanic)/active-orders" asChild>
        <Pressable style={styles.button}>
          <Text style={styles.buttonText}>Lihat Order Aktif</Text>
        </Pressable>
      </Link>
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
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#3c87f7',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
