// =====================================================================
// khan-start · «Хан тағы» кезеңін бастау
// Supabase → Edge Functions → Deploy a new function → Via Editor → аты: khan-start
// Клиентке сұрақтар ДҰРЫС ЖАУАПСЫЗ беріледі.
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

// ---- ортақ бөлік (әр функцияда бірдей) ----
// Сайттың мекенжайы Supabase Secrets-те: SITE_ORIGIN = https://ЛОГИН.github.io (соңында / жоқ)
const ALLOWED_ORIGINS = [
  (Deno.env.get('SITE_ORIGIN') ?? '').replace(/\/+$/, ''),
  'http://localhost:5500',
  'http://127.0.0.1:5500',
].filter(Boolean);
function cors(req: Request): Record<string, string> {
  const o = req.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(o) ? o : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}
function secretKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}');
    if (keys.default) return keys.default;
    const first = Object.values(keys)[0];
    if (typeof first === 'string') return first;
  } catch (_) { /* legacy */ }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
}
const admin = createClient(Deno.env.get('SUPABASE_URL')!, secretKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
});
async function getUser(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error || !data?.user ? null : data.user;
}
function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });
}
async function readBody(req: Request): Promise<Record<string, unknown> | null> {
  const text = await req.text();
  if (text.length > 4096) return null;
  try { const b = JSON.parse(text); return b && typeof b === 'object' && !Array.isArray(b) ? b : null; } catch { return null; }
}
// ---- /ортақ бөлік ----

type Q = { id: string; type: string; prompt: string; data: unknown };
// Қиындық жүйесі: «Тарихи шешім» тапсырмаларының түрі кезең сайын күрделенеді
const DECISION_TYPES: string[][] = [[],
  ['single', 'fill', 'single'], ['single', 'match', 'fill'], ['single', 'order', 'match'], ['map', 'single', 'order'],
  ['map', 'match', 'fill'], ['image', 'order', 'map'], ['image', 'match', 'fill'], ['order', 'map', 'image'],
  ['match', 'image', 'fill'], ['map', 'order', 'image']];
const START_COOLDOWN_MS = 15_000;
function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });
  const user = await getUser(req);
  if (!user) return json(req, 401, { error: 'unauthorized' });
  const body = await readBody(req);
  if (!body) return json(req, 400, { error: 'bad_request' });
  const stage = body.stage, khan = body.khan_idx;
  if (!Number.isInteger(stage) || (stage as number) < 1 || (stage as number) > 10) return json(req, 400, { error: 'bad_stage' });
  if (!Number.isInteger(khan) || (khan as number) < 0 || (khan as number) > 9) return json(req, 400, { error: 'bad_char' });

  const meta = user.user_metadata ?? {};
  await admin.from('profiles').upsert({
    id: user.id, email: user.email,
    full_name: String(meta.full_name ?? meta.name ?? (user.email ?? 'Студент').split('@')[0]).slice(0, 60),
    avatar_url: meta.avatar_url ?? null,
  }, { onConflict: 'id', ignoreDuplicates: true });

  // Кезеңдер ретімен ашылады: алдыңғысын жеңу керек (админге бәрі ашық)
  if ((stage as number) > 1) {
    const { data: prof } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (!prof?.is_admin) {
      const { count: done } = await admin.from('khan_games').select('id', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('stage', (stage as number) - 1).eq('status', 'won');
      if (!done) return json(req, 403, { error: 'stage_locked' });
    }
  }

  // Rate limiting: 15 секундта бір кезеңнен артық емес
  const since = new Date(Date.now() - START_COOLDOWN_MS).toISOString();
  const { count: recent } = await admin.from('khan_games').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).gte('started_at', since);
  if ((recent ?? 0) > 0) return json(req, 429, { error: 'rate_limit', retry_after_s: 15 });

  await admin.from('khan_games').update({ status: 'abandoned', finished_at: new Date().toISOString() })
    .eq('user_id', user.id).eq('status', 'active');

  const { data: qs, error: qErr } = await admin.from('khan_questions')
    .select('id,type,prompt,data').eq('stage', stage).eq('active', true);
  if (qErr || !qs || qs.length < 6) return json(req, 500, { error: 'not_enough_questions' });

  const pool = shuffle((qs as Q[]).slice());
  const used = new Set<string>();
  const take = (pred: (q: Q) => boolean): Q => {
    const q = pool.find((x) => !used.has(x.id) && pred(x)) ?? pool.find((x) => !used.has(x.id));
    if (q) used.add(q.id);
    return q as Q;
  };
  const decisions = DECISION_TYPES[stage as number].map((t) => take((q) => q.type === t));
  const med = [0, 1, 2].map(() => take((q) => q.type === 'single' || q.type === 'fill'));

  const { data: game, error: gErr } = await admin.from('khan_games').insert({
    user_id: user.id, stage, khan_idx: khan, question_ids: [...decisions, ...med].map((q) => q.id),
  }).select('id, started_at').single();
  if (gErr || !game) return json(req, 500, { error: 'game_create_failed' });

  const pub = (q: Q) => ({ id: q.id, type: q.type, prompt: q.prompt, data: q.data });
  return json(req, 200, { game_id: game.id, started_at: game.started_at, decisions: decisions.map(pub), med: med.map(pub) });
});
