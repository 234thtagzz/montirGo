import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';

export default function ChooseRoleScreen() {
  const [role, setRole] = useState<'CLIENT' | 'MONTIR'>('CLIENT');
  const router = useRouter();

  const handleSelect = (selectedRole: 'CLIENT' | 'MONTIR') => {
    setRole(selectedRole);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Pilih Peran Anda</Text>
        <Text style={styles.subtitle}>MontirGo menghubungkan client dengan montir di lokasi</Text>
        
        <Pressable
          style={[styles.roleButton, role === 'CLIENT' && styles.roleButtonActive]}
          onPress={() => handleSelect('CLIENT')}
        >
          <Text style={styles.roleText}>Client</Text>
          <Text style={styles.roleSubtext}>Butuh bantuan montir</Text>
        </Pressable>
        
        <Pressable
          style={[styles.roleButton, role === 'MONTIR' && styles.roleButtonActive]}
          onPress={() => handleSelect('MONTIR')}
        >
          <Text style={styles.roleText}>Montir</Text>
          <Text style={styles.roleSubtext}>Tawarkan jasa bantuan</Text>
        </Pressable>
        
        <Pressable
          style={styles.continueButton}
          onPress={() => router.push(`/(auth)/register?role=${role}`)}
        >
          <Text style={styles.continueText}>Lanjut Daftar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: '#fff',
    padding: 32,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: 600,
    textAlign: 'center',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 32,
    color: '#60646c',
    fontSize: 14,
  },
  roleButton: {
    backgroundColor: '#f5f5f7',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  roleButtonActive: {
    borderColor: '#3c87f7',
    backgroundColor: '#e8f1fe',
  },
  roleText: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1a1a1a',
  },
  roleSubtext: {
    color: '#86868b',
    fontSize: 12,
  },
  continueButton: {
    backgroundColor: '#3c87f7',
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
    alignItems: 'center',
  },
  continueText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 600,
  },
});