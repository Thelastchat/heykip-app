// RevenueCat → HeyKip: the only way Plus is turned on or off (DPLA 3.3.1(C), Attachment 2). RevenueCat checks every
// App Store receipt with Apple, then sends its notice here; this writes the plan as the service role (the database
// lets nothing else change it — guard_plan). Deploy with JWT verification off: RevenueCat signs in with the shared
// secret in REVENUECAT_WEBHOOK_AUTH instead (set the same value as the webhook's Authorization header in RevenueCat).
//
// The app's RevenueCat user id is the HeyKip account id (lib/purchases.ts), so app_user_id is a profiles.id.
// Events can arrive late or out of order, so nothing goes backwards: a newer end date always wins.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ENTITLEMENT = 'heykip_plus';
/** Events after which Plus is on until expiration_at_ms (a cancellation still runs to the end of the paid period). */
const ACTIVE = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'CANCELLATION',
  'BILLING_ISSUE',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RcEvent = {
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  entitlement_ids?: string[] | null;
  entitlement_id?: string | null;
  period_type?: string;
  product_id?: string;
  expiration_at_ms?: number | null;
  store?: string;
  environment?: string;
  transferred_from?: string[];
  transferred_to?: string[];
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/** The HeyKip account an event is about: the first id that is one (anonymous RevenueCat ids are skipped). */
function accountOf(e: RcEvent): string | null {
  for (const id of [e.app_user_id, e.original_app_user_id, ...(e.aliases ?? [])]) if (id && UUID.test(id)) return id;
  return null;
}

type Admin = ReturnType<typeof createClient>;

/**
 * Plus for one account as RevenueCat has it now (REST API v1, with the secret key in REVENUECAT_SECRET_KEY — never in
 * the app). Used where a notice has no end date of its own: a transfer.
 */
async function syncFromRevenueCat(admin: Admin, id: string): Promise<string> {
  const key = Deno.env.get('REVENUECAT_SECRET_KEY');
  if (!key) return 'no secret key';
  const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) return `revenuecat ${r.status}`;
  const sub = (await r.json())?.subscriber;
  const ent = sub?.entitlements?.[ENTITLEMENT] as { expires_date?: string | null; product_identifier?: string } | undefined;
  const ends = ent?.expires_date ? new Date(ent.expires_date) : null;
  if (!ent || !ends || ends <= new Date()) return 'no active Plus';
  const trial = sub?.subscriptions?.[ent.product_identifier ?? '']?.period_type === 'trial';
  const paid = /year/i.test(ent.product_identifier ?? '') ? 'yearly' : 'monthly';
  const { error } = await admin
    .from('profiles')
    .update(trial ? { plan: 'trial', trial_ends_at: ends.toISOString(), trial_used: true, plan_until: null } : { plan: paid, plan_until: ends.toISOString(), trial_used: true })
    .eq('id', id);
  return error ? error.message : trial ? 'trial' : paid;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  if (!secret || req.headers.get('Authorization') !== secret) return json({ error: 'unauthorized' }, 401);

  let event: RcEvent;
  try {
    event = (await req.json()).event as RcEvent;
  } catch {
    return json({ error: 'bad body' }, 400);
  }
  if (!event?.type) return json({ error: 'no event' }, 400);
  if (event.type === 'TEST') return json({ ok: true, test: true });
  // RevenueCat's Test Store (Expo Go, no money) only counts while testing is switched on for this project.
  if (event.store === 'TEST_STORE' && Deno.env.get('HEYKIP_ALLOW_TEST_STORE') !== 'on') return json({ ok: true, ignored: 'test store' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    if (event.type === 'TRANSFER') {
      // "Restore purchases" moved Plus to another HeyKip account (same Apple ID). The old one loses it; the notice
      // carries no end date, so the new one's is asked from RevenueCat and Plus turns on now, not at the next renewal.
      for (const id of event.transferred_from ?? []) if (UUID.test(id)) await admin.from('profiles').update({ plan: 'free', plan_until: null }).eq('id', id);
      const synced: Record<string, string> = {};
      for (const id of event.transferred_to ?? []) if (UUID.test(id)) synced[id] = await syncFromRevenueCat(admin, id);
      return json({ ok: true, synced });
    }

    const id = accountOf(event);
    if (!id) return json({ ok: true, ignored: 'no HeyKip account' });
    const forPlus = (event.entitlement_ids ?? (event.entitlement_id ? [event.entitlement_id] : [])).includes(ENTITLEMENT);
    if (!forPlus) return json({ ok: true, ignored: 'not Plus' });
    const ends = event.expiration_at_ms ? new Date(event.expiration_at_ms) : null;

    const { data: now, error: readError } = await admin.from('profiles').select('plan, trial_ends_at, plan_until').eq('id', id).maybeSingle();
    if (readError) return json({ error: readError.message }, 500);
    if (!now) return json({ ok: true, ignored: 'no profile' });
    const currentEnd = new Date(now.plan === 'trial' ? (now.trial_ends_at ?? 0) : (now.plan_until ?? 0));

    if (ACTIVE.has(event.type)) {
      if (!ends) return json({ ok: true, ignored: 'no end date' });
      if (now.plan !== 'free' && ends < currentEnd) return json({ ok: true, ignored: 'older notice' });
      const trial = event.period_type === 'TRIAL';
      const paid = /year/i.test(event.product_id ?? '') ? 'yearly' : 'monthly';
      const { error } = await admin
        .from('profiles')
        .update(trial ? { plan: 'trial', trial_ends_at: ends.toISOString(), trial_used: true, plan_until: null } : { plan: paid, plan_until: ends.toISOString(), trial_used: true })
        .eq('id', id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, plan: trial ? 'trial' : paid });
    }

    if (event.type === 'EXPIRATION') {
      // Only if nothing newer has come in since (a renewal that arrived first keeps Plus on).
      if (ends && ends < currentEnd) return json({ ok: true, ignored: 'superseded' });
      const { error } = await admin.from('profiles').update({ plan: 'free', plan_until: null }).eq('id', id);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, plan: 'free' });
    }

    return json({ ok: true, ignored: event.type });
  } catch (e) {
    return json({ error: String(e).slice(0, 200) }, 500);
  }
});
