// A small in-memory Supabase for the screen tests: auth (email code), every table the app reads and writes,
// the three money RPCs, storage, and the edge functions (answered as "offline" so the app's fallbacks get tested).
// Nothing here talks to the real project, so the tests use none of HeyKip's Supabase requests.
const UID = '11111111-2222-3333-4444-555555555555';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const JWT = b64({ alg: 'HS256' }) + '.' + b64({ sub: UID, exp: 9999999999, role: 'authenticated', email: 'koy@test.dev' }) + '.x';
const user = { id: UID, email: 'koy@test.dev', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
const session = { access_token: JWT, refresh_token: 'r', expires_at: 9999999999, expires_in: 3600, token_type: 'bearer', user };

const SPEND = ['food', 'transport', 'shopping', 'fun', 'health_beauty', 'home_bills', 'travel', 'family_pets', 'giving', 'learning', 'installments', 'other'];
const INCOME = ['pay', 'side_gigs', 'gifts', 'other'];

function makeDb(extra = {}) {
  return {
    profiles: [{ id: UID, display_name: 'Koy', avatar_url: null, onboarded: true, plan: 'free', split_when_paid: false, budget: null, safety_saved: 0, ...extra.profile }],
    categories: [...SPEND.map((key) => ({ id: 'spend-' + key, kind: 'spend', key, user_id: null })), ...INCOME.map((key) => ({ id: 'income-' + key, kind: 'income', key, user_id: null }))],
    goals: extra.goals ?? [],
    promises: extra.promises ?? [],
    transactions: extra.transactions ?? [],
    goal_moves: [],
    safety_moves: [],
    writes: [],
  };
}

/** A transaction row the way the app stores it. */
function tx(kind, cat, amount, when, note = null, job = null) {
  return {
    id: 't-' + Math.random().toString(36).slice(2, 9),
    user_id: UID,
    kind,
    amount,
    category_id: (kind === 'income' ? 'income-' : 'spend-') + cat,
    occurred_at: when.toISOString(),
    created_at: when.toISOString(),
    note,
    source: 'manual',
    job,
  };
}

function filt(rows, url) {
  for (const [k, v] of url.searchParams) {
    if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(k)) continue;
    const not = v.startsWith('not.');
    const val = not ? v.slice(4) : v;
    let test;
    const inm = val.match(/^in\.\((.*)\)$/);
    if (inm) {
      const set = inm[1].split(',').map((x) => x.replace(/^"|"$/g, ''));
      test = (r) => set.includes(String(r[k]));
    } else if (val.startsWith('is.')) {
      const w = val.slice(3);
      test = (r) => (w === 'null' ? r[k] === null || r[k] === undefined : String(r[k]) === w);
    } else {
      const m = val.match(/^(eq|neq|gte|lte|lt|gt)\.(.*)$/);
      if (!m) continue;
      const c = (a) => (typeof a === 'number' || /^-?\d+(\.\d+)?$/.test(m[2]) ? Number(a) : String(a));
      const b = c(m[2]);
      test = (r) => {
        const a = c(r[k]);
        return { eq: a === b, neq: a !== b, gte: a >= b, lte: a <= b, lt: a < b, gt: a > b }[m[1]];
      };
    }
    rows = rows.filter((r) => (not ? !test(r) : test(r)));
  }
  return rows;
}

