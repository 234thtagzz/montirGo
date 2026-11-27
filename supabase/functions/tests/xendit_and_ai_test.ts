import {
  friendlyXenditError,
  isXenditSessionCompleted,
  parseFeePercent,
  verifyCallbackToken,
} from '../_shared/xendit.ts';
import { buildPushDataPayload, roleToAudience } from '../_shared/push.ts';
import { sanitizeContextText } from '../_shared/ai.ts';

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      `Assertion failed${message ? ` (${message})` : ''}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

Deno.test('parseFeePercent never collapses empty/missing value to 0%', () => {
  assertEquals(parseFeePercent(undefined, 10), 10, 'undefined -> fallback');
  assertEquals(parseFeePercent(null, 10), 10, 'null -> fallback');
  assertEquals(parseFeePercent('', 10), 10, 'empty string -> fallback');
  assertEquals(parseFeePercent('   ', 10), 10, 'whitespace string -> fallback');
  assertEquals(parseFeePercent('0', 10), 0, 'explicit 0 allowed');
  assertEquals(parseFeePercent(0, 10), 0, 'numeric 0 allowed');
  assertEquals(parseFeePercent('12.5', 10), 12.5, 'valid numeric string');
  assertEquals(parseFeePercent('99', 10), 50, 'clamped to upper bound');
  assertEquals(parseFeePercent(-5, 10), 0, 'clamped to lower bound');
});

Deno.test('verifyCallbackToken uses constant-time comparison and env token', () => {
  const prev = Deno.env.get('XENDIT_WEBHOOK_TOKEN');
  try {
    Deno.env.delete('XENDIT_WEBHOOK_TOKEN');
    Deno.env.delete('XENDIT_WEBHOOK_SECRET');
    Deno.env.delete('XENDIT_CALLBACK_TOKEN');

    const noEnvReq = new Request('https://example.test/webhook', {
      headers: { 'x-callback-token': 'secret-123' },
    });
    assertEquals(verifyCallbackToken(noEnvReq), false, 'missing env rejected');

    Deno.env.set('XENDIT_WEBHOOK_TOKEN', 'secret-123');

    const okReq = new Request('https://example.test/webhook', {
      headers: { 'x-callback-token': 'secret-123' },
    });
    assertEquals(verifyCallbackToken(okReq), true, 'exact token accepted');

    const badReq = new Request('https://example.test/webhook', {
      headers: { 'x-callback-token': 'secret-999' },
    });
    assertEquals(verifyCallbackToken(badReq), false, 'mismatch rejected');

    const shortReq = new Request('https://example.test/webhook', {
      headers: { 'x-callback-token': 'short' },
    });
    assertEquals(verifyCallbackToken(shortReq), false, 'length mismatch rejected');
  } finally {
    if (prev === undefined) Deno.env.delete('XENDIT_WEBHOOK_TOKEN');
    else Deno.env.set('XENDIT_WEBHOOK_TOKEN', prev);
  }
});

Deno.test('friendlyXenditError maps timeout and gateway errors cleanly', () => {
  assertEquals(
    friendlyXenditError('XENDIT_NETWORK_TIMEOUT'),
    'Koneksi ke gateway pembayaran lambat. Periksa status transaksi.',
  );
  assertEquals(
    friendlyXenditError('UNKNOWN_CODE', 'Pesan cadangan'),
    'Pesan cadangan',
  );
});

Deno.test('sanitizeContextText strips control chars and truncates', () => {
  const dirty = 'Honda\u0000 Beat\u0007   2022   ';
  assertEquals(sanitizeContextText(dirty, 50), 'Honda Beat 2022');
  assertEquals(sanitizeContextText('A'.repeat(200), 20).length, 20);
  assertEquals(sanitizeContextText(123, 50), '');
});

Deno.test('buildPushDataPayload aligns requestId, relatedEntityId, and audience', () => {
  const payload = buildPushDataPayload({
    record: {
      id: 'notif-1',
      type: 'quote_submitted',
      related_entity_type: 'service_request',
      related_entity_id: 'req-123',
    },
    audience: roleToAudience('client'),
  });
  assertEquals(payload.requestId, 'req-123');
  assertEquals(payload.relatedEntityId, 'req-123');
  assertEquals(payload.audience, 'client');
  assertEquals(payload.type, 'quote_submitted');

  const nonOrder = buildPushDataPayload({
    record: {
      id: 'notif-2',
      type: 'withdrawal',
      related_entity_type: 'withdrawal',
      related_entity_id: 'wd-99',
    },
    audience: roleToAudience('mechanic'),
  });
  assertEquals(nonOrder.requestId, null);
  assertEquals(nonOrder.audience, 'mechanic');
});

Deno.test('isXenditSessionCompleted detects COMPLETED regardless of case/whitespace', () => {
  assertEquals(isXenditSessionCompleted('COMPLETED'), true);
  assertEquals(isXenditSessionCompleted(' completed '), true);
  assertEquals(isXenditSessionCompleted('PENDING'), false);
  assertEquals(isXenditSessionCompleted(undefined), false);
});
