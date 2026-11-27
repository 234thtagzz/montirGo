export interface NotificationPushRecord {
  id?: string | null;
  user_id?: string | null;
  title?: string | null;
  body?: string | null;
  type?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
}

export type PushAudience = 'client' | 'mechanic' | null;

export function roleToAudience(role: unknown): PushAudience {
  if (role === 'client') return 'client';
  if (role === 'mechanic') return 'mechanic';
  return null;
}

export function buildPushDataPayload(params: {
  record?: NotificationPushRecord | null;
  audience?: PushAudience;
  overrideData?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const { record, audience = null, overrideData } = params;
  const relatedEntityType = record?.related_entity_type ?? null;
  const relatedEntityId = record?.related_entity_id ?? null;
  const requestId =
    relatedEntityType === 'service_request' && typeof relatedEntityId === 'string'
      ? relatedEntityId
      : null;

  const base: Record<string, unknown> = {
    notificationId: record?.id ?? null,
    type: record?.type ?? 'general',
    audience,
    requestId,
    relatedEntityType,
    relatedEntityId,
  };

  if (!overrideData) return base;

  return {
    ...base,
    ...overrideData,
    requestId: overrideData.requestId ?? base.requestId,
    audience: overrideData.audience ?? base.audience,
  };
}
