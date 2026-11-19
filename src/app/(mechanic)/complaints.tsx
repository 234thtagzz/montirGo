import { useLocalSearchParams } from 'expo-router';
import { ComplaintsScreen } from '@/features/complaints/screens/complaints-screen';

export default function MechanicComplaintsScreen() {
  const { requestId } = useLocalSearchParams<{ requestId?: string }>();
  return <ComplaintsScreen role="mechanic" initialRequestId={requestId} />;
}
