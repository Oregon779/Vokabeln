// Supabase-Attrappe fuer Playwright: ersetzt @supabase/supabase-js, Daten im Speicher.
// window.__MOCK = { user: 'admin' | 'user' | null, settings: {...} } vor dem Laden setzen.
(function(){
  const CFG = window.__MOCK || {};
  const now = Date.now(), D = 86400000;
  const iso = (t) => new Date(t).toISOString();
  let seq = 1; const uid = () => 'id-' + (seq++);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
  const ADMIN = { id: 'u-admin', email: 'janek@example.com' };
  const USER = { id: 'u-1', email: 'lea.martin@example.com' };
  const names = [
    ['u-admin', 'Janek', 'janek@example.com', 60, { is_admin: true, avatar_kind: 'avatar', avatar_config: { v: 1 } }],
    ['u-1', 'Léa Martin', 'lea.martin@example.com', 1, { plan: 'plus', plan_until: iso(now + 40 * D), avatar_kind: 'avatar', avatar_config: { v: 1 } }],
    ['u-2', 'Noah Becker', 'noah.b@example.com', 2, { photo_status: 'pending', photo_pending_path: 'u-2/a.webp', avatar_kind: 'photo' }],
    ['u-3', 'Emma Schulz', 'emma.s@example.com', 3, {}],
    ['u-4', 'Lucas Petit', 'lucas.p@example.com', 5, { plan: 'pro', plan_until: iso(now + 200 * D) }],
    ['u-5', 'Mia Wagner', 'mia.w@example.com', 8, { banned: true, ban_reason: 'Spam in der Rangliste', banned_until: iso(now + 3 * D) }],
    ['u-6', 'Ben Hoffmann', 'ben.h@example.com', 12, { ai_requests_today: 14, ai_requests_date: today }],
    ['u-7', 'Chloé Dubois', 'chloe.d@example.com', 19, { photo_status: 'pending', photo_pending_path: 'u-7/b.webp', avatar_kind: 'photo' }],
    ['u-8', 'Paul Richter', 'paul.r@example.com', 26, {}],
  ];
  const profiles = names.map(([id, n, e, ago, extra]) => Object.assign({
    user_id: id, email: e, display_name: n, is_admin: false, banned: false, ai_limit_override: null, ai_requests_today: 3, ai_requests_date: today,
    created_at: iso(now - ago * D - 3600e3 * 5), updated_at: iso(now), plan: null, plan_until: null, plan_reminded_for: null,
    avatar_kind: null, avatar_config: null, photo_path: null, photo_pending_path: null, photo_status: null, photo_reason: null, photo_updated_at: null,
    avatar_locked: false, photo_locked: false, ban_reason: null, banned_until: null, name_locked: false,
  }, extra));
  const sessions = [];
  for(let d = 29; d >= 0; d--){
    const n = Math.round(3 + 6 * Math.abs(Math.sin(d * 1.7)) + (d < 7 ? 4 : 0) + (d % 7 === 2 ? 5 : 0));
    for(let i = 0; i < n; i++){
      const t = now - d * D - Math.random() * 10 * 3600e3;
      const who = profiles[(i * 3 + d) % profiles.length];
      sessions.push({ id: uid(), user_id: i % 3 ? who.user_id : null, display_label: i % 3 ? who.display_name : 'Gast', ip_address: '203.0.113.' + (i + d),
        device_label: ['Safari auf iOS', 'Chrome auf Windows', 'Chrome auf Android', 'Safari auf macOS'][i % 4], created_at: iso(t), last_seen: iso(d === 0 && i < 3 ? now - 60e3 : t + 600e3) });
    }
  }
  const db = {
    profiles,
    site_settings: [Object.assign({ id: 1, maintenance_mode: false, maintenance_message: '', maintenance_until: null,
      feature_maintenance: { home: false, listen: false, rewards: false, grammar: false, calendar: false, appDownload: false, about: false },
      ai_daily_limit: 20, ai_capacity_total: 500, updated_at: iso(now), guest_locked_features: ['rewards', 'grammar', 'listen', 'calendar'],
      game_settings: null, live_build: 38 }, CFG.settings || {})],
    active_sessions: sessions,
    upgrade_requests: [
      { id: 'r1', user_id: 'u-3', email: 'emma.s@example.com', display_name: 'Emma Schulz', plan: 'plus', status: 'offen', kind: 'anfrage', note: 'Für die Abiturvorbereitung', created_at: iso(now - 2 * 3600e3) },
      { id: 'r2', user_id: 'u-1', email: 'lea.martin@example.com', display_name: 'Léa Martin', plan: 'plus', status: 'erledigt', kind: 'anfrage', months: 3, price_cents: 897, decided_at: iso(now - 5 * D), created_at: iso(now - 6 * D) },
      { id: 'r3', user_id: 'u-4', email: 'lucas.p@example.com', display_name: 'Lucas Petit', plan: 'pro', status: 'erledigt', kind: 'anfrage', months: 12, price_cents: 7188, decided_at: iso(now - 9 * D), created_at: iso(now - 10 * D) },
    ],
    user_messages: [], user_data: [], game_records: [], coin_grants: [], game_runs: [],
  };
  window.__MOCKDB = db;
  const listeners = [];
  window.__mockEmit = (table, row) => listeners.filter(l => l.table === table).forEach(l => l.cb({ eventType: 'UPDATE', new: row, old: {} }));

  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  class Q {
    constructor(t){ this.t = t; this.f = []; this.op = null; this.ord = []; this.lim = null; this.off = 0; this._one = 0; this.payload = null; this.cnt = null; this.head = false; this.ret = false; }
    select(cols, opts){ if(!this.op) this.op = 'select'; else this.ret = true; if(opts && opts.count) this.cnt = opts.count; if(opts && opts.head) this.head = true; return this; }
    eq(c, v){ this.f.push(r => r[c] === v); return this; }
    neq(c, v){ this.f.push(r => r[c] !== v); return this; }
    gt(c, v){ this.f.push(r => r[c] != null && cmp(r[c], v) > 0); return this; }
    gte(c, v){ this.f.push(r => r[c] != null && cmp(r[c], v) >= 0); return this; }
    lt(c, v){ this.f.push(r => r[c] != null && cmp(r[c], v) < 0); return this; }
    lte(c, v){ this.f.push(r => r[c] != null && cmp(r[c], v) <= 0); return this; }
    in(c, arr){ this.f.push(r => (arr || []).includes(r[c])); return this; }
    is(c, v){ this.f.push(r => (r[c] == null ? null : r[c]) === v); return this; }
    not(c, op, v){ if(op === 'is') this.f.push(r => (r[c] == null ? null : r[c]) !== v); else if(op === 'eq') this.f.push(r => r[c] !== v); return this; }
    ilike(c, p){ const re = new RegExp('^' + String(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i'); this.f.push(r => re.test(r[c] || '')); return this; }
    like(c, p){ return this.ilike(c, p); }
    or(){ return this; } filter(){ return this; } match(o){ Object.keys(o).forEach(k => this.eq(k, o[k])); return this; } contains(){ return this; }
    order(c, o){ this.ord.push([c, !o || o.ascending !== false, o && o.nullsFirst]); return this; }
    limit(n){ this.lim = n; return this; }
    range(a, b){ this.off = a; this.lim = b - a + 1; return this; }
    maybeSingle(){ this._one = 1; return this; }
    single(){ this._one = 2; return this; }
    insert(rows){ this.op = 'insert'; this.payload = rows; return this; }
    upsert(rows){ this.op = 'upsert'; this.payload = rows; return this; }
    update(obj){ this.op = 'update'; this.payload = obj; return this; }
    delete(){ this.op = 'delete'; return this; }
    then(res, rej){ return new Promise(r => setTimeout(r, 15)).then(() => this.exec()).then(res, rej); }
    exec(){
      const rows = db[this.t] || (db[this.t] = []);
      const hit = rows.filter(r => this.f.every(fn => fn(r)));
      let data = null;
      if(this.op === 'select'){
        data = hit.slice();
        this.ord.slice().reverse().forEach(([c, asc]) => data.sort((a, b) => (a[c] == null) - (b[c] == null) || cmp(a[c], b[c]) * (asc ? 1 : -1)));
        const total = data.length;
        if(this.lim != null) data = data.slice(this.off, this.off + this.lim);
        if(this.head) data = null;
        if(this._one) data = data && data.length ? data[0] : null;
        if(this._one === 2 && !data) return { data: null, error: { message: 'No rows' } };
        return { data: data && JSON.parse(JSON.stringify(data)), error: null, count: this.cnt ? total : null };
      }
      if(this.op === 'update'){ hit.forEach(r => Object.assign(r, this.payload)); data = hit; }
      if(this.op === 'insert' || this.op === 'upsert'){
        const arr = Array.isArray(this.payload) ? this.payload : [this.payload];
        data = arr.map(x => {
          const key = x.id ? 'id' : x.user_id && this.t !== 'user_messages' && this.t !== 'coin_grants' && this.t !== 'upgrade_requests' ? 'user_id' : null;
          const ex = this.op === 'upsert' && key ? rows.find(r => r[key] === x[key]) : null;
          if(ex){ Object.assign(ex, x); return ex; }
          const n = Object.assign({ id: uid(), created_at: iso(Date.now()) }, x); rows.push(n); return n;
        });
      }
      if(this.op === 'delete'){ hit.forEach(r => rows.splice(rows.indexOf(r), 1)); data = hit; }
      if(this._one) data = data && data[0] || null;
      return { data: JSON.parse(JSON.stringify(data)), error: null };
    }
  }
  function createClient(){
    let session = CFG.user === 'admin' ? { user: ADMIN, access_token: 'x' } : CFG.user === 'user' ? { user: USER, access_token: 'x' } : null;
    const authCbs = [];
    const fire = (ev) => authCbs.forEach(cb => { try{ cb(ev, session); }catch(e){ console.error(e); } });
    return {
      from: (t) => new Q(t),
      rpc: async (name, args) => {
        await new Promise(r => setTimeout(r, 15));
        if(name === 'get_capacity') return { data: { used: db.profiles.reduce((a, p) => a + (p.ai_requests_date === today ? p.ai_requests_today : 0), 0), total: db.site_settings[0].ai_capacity_total }, error: null };
        if(name === 'admin_coins') return { data: db.profiles.map((p, i) => ({ user_id: p.user_id, coins: 40 + i * 37, pending: 0 })), error: null };
        if(name === 'public_avatars') return { data: db.profiles.filter(p => (args && args.ids || []).includes(p.user_id)).map(p => ({ user_id: p.user_id, avatar_kind: p.avatar_kind, avatar_config: p.avatar_config, photo_path: p.photo_path })), error: null };
        if(name === 'send_message_to_all') return { data: db.profiles.length, error: null };
        return { data: null, error: null };
      },
      channel: (name) => {
        const ch = { on(kind, filt, cb){ listeners.push({ table: filt && filt.table, cb }); return ch; }, subscribe(cb){ setTimeout(() => cb && cb('SUBSCRIBED'), 20); return ch; }, unsubscribe(){} };
        return ch;
      },
      removeChannel(){},
      functions: { invoke: async (fn, o) => ({ data: { ok: true, results: [{ template: 'Freigeschaltet', to: 'janek@example.com', ok: true }, { template: 'Abgelehnt', to: 'janek@example.com', ok: true }] }, error: null }) },
      storage: { from: () => ({
        getPublicUrl: () => ({ data: { publicUrl: 'icon-round-192.png' } }),
        createSignedUrl: async () => ({ data: { signedUrl: 'icon-round-192.png' }, error: null }),
        upload: async () => ({ data: {}, error: null }), remove: async () => ({ data: {}, error: null }),
        copy: async () => ({ data: {}, error: null }), download: async () => ({ data: new Blob(), error: null }), list: async () => ({ data: [], error: null }),
      }) },
      auth: {
        getSession: async () => ({ data: { session }, error: null }),
        getUser: async () => ({ data: { user: session && session.user }, error: null }),
        onAuthStateChange(cb){ authCbs.push(cb); setTimeout(() => cb('INITIAL_SESSION', session), 0); return { data: { subscription: { unsubscribe(){} } } }; },
        signInWithPassword: async ({ email, password }) => {
          if(password === 'falsch') return { data: {}, error: { message: 'Invalid login credentials' } };
          session = { user: /^janek|^admin/.test(email) ? ADMIN : USER, access_token: 'x' }; fire('SIGNED_IN');
          return { data: { session, user: session.user }, error: null };
        },
        signUp: async () => ({ data: {}, error: null }),
        signOut: async () => { session = null; fire('SIGNED_OUT'); return { error: null }; },
        resetPasswordForEmail: async () => ({ data: {}, error: null }),
        updateUser: async () => ({ data: { user: session && session.user }, error: null }),
        refreshSession: async () => ({ data: { session }, error: null }),
      },
    };
  }
  window.supabase = { createClient };
})();
