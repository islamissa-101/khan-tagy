// =====================================================================
// khan-answer · «Тарихи шешім» және «Медициналық көмек» жауабын СЕРВЕР тексереді
// Supabase → Edge Functions → Deploy a new function → Via Editor → аты: khan-answer
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

type Ans = { question_id: string; kind: string; slot: number | null; correct: boolean };
const MAX_ANSWERS_PER_MIN = 30;
const MAX_MED = 2;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function norm(s: unknown): string {
  return String(s ?? '').toLowerCase()
    .replace(/[«»"'“”]/g, '').replace(/[–—]/g, '-')
    .replace(/\s*(жж|ж|жыл|жылы)\.?\s*$/u, '').replace(/\s+/g, '').trim();
}
function isStrArr(a: unknown, max: number): a is string[] {
  return Array.isArray(a) && a.length <= max && a.every((x) => typeof x === 'string' && x.length <= 120);
}

// deno-lint-ignore no-explicit-any
function check(type: string, answer: any, correct: any): boolean {
  switch (type) {
    case 'single':
    case 'map':
    case 'image':
      return Number.isInteger(answer?.index) && answer.index === correct.index;
    case 'fill':
      return typeof answer?.text === 'string' && answer.text.length <= 40 &&
        (correct.accept as string[]).map(norm).includes(norm(answer.text));
    case 'order':
      return isStrArr(answer?.items, 10) && answer.items.length === correct.items.length &&
        answer.items.every((v: string, i: number) => v === correct.items[i]);
    case 'match': {
      if (!Array.isArray(answer?.pairs) || answer.pairs.length !== correct.pairs.length) return false;
      const want = new Map((correct.pairs as string[][]).map(([l, r]) => [l, r]));
      const seen = new Set<string>();
      for (const p of answer.pairs) {
        if (!isStrArr(p, 2) || p.length !== 2 || seen.has(p[0])) return false;
        seen.add(p[0]);
        if (want.get(p[0]) !== p[1]) return false;
      }
      return seen.size === want.size;
    }
    default:
      return false;
  }
}
// deno-lint-ignore no-explicit-any
function showAnswer(type: string, data: any, correct: any): string {
  if (type === 'single' || type === 'image') return data.options?.[correct.index] ?? '';
  if (type === 'map') return (data.options?.[correct.index] ?? '') + ' — ' + (correct.show ?? '');
  if (type === 'fill') return correct.show ?? correct.accept?.[0] ?? '';
  if (type === 'order') return correct.items.join(' → ');
  if (type === 'match') return correct.pairs.map((p: string[]) => `${p[0]} — ${p[1]}`).join('; ');
  return '';
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });
  const user = await getUser(req);
  if (!user) return json(req, 401, { error: 'unauthorized' });
  const body = await readBody(req);
  if (!body) return json(req, 400, { error: 'bad_request' });
  const { game_id, question_id, kind, slot, answer } = body as Record<string, unknown>;
  if (typeof game_id !== 'string' || !UUID_RE.test(game_id)) return json(req, 400, { error: 'bad_game' });
  if (typeof question_id !== 'string' || question_id.length > 20) return json(req, 400, { error: 'bad_question' });
  if (kind !== 'decision' && kind !== 'med') return json(req, 400, { error: 'bad_kind' });
  if (kind === 'decision' && (!Number.isInteger(slot) || (slot as number) < 1 || (slot as number) > 3)) return json(req, 400, { error: 'bad_slot' });

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count: perMin } = await admin.from('khan_answers').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).gte('created_at', since);
  if ((perMin ?? 0) >= MAX_ANSWERS_PER_MIN) return json(req, 429, { error: 'rate_limit' });

  const { data: game } = await admin.from('khan_games').select('*').eq('id', game_id).single();
  if (!game || game.user_id !== user.id) return json(req, 404, { error: 'game_not_found' });
  if (game.status !== 'active') return json(req, 409, { error: 'race_closed' });
  if (!(game.question_ids as string[]).includes(question_id)) return json(req, 400, { error: 'question_not_in_game' });

  const { data: prev } = await admin.from('khan_answers').select('question_id, kind, slot, correct').eq('game_id', game_id);
  const answers = (prev ?? []) as Ans[];
  if (answers.some((a) => a.question_id === question_id)) return json(req, 409, { error: 'question_used' });
  if (kind === 'decision') {
    const done = answers.filter((a) => a.kind === 'decision');
    // шешімдер ретімен: 1 → 2 → 3, әр орынға бір рет
    if (done.some((a) => a.slot === slot) || done.length !== (slot as number) - 1) return json(req, 409, { error: 'bad_slot' });
  } else if (answers.filter((a) => a.kind === 'med').length >= MAX_MED) {
    return json(req, 409, { error: 'med_limit' });
  }

  const { data: q } = await admin.from('khan_questions').select('type, data, answer').eq('id', question_id).single();
  if (!q) return json(req, 404, { error: 'question_not_found' });
  const ok = check(q.type, answer, q.answer);

  await admin.from('khan_answers').insert({ game_id, user_id: user.id, question_id, kind, slot: kind === 'decision' ? slot : null, correct: ok });
  await admin.from('khan_games').update({
    correct: game.correct + (ok ? 1 : 0), wrong: game.wrong + (ok ? 0 : 1), med_used: game.med_used + (kind === 'med' ? 1 : 0),
  }).eq('id', game_id);

  return json(req, 200, { correct: ok, correct_answer: showAnswer(q.type, q.data, q.answer) });
});
