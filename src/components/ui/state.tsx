import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';

export function LoadingState({ message = 'Memuat...' }: { message?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
  },
  text: { fontSize: 13, color: '#60646c', marginTop: 8, textAlign: 'center' },
});
