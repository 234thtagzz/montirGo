import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { after, before, describe, it } from 'node:test';
import { createClient } from '@supabase/supabase-js';

const USERS = {
  admin: { id: '11111111-1111-4111-8111-111111111101', email: 'admin@montirgo.test' },
  client1: {
    id: '22222222-2222-4222-8222-222222222201',
    email: 'client1@montirgo.test',
    vehicleId: '44444444-4444-4444-8444-444444444401',
  },
  client2: {
    id: '22222222-2222-4222-8222-222222222202',
    email: 'client2@montirgo.test',
    vehicleId: '44444444-4444-4444-8444-444444444402',
  },
  mechanic1: { id: '33333333-3333-4333-8333-333333333301', email: 'mechanic1@montirgo.test' },
  mechanic2: { id: '33333333-3333-4333-8333-333333333302', email: 'mechanic2@montirgo.test' },
  unverified: {
    id: '33333333-3333-4333-8333-333333333303',
    email: 'mechanic_unverified@montirgo.test',
  },
};

function resolveSupabaseEnv() {
  if (
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
  }

  const raw = execSync('npx supabase status -o env', { encoding: 'utf8' });
  const map = new Map();
  for (const line of raw.split(/\r?\n/)) {
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^"(.*)"$/, '$1');
    map.set(key, val);
  }

  const url = map.get('API_URL') || map.get('SUPABASE_URL');
  const anonKey = map.get('ANON_KEY') || map.get('SUPABASE_ANON_KEY');
  const serviceKey = map.get('SERVICE_ROLE_KEY') || map.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) {
    throw new Error('Supabase local env tidak ditemukan. Jalankan `npx supabase start` dahulu.');
  }
  return { url, anonKey, serviceKey };
}

const env = resolveSupabaseEnv();
const serviceClient = createClient(env.url, env.serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function signIn(email) {
  const client = createClient(env.url, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: 'Password123!',
  });
  assert.ifError(error);
  return client;
}

