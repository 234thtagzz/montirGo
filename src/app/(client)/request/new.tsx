import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, Alert } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/api';

export default function NewServiceRequest() {
  const [form, setForm] = useState({
    vehicleBrand: '',
    vehicleModel: '',
    issueDescription: '',
  });
  const { logout } = useAuth();
  const router = useRouter();

  const submitRequest = async () => {
    if (!form.vehicleBrand || !form.issueDescription) {
      Alert.alert('Validasi', 'Harap lengkapi field kendaraan dan masalah');
      return;
    }
    Alert.alert('Sukses', 'Permintaan dikirim!');
    router.replace('/(client)');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>Butuh Bantuan Montir</Text>
        <Text style={styles.subtitle}>Buat permintaan bantuan</Text>
        
        <View style={styles.inputGroup}>
          <TextInput
            placeholder="Merek kendaraan"
            value={form.vehicleBrand}
            onChangeText={text => setForm({ ...form, vehicleBrand: text })}
            style={styles.input}
          />
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            placeholder="Model kendaraan"
            value={form.vehicleModel}
            onChangeText={text => setForm({ ...form, vehicleModel: text })}
            style={styles.input}
          />
        </View>

        <View style={styles.inputGroup}>
          <TextInput
            placeholder="Deskripsi masalah"
            value={form.issueDescription}
            onChangeText={text => setForm({ ...form, issueDescription: text })}
            multiline={true}
            numberOfLines={3}
            style={styles.textarea}
          />
        </View>

        <View style={styles.buttonGroup}>
          <Pressable onPress={submitRequest} style={styles.button}>
            <Text style={styles.buttonText}>Kirim</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9fb',
    padding: 24,
  },
  content: {
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 600,
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#60646c',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#f5f5f7',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#1a1a1a',
    marginBottom: 8,
  },
  textarea: {
    height: 80,
    padding: 12,
    backgroundColor: '#f5f5f7',
    borderRadius: 12,
    fontSize: 14,
    color: '#1a1a1a',
  },
  buttonGroup: {
    marginTop: 24,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#3c87f7',
    padding: 16,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
  },
});