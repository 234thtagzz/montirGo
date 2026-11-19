import { useLocalSearchParams } from 'expo-router';
import { ComplaintsScreen } from '@/features/complaints/screens/complaints-screen';

export default function ClientComplaintsScreen() {
  const { requestId } = useLocalSearchParams<{ requestId?: string }>();
  return <ComplaintsScreen role="client" initialRequestId={requestId} />;
}
