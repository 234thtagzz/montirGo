import { View, Text, StyleSheet, ScrollView, Alert, Pressable } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/lib/api';

export default function MechanicActiveOrder() {
  const { id: orderId } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<any | null>(null);
  const { logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchOrderDetail();
  }, []);

  const fetchOrderDetail = async () => {
    try {
      const token = await AsyncStorage.getItem('montirgo_token');
      const response = await fetch('/api/service-requests/' + orderId, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setOrder(data);
    } catch (error) {
      console.error('Gagal fetch order:', error);
    }
  };

  if (!order) {
    return (
      <View style={styles.loading}>
        <Text>Memuat order...</Text>
      </View>
    );
  }

  const statusText = order.status === 'MECHANIC_ACCEPTED' ? 'Sedang Dalam Jalan' :
                    order.status === 'ON_THE_WAY' ? 'Sedang Diajukan' :
                    order.status === 'ARRIVED' ? 'Sampai' : order.status;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Order Aktif</Text>
        <Text style={styles.headerSub}>{statusText}</Text>
      </View>

      <View style={styles.orderCard}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderHeaderTitle}>Pelanggan</Text>
          <Pressable style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutText}>Keluar</Text>
          </Pressable>
        </View>

        <View style={styles.orderBody}>
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{order.clientFullName || 'Nama tidak tersedia'}</Text>
            <Text style={styles.driverPhone}>{order.clientPhone || '—'}</Text>
          </View>

          <View style={styles.vehicleInfo}>
            <Text style={styles.vehicleText}>Kendaraan: {order.vehicleBrand} {order.vehicleModel} {order.vehicleYear ? '(' + order.vehicleYear + ')' : ''}</Text>
          </View>

          <View style={styles.locationSection}>
            <Text style={styles.locationTitle}>Lokasi Pelanggan</Text>
            {order.clientLat && order.clientLng ? (
              <View style={styles.mapContainer}>
                <View style={styles.mapContent}>
                  <Text style={styles.mapAnnotation}>Pelanggan</Text>
                  <Text style={styles.mapCoords}>
                    Lat: {order.clientLat.toFixed(4)} / Lng: {order.clientLng.toFixed(4)}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.noLocation}>Lokasi belum tersedia</Text>
            )}
          </View>

          <View style={styles.statusBar}>
            <Text style={styles.statusBarText}>Status: {order.status}</Text>
          </View>

          {order.status === 'MECHANIC_ACCEPTED' && (
            <Pressable style={styles.acceptanceBtn} onPress={() => router.back()}>
              <Text style={styles.acceptanceText}>Saya Akan Datang</Text>
            </Pressable>
          )}

          {order.status === 'ON_THE_WAY' && (
            <Pressable style={styles.arrivedBtn} onPress={() => router.back()}>
              <Text style={styles.arrivedText}>Sampai</Text>
            </Pressable>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9fb',
  },
  content: {
    paddingBottom: 32,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e1e6',
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#1a1a1a',
  },
  headerSub: {
    color: '#60646c',
    fontSize: 12,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  orderHeaderTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1a1a1a',
  },
  logoutButton: {
    padding: 6,
  },
  logoutText: {
    color: '#e8112a',
    fontSize: 12,
  },
  orderBody: {
    flex: 1,
  },
  driverInfo: {
    flexDirection: 'column',
    marginBottom: 12,
  },
  driverName: {
    fontSize: 16,
    fontWeight: 500,
    color: '#1a1a1a',
  },
  driverPhone: {
    color: '#60646c',
    fontSize: 12,
    marginTop: 2,
  },
  vehicleInfo: {
    color: '#60646c',
    fontSize: 12,
    marginBottom: 16,
  },
  vehicleText: {
    color: '#60646c',
    fontSize: 12,
  },
  locationSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e1e6',
  },
  locationTitle: {
    fontSize: 12,
    color: '#60646c',
    marginBottom: 8,
  },
  mapContainer: {
    height: 200,
    width: '100%',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    backgroundColor: '#f0f0f5',
  },
  mapContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapAnnotation: {
    color: '#3c87f7',
    fontSize: 12,
    fontWeight: 500,
  },
  mapCoords: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  noLocation: {
    padding: 20,
    color: '#666',
    textAlign: 'center',
  },
  statusBar: {
    padding: 8,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  statusBarText: {
    color: '#60646c',
    fontSize: 12,
  },
  acceptanceBtn: {
    backgroundColor: '#3c87f7',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  acceptanceText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 500,
  },
  arrivedBtn: {
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  arrivedText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 500,
  },
});