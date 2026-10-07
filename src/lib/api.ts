import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export type UserRole = 'CLIENT' | 'MONTIR' | 'ADMIN';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  role: UserRole;
}

// Sisipkan token ke setiap request yang butuh auth
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('montirgo_token');
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    }
  } catch {
    // abaikan, request tetap dikirim tanpa token
  }
  return config;
});

// Normalisasi pesan error dari backend agar bisa ditampilkan di Alert
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (error.code === 'ECONNABORTED') return 'Koneksi ke server timeout. Periksa EXPO_PUBLIC_API_URL.';
    if (!error.response) return 'Tidak dapat terhubung ke server. Periksa backend sudah jalan.';
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export function isAccountNotFound(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { code?: string; message?: string } | undefined;
    if (error.response?.status === 404) return true;
    if (data?.code === 'ACCOUNT_NOT_FOUND') return true;
  }
  return false;
}

// Auth API
export const useAuth = () => {
  const login = async (data: { email: string; password: string }) => {
    const response = await api.post('/auth/login', data);
    const { user, token } = response.data as { user: AuthUser; token: string };
    await AsyncStorage.setItem('montirgo_token', token);
    await AsyncStorage.setItem('montirgo_user', JSON.stringify(user));
    await AsyncStorage.setItem('montirgo_user_role', user.role);
    return { user, token };
  };

  const register = async (data: {
    name: string;
    email: string;
    password: string;
    phone: string;
    role: UserRole;
  }) => {
    const response = await api.post('/auth/register', data);
    const { user, token } = response.data as { user: AuthUser; token: string };
    await AsyncStorage.setItem('montirgo_token', token);
    await AsyncStorage.setItem('montirgo_user', JSON.stringify(user));
    await AsyncStorage.setItem('montirgo_user_role', user.role);
    return { user, token };
  };

  const getCurrentUser = async () => {
    const userStr = await AsyncStorage.getItem('montirgo_user');
    return userStr ? JSON.parse(userStr) : null;
  };

  const getAuthToken = async () => {
    return await AsyncStorage.getItem('montirgo_token');
  };

  const logout = async () => {
    await AsyncStorage.removeItem('montirgo_token');
    await AsyncStorage.removeItem('montirgo_user');
    await AsyncStorage.removeItem('montirgo_user_role');
  };

  return {
    login,
    register,
    getCurrentUser,
    getAuthToken,
    logout,
  };
};

// Service Requests API
export const serviceRequestApi = {
  create (data: {
    clientId: string;
    vehicleId: string;
    issueDescription: string;
    symptoms?: string;
    lat: number;
    lng: number;
    address: string;
    additionalNotes?: string;
  }) {
    return api.post('/service-requests', data).then((res) => res.data);
  },

  getById (id: string) {
    return api.get(`/service-requests/${id}`).then((res) => res.data);
  },

  listMyRequests (clientId: string) {
    return api.get(`/service-requests?clientId=${clientId}`).then((res) => res.data);
  },

  updateStatus (id: string, status: string) {
    return api.patch(`/service-requests/${id}/status`, { status }).then((res) => res.data);
  },
};

// Mechanics API
export const mechanicApi = {
  setOnline (isOnline: boolean) {
    return api.patch('/mechanic', { isOnline }).then((res) => res.data);
  },

  getProfile () {
    return api.get('/mechanic/profile').then((res) => res.data);
  },

  listPendingRequests () {
    return api.get('/service-requests/pending').then((res) => res.data);
  },
};

// Payments API
export const paymentApi = {
  initiateQRIS (serviceRequestId: string, amount: number) {
    return api.post('/payments/qris', {
      serviceRequestId,
      amount,
    }).then((res) => res.data);
  },

  checkPaymentStatus (paymentId: string) {
    return api.get(`/payments/${paymentId}`).then((res) => res.data);
  },
};

// Earnings API
export const earningsApi = {
  getEarnings (period: 'today' | 'this_week' | 'this_month') {
    return api.get(`/earnings?period=${period}`).then((res) => res.data);
  },
};

// AI Diagnosis API
export const aiApi = {
  analyze (data: {
    description: string;
    symptoms?: string;
    vehicleType?: string;
    vehicleBrand?: string;
    vehicleModel?: string;
    vehicleYear?: number;
  }) {
    return api.post('/ai/analyze', data).then((res) => res.data);
  },
};

export default {
  useAuth,
  serviceRequestApi,
  mechanicApi,
  paymentApi,
  earningsApi,
  aiApi,
};