async function install(page, db) {
  await page.route('**/auth/v1/**', (r) => {
    const u = r.request().url();
    if (u.includes('/otp')) return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    if (u.includes('/logout')) return r.fulfill({ status: 204, body: '' });
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(u.includes('/user') ? user : session) });
  });
  await page.route('**/functions/v1/**', (r) => {
    db.writes.push('function ' + r.request().url().split('/functions/v1/')[1]);
    return r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'offline in tests' }) });
  });
  await page.route('**/storage/v1/**', (r) => {
    const u = r.request().url();
    if (u.includes('/object/sign/')) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ signedURL: '/object/sign/x?token=t' }) });
    db.writes.push('storage ' + u.split('/object/')[1]);
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: 'k' }) });
  });
  await page.route('**/rest/v1/**', async (r) => {
    const req = r.request();
    const url = new URL(req.url());
    const table = url.pathname.split('/').pop();
    const single = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    const m = req.method();
    const json = (status, body) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname.includes('/rpc/')) {
      const a = JSON.parse(req.postData() || '{}');
      const p = db.profiles[0];
      if (table === 'put_in_safety') {
        const have = Number(p.safety_saved || 0);
        const moved = Math.max(a.p_amount, -have);
        p.safety_saved = have + moved;
        db.safety_moves.unshift({ id: 'sm' + Date.now(), user_id: UID, amount: moved, kind: a.p_kind || 'manual', reason: a.p_reason || null, created_at: new Date().toISOString() });
        db.writes.push('rpc put_in_safety ' + moved);
        return json(200, p.safety_saved);
      }
      const g = db.goals.find((x) => x.id === a.p_goal);
      if (!g) return json(400, { message: 'goal not found' });
      if (table === 'put_in_goal') {
        g.saved_amount = Number(g.saved_amount) + a.p_amount;
        db.goal_moves.unshift({
          id: 'm' + Date.now(),
          goal_id: a.p_goal,
          user_id: UID,
          amount: a.p_amount,
          source: a.p_source,
          from_kind: a.p_from,
          note: a.p_note ?? null,
          moved_at: new Date().toISOString(),
        });
        db.writes.push('rpc put_in_goal ' + a.p_amount);
        return json(200, g.saved_amount);
      }
      if (table === 'take_from_goal') {
        const take = Math.min(Number(g.saved_amount), a.p_amount);
        g.saved_amount = Number(g.saved_amount) - take;
        db.writes.push('rpc take_from_goal ' + take);
        return json(200, g.saved_amount);
      }
      return json(404, { message: 'no such rpc' });
    }
    let rows = (db[table] ??= []);
    if (m === 'POST') {
      const body = JSON.parse(req.postData());
      const arr = Array.isArray(body) ? body : [body];
      const upsert = (req.headers()['prefer'] || '').includes('merge-duplicates');
      const out = arr.map((x) => {
        const hit = upsert && x.id ? rows.find((y) => y.id === x.id) : null;
        if (hit) return Object.assign(hit, x);
        const row = { created_at: new Date().toISOString(), ...x, id: x.id ?? 'id-' + Math.random().toString(36).slice(2, 8) };
        rows.push(row);
        return row;
      });
      db.writes.push(`insert ${table}`);
      return json(201, single ? out[0] : out);
    }
    if (m === 'PATCH') {
      const body = JSON.parse(req.postData());
      const hit = filt(rows, url);
      hit.forEach((x) => Object.assign(x, body));
      db.writes.push(`update ${table} ${Object.keys(body).join(',')}`);
      return json(200, single ? hit[0] : hit);
    }
    if (m === 'DELETE') {
      const hit = new Set(filt(rows, url));
      db[table] = rows.filter((x) => !hit.has(x));
      db.writes.push(`delete ${table} ${hit.size}`);
      return json(200, [...hit]);
    }
    let out = filt(rows, url);
    const order = url.searchParams.get('order');
    if (order) {
      const [k, dir] = order.split('.');
      out = [...out].sort((a, b) => {
        const x = a[k] ?? null,
          y = b[k] ?? null;
        if (x === y) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
        return dir === 'desc' ? -c : c;
      });
    }
    if (table === 'transactions') out = out.map((t) => ({ ...t, categories: { key: t.cat ?? (db.categories.find((c) => c.id === t.category_id) || {}).key } }));
    const limit = Number(url.searchParams.get('limit') || 0);
    if (limit) out = out.slice(0, limit);
    if (single) return out.length ? json(200, out[0]) : json(406, { code: 'PGRST116', message: 'no rows' });
    return json(200, out);
  });
}

module.exports = { UID, session, makeDb, install, tx };
