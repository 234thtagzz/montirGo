import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/lib/api';

export default function ClientDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const { logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    fetchMyOrders();
  }, []);

  const fetchMyOrders = async () => {
    try {
      const token = await AsyncStorage.getItem('montirgo_token');
      const userStr = await AsyncStorage.getItem('montirgo_user');
      const user = userStr ? JSON.parse(userStr) : null;
      const userId = user ? user.id : null;
      const response = await fetch('/api/service-requests?clientId=' + userId, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      setOrders(data);
    } catch (error) {
      console.error('Gagal mengambil order:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={fetchMyOrders}
        />
      }
    >
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Belum ada permintaan bantuan</Text>
        <Text style={styles.emptyHint}>Tap "+ Butuh Montir" untuk membuat permintaan baru</Text>
      </View>
      {orders.length > 0 ? (
        orders.map((order) => (
          <View key={order.id} style={styles.orderItem}>
            <View style={styles.orderInfo}>
              <Text style={styles.orderStatus}>{order.status}</Text>
              <Text style={styles.orderDetail}>
                Kendaraan: {order.vehicleBrand} {order.vehicleModel} ({order.vehicleYear || ''})
              </Text>
              <Text style={styles.orderDetail}>
                Masalah: {order.vehicleIssueDescription.substring(0, 30)}{order.vehicleIssueDescription.length > 30 ? '...' : ''}
              </Text>
            </View>
            <View style={styles.orderActions}>
              {order.status === 'REQUESTED' && (
                <Text style={styles.viewDetails}>Lihat Detail</Text>
              )}
            </View>
          </View>
        ))
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#f9f9fb',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  emptyHint: {
    color: '#888',
    fontSize: 14,
  },
  orderItem: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderStatus: {
    fontSize: 12,
    padding: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    backgroundColor: '#e8eaed',
    marginRight: 8,
  },
  orderDetail: {
    fontSize: 14,
    color: '#333',
  },
  orderActions: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  viewDetails: {
    color: '#3c87f7',
    fontSize: 12,
    marginRight: 8,
  },
});