async function cleanupTestData() {
  await serviceClient.from('ai_usage_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await serviceClient.from('ai_chat_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await serviceClient.from('device_push_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await serviceClient.from('complaints').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await serviceClient.from('reviews').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await serviceClient.from('wallet_transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await serviceClient.from('earnings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await serviceClient.from('payment_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await serviceClient.from('payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await serviceClient.from('withdrawals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await serviceClient
    .from('mechanic_payout_accounts')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  await serviceClient.from('mechanic_locations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await serviceClient.from('order_invoice_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await serviceClient
    .from('service_request_assignment_rejections')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  await serviceClient.from('service_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  await serviceClient
    .from('mechanic_wallets')
    .update({
      available_balance: 0,
      pending_balance: 0,
      held_balance: 0,
      commission_debt: 0,
      total_earned: 0,
      total_withdrawn: 0,
    })
    .in('mechanic_id', [USERS.mechanic1.id, USERS.mechanic2.id, USERS.unverified.id]);

  await serviceClient
    .from('mechanic_profiles')
    .update({ is_online: true, is_available: true, vehicle_label: null, vehicle_plate: null })
    .in('profile_id', [USERS.mechanic1.id, USERS.mechanic2.id]);
}

describe('MontirGo Backend Security, State Machine & Ledger', () => {
  let client1;
  let client2;
  let mechanic1;
  let mechanic2;
  let unverifiedMech;

  before(async () => {
    await cleanupTestData();
    [client1, client2, mechanic1, mechanic2, unverifiedMech] = await Promise.all([
      signIn(USERS.client1.email),
      signIn(USERS.client2.email),
      signIn(USERS.mechanic1.email),
      signIn(USERS.mechanic2.email),
      signIn(USERS.unverified.email),
    ]);
  });

  after(async () => {
    await cleanupTestData();
  });

  it('enforces P0 PII isolation, mechanic verification gate & direct write blocks', async () => {
    // 1. NIK hanya bisa dilihat pemilik.
    const { data: ownIdent, error: ownErr } = await client1
      .from('profile_identities')
      .select('profile_id, identity_number');
    assert.ifError(ownErr);
    assert.equal(ownIdent.length, 1);
    assert.equal(ownIdent[0].profile_id, USERS.client1.id);

    const { data: otherIdent } = await client1
      .from('profile_identities')
      .select('profile_id, identity_number')
      .eq('profile_id', USERS.client2.id);
    assert.equal(otherIdent.length, 0);

    // 2. Montir unverified tidak boleh self-verify atau go-online.
    const { error: selfVerifyErr } = await unverifiedMech
      .from('mechanic_profiles')
      .update({ is_verified: true })
      .eq('profile_id', USERS.unverified.id);
    assert.ok(selfVerifyErr, 'Self-verify harus ditolak trigger PROTECTED_COLUMN');

    const { error: onlineErr } = await unverifiedMech.rpc('set_mechanic_online_status', {
      p_is_online: true,
      p_lat: -6.21,
      p_lng: 106.846,
    });
    assert.ok(onlineErr?.message.includes('MECHANIC_NOT_VERIFIED'));

    // 3. Buat request via RPC dan pastikan contact_phone / exact lat-lng tersembunyi sebelum diterima.
    const { data: createdReq, error: reqErr } = await client1.rpc('create_service_request', {
      p_vehicle_id: USERS.client1.vehicleId,
      p_issue_description: 'Motor tidak bisa distarter',
      p_symptoms: 'Aki lemah',
      p_lat: -6.2105,
      p_lng: 106.8465,
      p_address: 'Jl. Melati No. 12, Menteng, Jakarta Pusat',
      p_contact_phone: '081299998888',
      p_additional_notes: 'Depan minimarket',
    });
    assert.ifError(reqErr);
    assert.equal(createdReq.status, 'requested');
    assert.equal(createdReq.callout_fee_tier, 'motor');
    assert.equal(createdReq.callout_fee_amount, 25000);
    assert.equal(createdReq.quote_status, 'draft');

    // Batas 1 active order per client.
    const { error: dupReqErr } = await client1.rpc('create_service_request', {
      p_vehicle_id: USERS.client1.vehicleId,
      p_issue_description: 'Order kedua serentak',
      p_lat: -6.2105,
      p_lng: 106.8465,
      p_address: 'Jl. Melati No. 12, Jakarta Pusat',
      p_contact_phone: '081299998888',
    });
    assert.ok(dupReqErr, 'Client tidak boleh membuat >1 order aktif');

    // Direct SELECT pada service_requests tidak membocorkan request yang belum di-assign.
    const { data: rawOpenRows } = await mechanic1
      .from('service_requests')
      .select('id, contact_phone')
      .eq('id', createdReq.id);
    assert.equal(rawOpenRows.length, 0);

    // Nearby open requests hanya menampilkan address_area & distance_km, tanpa contact_phone.
    const { data: nearbyRows, error: nearbyErr } = await mechanic1.rpc('list_nearby_open_requests', {
      p_lat: -6.2088,
      p_lng: 106.8456,
      p_radius_km: 15,
      p_limit: 10,
    });
    assert.ifError(nearbyErr);
    const found = nearbyRows.find((r) => r.id === createdReq.id);
    assert.ok(found, 'Order baru harus muncul di radar nearby montir');
    assert.equal('contact_phone' in found, false);
    assert.ok(typeof found.address_area === 'string' && !found.address_area.includes('No. 12'));
    assert.ok(typeof found.distance_km === 'number');

    // Unverified mechanic tidak boleh accept_service_request.
    const { error: unvAcceptErr } = await unverifiedMech.rpc('accept_service_request', {
      p_request_id: createdReq.id,
    });
    assert.ok(unvAcceptErr?.message.includes('MECHANIC_NOT_VERIFIED'));

    // Client tidak boleh langsung UPDATE service_requests.status = 'paid'.
    const { data: directUpdRows, error: directUpdErr } = await client1
      .from('service_requests')
      .update({ status: 'paid' })
      .eq('id', createdReq.id)
      .select('id');
    assert.ok(
      Boolean(directUpdErr) || (directUpdRows ?? []).length === 0,
      'Direct status tampering oleh client harus ditolak RLS',
    );
    const { data: unchangedReq } = await serviceClient
      .from('service_requests')
      .select('status')
      .eq('id', createdReq.id)
      .single();
    assert.equal(unchangedReq.status, 'requested');

    // Cleanup request agar suite berikutnya mulai bersih.
    await client1.rpc('cancel_order', { p_request_id: createdReq.id, p_reason: 'Cleanup test 1' });
  });

  it('handles full workflow, mechanic cancel re-pool, route snapshot & invoice reopen', async () => {
    const { data: sr, error: createErr } = await client1.rpc('create_service_request', {
      p_vehicle_id: USERS.client1.vehicleId,
      p_issue_description: 'Rantai motor putus di tengah jalan',
      p_symptoms: 'Bunyi keras lalu berhenti',
      p_lat: -6.212,
      p_lng: 106.848,
      p_address: 'Jl. Rasuna Said Kav 5, Setiabudi, Jakarta Selatan',
      p_contact_phone: '081200001111',
      p_callout_fee_tier: 'motor',
    });
    assert.ifError(createErr);
    assert.equal(sr.callout_fee_amount, 25000);

    // Mechanic 1 apply -> client1 approve -> mechanic1 cancel di mechanic_accepted -> kembali ke pool requested.
    const { error: a1Err } = await mechanic1.rpc('accept_service_request', { p_request_id: sr.id });
    assert.ifError(a1Err);

    const { data: resp1, error: r1Err } = await client1.rpc('respond_to_assignment', {
      p_request_id: sr.id,
      p_action: 'accept',
    });
    assert.ifError(r1Err);
    assert.equal(resp1.status, 'mechanic_accepted');

    const { data: cancelledByMech, error: cancelErr } = await mechanic1.rpc('cancel_order', {
      p_request_id: sr.id,
      p_reason: 'Ban motor saya kempes',
    });
    assert.ifError(cancelErr);
    assert.equal(cancelledByMech.status, 'requested');
    assert.equal(cancelledByMech.mechanic_id, null);

    // Mechanic 1 diblokir mengambil order yang sama lagi.
    const { error: reacceptErr } = await mechanic1.rpc('accept_service_request', {
      p_request_id: sr.id,
    });
    assert.ok(reacceptErr, 'Montir yang baru membatalkan order harus diblokir untuk order yang sama');

    // Mechanic 2 mengambil alih order.
    const { error: a2Err } = await mechanic2.rpc('accept_service_request', { p_request_id: sr.id });
    assert.ifError(a2Err);

    const { data: resp2, error: r2Err } = await client1.rpc('respond_to_assignment', {
      p_request_id: sr.id,
      p_action: 'accept',
    });
    assert.ifError(r2Err);
    assert.equal(resp2.status, 'mechanic_accepted');

    // Transisi ke on_the_way + rekam lokasi & route snapshot.
    const { data: otw, error: otwErr } = await mechanic2.rpc('transition_order_status', {
      p_request_id: sr.id,
      p_to_status: 'on_the_way',
    });
    assert.ifError(otwErr);
    assert.equal(otw.status, 'on_the_way');

    const { error: locErr } = await mechanic2.rpc('record_mechanic_location', {
      p_request_id: sr.id,
      p_lat: -6.214,
      p_lng: 106.849,
      p_accuracy: 8.5,
      p_route_polyline: '_p~iF~ps|U_ulLnnqC',
      p_route_distance_m: 1450,
      p_route_duration_s: 360,
    });
    assert.ifError(locErr);

    const { data: reqWithRoute } = await client1
      .from('service_requests')
      .select('route_polyline, route_distance_m, route_duration_s')
      .eq('id', sr.id)
      .single();
    assert.equal(reqWithRoute.route_polyline, '_p~iF~ps|U_ulLnnqC');
    assert.equal(reqWithRoute.route_distance_m, 1450);

    // Tiba di lokasi -> baris callout_fee otomatis terbuat -> tambah item -> submit quote -> client approve -> finalize -> reopen -> wajib re-approve.
    const { error: arrErr } = await mechanic2.rpc('transition_order_status', {
      p_request_id: sr.id,
      p_to_status: 'arrived',
    });
    assert.ifError(arrErr);

    const { error: item1Err } = await mechanic2.from('order_invoice_items').insert({
      request_id: sr.id,
      mechanic_id: USERS.mechanic2.id,
      description: 'Ganti rantai set',
      amount: 150000,
      item_type: 'parts',
    });
    assert.ifError(item1Err);

    // Finalize ditolak sebelum persetujuan digital client.
    const { error: unapprovedFinErr } = await mechanic2.rpc('finalize_order_invoice', {
      p_request_id: sr.id,
    });
    assert.ok(unapprovedFinErr?.message.includes('QUOTE_NOT_APPROVED'));

    const { data: q1, error: q1Err } = await mechanic2.rpc('submit_order_quote', {
      p_request_id: sr.id,
    });
    assert.ifError(q1Err);
    assert.equal(q1.quote_status, 'pending_approval');

    const { data: q1App, error: q1AppErr } = await client1.rpc('respond_to_quote', {
      p_request_id: sr.id,
      p_action: 'approve',
    });
    assert.ifError(q1AppErr);
    assert.equal(q1App.quote_status, 'approved');

    const { data: inv1, error: inv1Err } = await mechanic2.rpc('finalize_order_invoice', {
      p_request_id: sr.id,
    });
    assert.ifError(inv1Err);
    assert.equal(inv1.status, 'payment');
    // 25.000 biaya panggil motor + 150.000 item = 175.000
    assert.equal(inv1.price_amount, 175000);

    // Revisi tagihan: payment -> arrived & reset quote_status = 'draft' (wajib persetujuan ulang!).
    const { data: reopened, error: reopenErr } = await mechanic2.rpc('reopen_order_invoice', {
      p_request_id: sr.id,
    });
    assert.ifError(reopenErr);
    assert.equal(reopened.status, 'arrived');
    assert.equal(reopened.quote_status, 'draft');

    const { error: item2Err } = await mechanic2.from('order_invoice_items').insert({
      request_id: sr.id,
      mechanic_id: USERS.mechanic2.id,
      description: 'Biaya jasa darurat',
      amount: 50000,
      item_type: 'service',
    });
    assert.ifError(item2Err);

    // Harus gagal finalize sebelum disetujui ulang setelah reopen.
    const { error: needReapproveErr } = await mechanic2.rpc('finalize_order_invoice', {
      p_request_id: sr.id,
    });
    assert.ok(needReapproveErr?.message.includes('QUOTE_NOT_APPROVED'));

    await mechanic2.rpc('submit_order_quote', { p_request_id: sr.id });
    await client1.rpc('respond_to_quote', { p_request_id: sr.id, p_action: 'approve' });

    const { data: inv2, error: inv2Err } = await mechanic2.rpc('finalize_order_invoice', {
      p_request_id: sr.id,
    });
    assert.ifError(inv2Err);
    assert.equal(inv2.status, 'payment');
    // 25.000 + 150.000 + 50.000 = 225.000
    assert.equal(inv2.price_amount, 225000);

    // Konfirmasi cash gagal bila client belum memilih cash.
    const { error: prematureCashErr } = await serviceClient.rpc('confirm_cash_payment', {
      p_request_id: sr.id,
      p_mechanic_id: USERS.mechanic2.id,
    });
    assert.ok(prematureCashErr?.message.includes('PAYMENT_METHOD_NOT_CASH'));

    // Client pilih cash -> service_role konfirmasi pembayaran tunai.
    const { error: chooseCashErr } = await client1.rpc('choose_payment_method', {
      p_request_id: sr.id,
      p_method: 'cash',
    });
    assert.ifError(chooseCashErr);

    const { data: cashPay, error: cashConfirmErr } = await serviceClient.rpc('confirm_cash_payment', {
      p_request_id: sr.id,
      p_mechanic_id: USERS.mechanic2.id,
    });
    assert.ifError(cashConfirmErr);
    assert.equal(cashPay.status, 'paid');
    assert.equal(cashPay.method, 'cash');
    assert.equal(cashPay.platform_fee, 22500);

    // Order menjadi paid dan completed_at terisi; montir available lagi; utang komisi = 22500.
    const { data: finalOrder } = await serviceClient
      .from('service_requests')
      .select('status, completed_at')
      .eq('id', sr.id)
      .single();
    assert.equal(finalOrder.status, 'paid');
    assert.ok(finalOrder.completed_at, 'completed_at harus terisi saat paid');

    const { data: walletAfterCash } = await mechanic2.rpc('refresh_my_wallet');
    assert.equal(walletAfterCash.commission_debt, 22500);
    assert.equal(walletAfterCash.available_balance, 0);

    // Pastikan total_jobs dihitung tepat 1 (tidak double-count antara RPC dan trigger).
    const { data: m2ProfileAfterCash, error: m2ProfErr } = await serviceClient
      .from('mechanic_profiles')
      .select('total_jobs, rating_avg, rating_count')
      .eq('profile_id', USERS.mechanic2.id)
      .single();
    assert.ifError(m2ProfErr);
    assert.equal(m2ProfileAfterCash.total_jobs, 1, 'total_jobs harus 1 setelah 1 order paid');

    // Client memberi ulasan setelah paid: trigger refresh_mechanic_rating harus diizinkan.
    const { error: reviewErr } = await client1.from('reviews').insert({
      request_id: sr.id,
      client_id: USERS.client1.id,
      mechanic_id: USERS.mechanic2.id,
      rating: 5,
      comment: 'Cepat dan ramah',
    });
    assert.ifError(reviewErr);

    const { data: m2AfterReview, error: m2RevProfErr } = await serviceClient
      .from('mechanic_profiles')
      .select('rating_avg, rating_count')
      .eq('profile_id', USERS.mechanic2.id)
      .single();
    assert.ifError(m2RevProfErr);
    assert.equal(Number(m2AfterReview.rating_avg), 5);
    assert.equal(m2AfterReview.rating_count, 1);

    // Montir tetap tidak boleh mengubah langsung kolom terproteksi (rating_avg / total_jobs).
    const { error: tamperProfErr } = await mechanic2
      .from('mechanic_profiles')
      .update({ rating_avg: 1, total_jobs: 99 })
      .eq('profile_id', USERS.mechanic2.id);
    assert.ok(tamperProfErr, 'Direct update kolom rating_avg / total_jobs harus ditolak PROTECTED_COLUMN');

    // Penarikan saldo harus ditolak selama commission_debt > 0.
    const { data: payoutAccount } = await serviceClient
      .from('mechanic_payout_accounts')
      .insert({
        mechanic_id: USERS.mechanic2.id,
        type: 'bank',
        bank_code: 'BCA',
        account_number: '1234567890',
        account_holder_name: 'Rudi Servis',
      })
      .select('id')
      .single();

    const { error: wdBlockedErr } = await serviceClient.rpc('request_withdrawal', {
      p_mechanic_id: USERS.mechanic2.id,
      p_amount: 50000,
      p_account_id: payoutAccount.id,
    });
    assert.ok(wdBlockedErr?.message.includes('COMMISSION_DEBT_OUTSTANDING'));

    // Simulasikan batas credit limit tercapai (100000): montir diblokir menerima order baru.
    await serviceClient
      .from('mechanic_wallets')
      .update({ commission_debt: 100000 })
      .eq('mechanic_id', USERS.mechanic2.id);

    const { data: sr2 } = await client2.rpc('create_service_request', {
      p_vehicle_id: USERS.client2.vehicleId,
      p_issue_description: 'Ban mobil bocor',
      p_lat: -6.215,
      p_lng: 106.85,
      p_address: 'Jl. Gatot Subroto Kav 20, Jakarta Selatan',
      p_contact_phone: '081355556666',
    });
    // Mobil client2 otomatis mendapat tier 'mobil' (45000).
    assert.equal(sr2.callout_fee_tier, 'mobil');
    assert.equal(sr2.callout_fee_amount, 45000);

    const { error: debtBlockErr } = await mechanic2.rpc('accept_service_request', {
      p_request_id: sr2.id,
    });
    assert.ok(debtBlockErr?.message.includes('COMMISSION_DEBT_LIMIT_EXCEEDED'));

    // Turunkan kembali hutang ke 22500 untuk menguji pelunasan otomatis saat earning online matang.
    await serviceClient
      .from('mechanic_wallets')
      .update({ commission_debt: 22500 })
      .eq('mechanic_id', USERS.mechanic2.id);

    await mechanic1.rpc('accept_service_request', { p_request_id: sr2.id });
    await client2.rpc('respond_to_assignment', { p_request_id: sr2.id, p_action: 'accept' });
    await mechanic1.rpc('transition_order_status', { p_request_id: sr2.id, p_to_status: 'on_the_way' });
    await mechanic1.rpc('transition_order_status', { p_request_id: sr2.id, p_to_status: 'arrived' });
    await mechanic1.from('order_invoice_items').insert({
      request_id: sr2.id,
      mechanic_id: USERS.mechanic1.id,
      description: 'Tambal ban tubeless',
      amount: 55000,
    });
    await mechanic1.rpc('submit_order_quote', { p_request_id: sr2.id });
    await client2.rpc('respond_to_quote', { p_request_id: sr2.id, p_action: 'approve' });
    const { data: invSr2 } = await mechanic1.rpc('finalize_order_invoice', { p_request_id: sr2.id });
    // 45.000 callout mobil + 55.000 tambal ban = 100.000
    assert.equal(invSr2.price_amount, 100000);

    // Client2 masih punya active order sr2 sehingga tidak bisa membuat sr3 serentak.
    const { data: sr3, error: sr3Err } = await client2.rpc('create_service_request', {
      p_vehicle_id: USERS.client2.vehicleId,
      p_issue_description: 'Aki mobil drop',
      p_lat: -6.216,
      p_lng: 106.851,
      p_address: 'Jl. Kuningan Timur No. 8, Jakarta Selatan',
      p_contact_phone: '081377778888',
    });
    assert.ok(sr3Err, 'Client2 tidak boleh membuat order baru saat masih punya active order');
    assert.equal(sr3, null);

    // Selesaikan sr2 secara online oleh Xendit mock untuk mechanic1.
    const { data: p2 } = await serviceClient
      .from('payments')
      .insert({
        request_id: sr2.id,
        attempt_no: 1,
        amount: 100000,
        platform_fee: 10000,
        net_amount: 90000,
        currency: 'IDR',
        method: 'other',
        status: 'pending',
      })
      .select('id')
      .single();

    const { error: finErr } = await serviceClient.rpc('finalize_payment', { p_payment_id: p2.id });
    assert.ifError(finErr);

    const { data: m1AfterPay } = await serviceClient
      .from('mechanic_profiles')
      .select('total_jobs')
      .eq('profile_id', USERS.mechanic1.id)
      .single();
    assert.equal(m1AfterPay.total_jobs, 1, 'total_jobs mechanic1 harus 1 setelah finalize_payment');

    // Matangkan earning sr2 lalu cek bucket ledger mechanic1 rekonsiliasi 100%.
    await serviceClient
      .from('earnings')
      .update({ available_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('request_id', sr2.id);

    await serviceClient.rpc('release_matured_earnings', {
      p_mechanic_id: USERS.mechanic1.id,
      p_batch_limit: 50,
    });

    const { data: m1Wallet } = await mechanic1.rpc('refresh_my_wallet');
    assert.equal(m1Wallet.available_balance, 90000);
    assert.equal(m1Wallet.pending_balance, 0);

    // Sekarang beri mechanic2 utang 22500 + earning online 90000 untuk memverifikasi auto-offset debt!
    const { data: sr4, error: sr4Err } = await client2.rpc('create_service_request', {
      p_vehicle_id: USERS.client2.vehicleId,
      p_issue_description: 'Ganti busi mobil',
      p_lat: -6.216,
      p_lng: 106.851,
      p_address: 'Jl. Kuningan Timur No. 8, Jakarta Selatan',
      p_contact_phone: '081377778888',
    });
    assert.ifError(sr4Err);

    await mechanic2.rpc('accept_service_request', { p_request_id: sr4.id });
    await client2.rpc('respond_to_assignment', { p_request_id: sr4.id, p_action: 'accept' });
    await mechanic2.rpc('transition_order_status', { p_request_id: sr4.id, p_to_status: 'on_the_way' });
    await mechanic2.rpc('transition_order_status', { p_request_id: sr4.id, p_to_status: 'arrived' });
    await mechanic2.from('order_invoice_items').insert({
      request_id: sr4.id,
      mechanic_id: USERS.mechanic2.id,
      description: 'Busi iridium + pasang',
      amount: 55000,
    });
    await mechanic2.rpc('submit_order_quote', { p_request_id: sr4.id });
    await client2.rpc('respond_to_quote', { p_request_id: sr4.id, p_action: 'approve' });
    await mechanic2.rpc('finalize_order_invoice', { p_request_id: sr4.id });

    const { data: p4 } = await serviceClient
      .from('payments')
      .insert({
        request_id: sr4.id,
        attempt_no: 1,
        amount: 100000,
        platform_fee: 10000,
        net_amount: 90000,
        currency: 'IDR',
        method: 'other',
        status: 'pending',
      })
      .select('id')
      .single();

    await serviceClient.rpc('finalize_payment', { p_payment_id: p4.id });
    const { data: m2AfterSecondPay } = await serviceClient
      .from('mechanic_profiles')
      .select('total_jobs')
      .eq('profile_id', USERS.mechanic2.id)
      .single();
    assert.equal(m2AfterSecondPay.total_jobs, 2, 'total_jobs mechanic2 harus 2 setelah order kedua paid');
    await serviceClient
      .from('earnings')
      .update({ available_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('request_id', sr4.id);

    const { data: m2Wallet } = await mechanic2.rpc('refresh_my_wallet');
    // 90000 net earning otomatis melunasi 22500 utang komisi -> available_balance = 67500, debt = 0.
    assert.equal(m2Wallet.commission_debt, 0);
    assert.equal(m2Wallet.available_balance, 67500);
    assert.equal(m2Wallet.pending_balance, 0);

    // Verifikasi SUM(wallet_transactions.amount) per bucket sama persis dengan kolom wallet.
    const { data: txs } = await serviceClient
      .from('wallet_transactions')
      .select('bucket, amount')
      .eq('mechanic_id', USERS.mechanic2.id);

    const byBucket = { available: 0, pending: 0, held: 0, commission_debt: 0 };
    for (const row of txs) {
      byBucket[row.bucket] = (byBucket[row.bucket] ?? 0) + Number(row.amount);
    }
    assert.equal(byBucket.available, m2Wallet.available_balance);
    assert.equal(byBucket.pending, m2Wallet.pending_balance);
    assert.equal(byBucket.held, m2Wallet.held_balance);
    assert.equal(byBucket.commission_debt, m2Wallet.commission_debt);
  });

  it('enforces AI rate limit and safely reassigns push tokens across users', async () => {
    const r1 = await serviceClient.rpc('check_and_log_ai_rate_limit', {
      p_user_id: USERS.client1.id,
      p_endpoint: 'ai-assistant',
      p_max_per_hour: 2,
      p_max_per_day: 10,
    });
    assert.ifError(r1.error);
    assert.equal(r1.data.allowed, true);

    const r2 = await serviceClient.rpc('check_and_log_ai_rate_limit', {
      p_user_id: USERS.client1.id,
      p_endpoint: 'ai-assistant',
      p_max_per_hour: 2,
      p_max_per_day: 10,
    });
    assert.equal(r2.data.allowed, true);

    const r3 = await serviceClient.rpc('check_and_log_ai_rate_limit', {
      p_user_id: USERS.client1.id,
      p_endpoint: 'ai-assistant',
      p_max_per_hour: 2,
      p_max_per_day: 10,
    });
    assert.equal(r3.data.allowed, false);
    assert.ok(r3.data.retry_after_seconds >= 60);

    const token = 'ExponentPushToken[montirgo-test-token-1]';
    const u1 = await client1.rpc('upsert_my_push_token', {
      p_token: token,
      p_platform: 'android',
      p_device_name: 'Pixel 8',
    });
    assert.ifError(u1.error);
    assert.equal(u1.data.user_id, USERS.client1.id);

    // User berbeda login di device yang sama -> token berpindah kepemilikan dengan aman.
    const u2 = await client2.rpc('upsert_my_push_token', {
      p_token: token,
      p_platform: 'android',
      p_device_name: 'Pixel 8',
    });
    assert.ifError(u2.error);
    assert.equal(u2.data.user_id, USERS.client2.id);

    const { data: c1Tokens } = await client1
      .from('device_push_tokens')
      .select('id')
      .eq('expo_push_token', token);
    assert.equal(c1Tokens.length, 0);

    const deact = await client2.rpc('deactivate_my_push_token', { p_token: token });
    assert.ifError(deact.error);

    const { data: c2TokenRow } = await client2
      .from('device_push_tokens')
      .select('is_active')
      .eq('expo_push_token', token)
      .single();
    assert.equal(c2TokenRow.is_active, false);
  });

  it('enforces callout lock, Digital Approval revision/addon/callout_only, quote-photos RLS & vehicle privacy', async () => {
    // 1. Verifikasi platform_settings callout tiers >= min_order_price & cs_whatsapp_number.
    const { data: settingsRows } = await client1
      .from('platform_settings')
      .select('key, value')
      .in('key', [
        'min_order_price',
        'callout_fee_motor',
        'callout_fee_mobil',
        'callout_fee_derek',
        'cs_whatsapp_number',
      ]);
    const settings = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
    const minPrice = Number(settings.min_order_price);
    assert.ok(Number(settings.callout_fee_motor) >= minPrice);
    assert.ok(Number(settings.callout_fee_mobil) >= minPrice);
    assert.ok(Number(settings.callout_fee_derek) >= minPrice);
    assert.ok(settings.cs_whatsapp_number.length >= 8);

    // 2. Montir mengisi vehicle_label & vehicle_plate; pastikan TIDAK bocor di mechanic_directory / list_nearby_mechanics.
    const { error: vehUpdErr } = await mechanic1
      .from('mechanic_profiles')
      .update({ vehicle_label: 'Honda Beat Hitam', vehicle_plate: 'B 9999 XYZ' })
      .eq('profile_id', USERS.mechanic1.id);
    assert.ifError(vehUpdErr);

    const { data: dirRows } = await client1
      .from('mechanic_directory')
      .select('*')
      .eq('profile_id', USERS.mechanic1.id);
    assert.equal(dirRows.length, 1);
    assert.equal('vehicle_plate' in dirRows[0], false);
    assert.equal('vehicle_label' in dirRows[0], false);

    const { data: nearbyMechs } = await client1.rpc('list_nearby_mechanics', {
      p_lat: -6.2088,
      p_lng: 106.8456,
      p_radius_km: 15,
      p_limit: 5,
    });
    assert.equal('vehicle_plate' in nearbyMechs[0], false);

    // Sebelum penugasan, client1 tidak melihat mechanic1 di mechanic_assignment_profile.
    const { data: preAssignProf } = await client1
      .from('mechanic_assignment_profile')
      .select('profile_id, vehicle_label, vehicle_plate')
      .eq('profile_id', USERS.mechanic1.id);
    assert.equal(preAssignProf.length, 0);

    // 3. Client1 buat request tier 'derek' -> biaya panggil = 100000.
    const { data: srDerek, error: derekErr } = await client1.rpc('create_service_request', {
      p_vehicle_id: USERS.client1.vehicleId,
      p_issue_description: 'Motor mati total dan perlu diderek',
      p_lat: -6.21,
      p_lng: 106.846,
      p_address: 'Jl. Thamrin No. 1, Jakarta Pusat',
      p_contact_phone: '081299991111',
      p_callout_fee_tier: 'derek',
    });
    assert.ifError(derekErr);
    assert.equal(srDerek.callout_fee_tier, 'derek');
    assert.equal(srDerek.callout_fee_amount, 100000);

    await mechanic1.rpc('accept_service_request', { p_request_id: srDerek.id });

    // Pasca-penugasan, vehicle_label & vehicle_plate tampil untuk client1 di mechanic_assignment_profile & assigned_order_mechanic_view.
    const { data: postAssignProf } = await client1
      .from('mechanic_assignment_profile')
      .select('profile_id, vehicle_label, vehicle_plate')
      .eq('profile_id', USERS.mechanic1.id)
      .single();
    assert.equal(postAssignProf.vehicle_label, 'Honda Beat Hitam');
    assert.equal(postAssignProf.vehicle_plate, 'B 9999 XYZ');

    const { data: assignedView } = await client1
      .from('assigned_order_mechanic_view')
      .select('request_id, vehicle_label, vehicle_plate')
      .eq('request_id', srDerek.id)
      .single();
    assert.equal(assignedView.vehicle_plate, 'B 9999 XYZ');

    await client1.rpc('respond_to_assignment', { p_request_id: srDerek.id, p_action: 'accept' });
    await mechanic1.rpc('transition_order_status', { p_request_id: srDerek.id, p_to_status: 'on_the_way' });
    await mechanic1.rpc('transition_order_status', { p_request_id: srDerek.id, p_to_status: 'arrived' });

    // 4. Baris callout_fee otomatis ada dan terkunci dari edit/hapus/insert langsung.
    const { data: itemsAtArrival } = await mechanic1
      .from('order_invoice_items')
      .select('*')
      .eq('request_id', srDerek.id);
    const calloutItem = itemsAtArrival.find((i) => i.item_type === 'callout_fee');
    assert.ok(calloutItem, 'Baris callout_fee wajib terbuat saat arrived');
    assert.equal(calloutItem.amount, 100000);
    assert.equal(calloutItem.is_locked, true);

    const { data: delCalloutRows, error: delCalloutErr } = await mechanic1
      .from('order_invoice_items')
      .delete()
      .eq('id', calloutItem.id)
      .select('id');
    assert.ok(Boolean(delCalloutErr) || (delCalloutRows ?? []).length === 0, 'Hapus callout_fee harus ditolak');

    const { data: updCalloutRows, error: updCalloutErr } = await mechanic1
      .from('order_invoice_items')
      .update({ amount: 10000 })
      .eq('id', calloutItem.id)
      .select('id');
    assert.ok(
      Boolean(updCalloutErr) || (updCalloutRows ?? []).length === 0,
      'Ubah nominal callout_fee harus ditolak',
    );

    const { error: spoofCalloutErr } = await mechanic1.from('order_invoice_items').insert({
      request_id: srDerek.id,
      mechanic_id: USERS.mechanic1.id,
      description: 'Palsu',
      amount: 15000,
      item_type: 'callout_fee',
      is_locked: true,
    });
    assert.ok(spoofCalloutErr, 'Insert langsung item callout_fee/is_locked harus ditolak');

    // 5. Storage `quote-photos`: upload oleh montir tertugas OK, signed URL partisipan OK, pihak luar ditolak.
    const photoPath = `${srDerek.id}/${USERS.mechanic1.id}/evidence.jpg`;
    const sampleBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const { error: uploadOkErr } = await mechanic1.storage
      .from('quote-photos')
      .upload(photoPath, sampleBytes, { contentType: 'image/jpeg', upsert: true });
    assert.ifError(uploadOkErr);

    const { error: uploadOutsiderErr } = await mechanic2.storage
      .from('quote-photos')
      .upload(`${srDerek.id}/${USERS.mechanic2.id}/hack.jpg`, sampleBytes, { contentType: 'image/jpeg' });
    assert.ok(uploadOutsiderErr, 'Montir luar tidak boleh upload ke order orang lain');

    const { data: signedClient1, error: signClient1Err } = await client1.storage
      .from('quote-photos')
      .createSignedUrl(photoPath, 60);
    assert.ifError(signClient1Err);
    assert.ok(signedClient1?.signedUrl);

    const { data: outsiderSigned, error: outsiderSignErr } = await client2.storage
      .from('quote-photos')
      .createSignedUrl(photoPath, 60);
    assert.ok(outsiderSignErr || !outsiderSigned?.signedUrl, 'Client luar tidak boleh membaca quote-photos');

    // 6. Tambah item jasa -> submit quote -> cancel blocked before expiry -> revision -> approve -> mid-repair add-on -> callout_only.
    await mechanic1.from('order_invoice_items').insert({
      request_id: srDerek.id,
      mechanic_id: USERS.mechanic1.id,
      description: 'Angkut motor ke bengkel',
      amount: 200000,
      item_type: 'service',
    });

    const { data: submitted, error: subErr } = await mechanic1.rpc('submit_order_quote', {
      p_request_id: srDerek.id,
      p_photo_paths: [photoPath],
    });
    assert.ifError(subErr);
    assert.equal(submitted.quote_status, 'pending_approval');

    const { error: cancelPendingErr } = await mechanic1.rpc('cancel_order', {
      p_request_id: srDerek.id,
      p_reason: 'Coba batal saat menunggu',
    });
    assert.ok(cancelPendingErr?.message.includes('QUOTE_APPROVAL_PENDING'));

    const { data: revReq, error: revErr } = await client1.rpc('respond_to_quote', {
      p_request_id: srDerek.id,
      p_action: 'request_revision',
      p_note: 'Cek ulang biaya derek',
    });
    assert.ifError(revErr);
    assert.equal(revReq.quote_status, 'draft');
    assert.equal(revReq.quote_revision_note, 'Cek ulang biaya derek');

    await mechanic1.rpc('submit_order_quote', { p_request_id: srDerek.id });
    const { data: approvedReq } = await client1.rpc('respond_to_quote', {
      p_request_id: srDerek.id,
      p_action: 'approve',
    });
    assert.equal(approvedReq.quote_status, 'approved');

    // Mid-repair add-on mengembalikan ke pending_approval.
    const { data: addonReq, error: addonErr } = await mechanic1.rpc('request_quote_addon', {
      p_request_id: srDerek.id,
      p_description: 'Kabel spul putus',
      p_amount: 75000,
      p_item_type: 'addon',
      p_photo_paths: [photoPath],
    });
    assert.ifError(addonErr);
    assert.equal(addonReq.quote_status, 'pending_approval');

    // Client menolak & memilih bayar Biaya Panggil Saja (`callout_only`).
    const { data: calloutOnlyReq, error: calloutOnlyErr } = await client1.rpc('respond_to_quote', {
      p_request_id: srDerek.id,
      p_action: 'callout_only',
      p_note: 'Tidak jadi perbaikan, bayar panggil saja',
    });
    assert.ifError(calloutOnlyErr);
    assert.equal(calloutOnlyReq.status, 'payment');
    assert.equal(calloutOnlyReq.quote_status, 'callout_only');
    assert.equal(calloutOnlyReq.price_amount, 100000);
    assert.ok(calloutOnlyReq.rejected_quote_snapshot?.items?.length === 2);

    // Reopen invoice harus ditolak pada callout_only.
    const { error: reopenLockedErr } = await mechanic1.rpc('reopen_order_invoice', {
      p_request_id: srDerek.id,
    });
    assert.ok(reopenLockedErr?.message.includes('CALLOUT_ONLY_LOCKED'));

    // Bayar tunai pada callout_only: komisi 10% standar, review & complaint tetap terbuka, total_jobs TIDAK naik!
    const { data: m1JobsBefore } = await serviceClient
      .from('mechanic_profiles')
      .select('total_jobs')
      .eq('profile_id', USERS.mechanic1.id)
      .single();

    await client1.rpc('choose_payment_method', { p_request_id: srDerek.id, p_method: 'cash' });
    const { data: calloutPay, error: calloutPayErr } = await serviceClient.rpc('confirm_cash_payment', {
      p_request_id: srDerek.id,
      p_mechanic_id: USERS.mechanic1.id,
    });
    assert.ifError(calloutPayErr);
    assert.equal(calloutPay.amount, 100000);
    assert.equal(calloutPay.platform_fee, 10000);

    const { data: m1JobsAfter } = await serviceClient
      .from('mechanic_profiles')
      .select('total_jobs')
      .eq('profile_id', USERS.mechanic1.id)
      .single();
    assert.equal(
      m1JobsAfter.total_jobs,
      m1JobsBefore.total_jobs,
      'Order callout_only tidak boleh menambah total_jobs montir',
    );

    const { error: coReviewErr } = await client1.from('reviews').insert({
      request_id: srDerek.id,
      client_id: USERS.client1.id,
      mechanic_id: USERS.mechanic1.id,
      rating: 4,
      comment: 'Datang cepat meski tidak jadi servis',
    });
    assert.ifError(coReviewErr);

    const { error: coComplaintErr } = await client1.from('complaints').insert({
      reporter_id: USERS.client1.id,
      reporter_role: 'client',
      request_id: srDerek.id,
      category: 'pembayaran',
      subject: 'Konfirmasi biaya panggil derek',
      description: 'Pengujian bahwa keluhan tetap terbuka pada transaksi callout_only.',
    });
    assert.ifError(coComplaintErr);

    // 7. Escape hatch: setelah quote_expires_at lewat, montir boleh membatalkan dengan alasan & is_available kembali true.
    const { data: srTimeout } = await client2.rpc('create_service_request', {
      p_vehicle_id: USERS.client2.vehicleId,
      p_issue_description: 'Test timeout estimasi',
      p_lat: -6.21,
      p_lng: 106.846,
      p_address: 'Jl. Merdeka No. 1, Jakarta Pusat',
      p_contact_phone: '081399990000',
    });
    await mechanic1.rpc('accept_service_request', { p_request_id: srTimeout.id });
    await client2.rpc('respond_to_assignment', { p_request_id: srTimeout.id, p_action: 'accept' });
    await mechanic1.rpc('transition_order_status', { p_request_id: srTimeout.id, p_to_status: 'on_the_way' });
    await mechanic1.rpc('transition_order_status', { p_request_id: srTimeout.id, p_to_status: 'arrived' });
    await mechanic1.from('order_invoice_items').insert({
      request_id: srTimeout.id,
      mechanic_id: USERS.mechanic1.id,
      description: 'Cek aki',
      amount: 30000,
    });
    await mechanic1.rpc('submit_order_quote', { p_request_id: srTimeout.id });

    // Simulasikan quote_expires_at sudah lewat.
    await serviceClient
      .from('service_requests')
      .update({ quote_expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('id', srTimeout.id);

    const { data: cancelledTimeout, error: timeoutCancelErr } = await mechanic1.rpc('cancel_order', {
      p_request_id: srTimeout.id,
      p_reason: 'Client tidak merespons estimasi lebih dari 15 menit',
    });
    assert.ifError(timeoutCancelErr);
    assert.equal(cancelledTimeout.status, 'cancelled');

    const { data: m1AfterCancel } = await serviceClient
      .from('mechanic_profiles')
      .select('is_available')
      .eq('profile_id', USERS.mechanic1.id)
      .single();
    assert.equal(m1AfterCancel.is_available, true);
  });
});
