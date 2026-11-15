// =====================================================================
// khan-finish · кезеңді аяқтау: ҰПАЙДЫ СЕРВЕР ЕСЕПТЕЙДІ, рейтингті жаңартады
// Supabase → Edge Functions → Deploy a new function → Via Editor → аты: khan-finish
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

type Ans = { kind: string; slot: number | null; correct: boolean };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GAME = 'khan-tagy';
// Ойын деректерінен (khan-data.js) алынған сандар: толқын саны және жаулардың ең көп саны
const WAVES = [0, 3, 3, 4, 4, 5, 5, 6, 6, 7, 8];
const MAX_KILLS = [0, 23, 27, 45, 52, 79, 85, 119, 131, 173, 236];
const MIN_MS = (stage: number) => 15_000 + WAVES[stage] * 7_000; // кеңес + толқындар: бұдан жылдам мүмкін емес
const clampInt = (v: unknown, lo: number, hi: number, dflt: number) =>
  Number.isInteger(v) ? Math.max(lo, Math.min(hi, v as number)) : dflt;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' });
  const user = await getUser(req);
  if (!user) return json(req, 401, { error: 'unauthorized' });
  const body = await readBody(req);
  if (!body) return json(req, 400, { error: 'bad_request' });
  const { game_id } = body;
  const won = body.won === true;
  if (typeof game_id !== 'string' || !UUID_RE.test(game_id)) return json(req, 400, { error: 'bad_game' });

  const { data: game } = await admin.from('khan_games').select('*').eq('id', game_id).single();
  if (!game || game.user_id !== user.id) return json(req, 404, { error: 'game_not_found' });
  if (game.status !== 'active') return json(req, 409, { error: 'race_closed' });

  const now = Date.now();
  const elapsed = now - new Date(game.started_at).getTime();
  const { data: ans } = await admin.from('khan_answers').select('kind, slot, correct').eq('game_id', game_id);
  const answers = (ans ?? []) as Ans[];
  const correct = answers.filter((a) => a.correct).length;
  const wrong = answers.length - correct;
  const medUsed = answers.filter((a) => a.kind === 'med').length;
  const stage = game.stage as number;

  const maxLives = (game.khan_idx === 8 ? 4 : 3) + 1; // Абылай +1; «Ескі жол» қабілеті +1
  const kills = clampInt(body.kills, 0, MAX_KILLS[stage], 0);
  if (won) {
    if (answers.filter((a) => a.kind === 'decision').length < 3) return json(req, 400, { error: 'decisions_missing' });
    if (elapsed < MIN_MS(stage)) return json(req, 400, { error: 'too_fast' });
    // жеңу үшін жаулардың көбін жою керек (елші 35%-ға азайтады, бірнеше жау өтіп кетуі мүмкін)
    if (kills < Math.floor(MAX_KILLS[stage] * 0.4)) return json(req, 400, { error: 'bad_stats' });
  }
  const lives = won ? clampInt(body.lives, 1, maxLives, 1) : 0;
  const waves = won ? WAVES[stage] : clampInt(body.waves, 0, WAVES[stage] - 1, 0);
  const rb = (body.bars && typeof body.bars === 'object') ? body.bars as Record<string, unknown> : {};
  const bars = { h: clampInt(rb.h, 0, 100, 0), a: clampInt(rb.a, 0, 100, 0), g: clampInt(rb.g, 0, 100, 0), b: clampInt(rb.b, 0, 100, 0) };
  const barBonus = won ? Math.round((bars.h + bars.a + bars.g + bars.b) / 4) * 2 : 0;
  const timeMs = clampInt(body.time_ms, 0, elapsed + 2_000, elapsed);

  const score = correct * 100 + kills * 3 + (won ? 400 + stage * 60 + lives * 100 + barBonus : 0);

  await admin.from('khan_games').update({
    status: won ? 'won' : 'lost', finished_at: new Date(now).toISOString(),
    correct, wrong, med_used: medUsed, kills, lives_left: lives, waves, bars, client_time_ms: timeMs, score,
  }).eq('id', game_id);

  const { data: prof } = await admin.from('profiles').select('*').eq('id', user.id).single();
  if (prof) {
    await admin.from('profiles').update({
      games_played: prof.games_played + 1, total_score: prof.total_score + score,
      correct_total: prof.correct_total + correct, wrong_total: prof.wrong_total + wrong,
      play_seconds: prof.play_seconds + Math.round(elapsed / 1000),
    }).eq('id', user.id);
  }

  const name = prof?.display_name || prof?.full_name || 'Студент';
  const level = won ? stage : 0;
  const { data: lb } = await admin.from('leaderboard').select('best_score, best_level').eq('user_id', user.id).eq('game', GAME).maybeSingle();
  let best = false;
  if (!lb) {
    await admin.from('leaderboard').insert({ user_id: user.id, game: GAME, full_name: name, best_score: score, best_level: level });
    best = true;
  } else if (score > lb.best_score || level > lb.best_level) {
    best = score > lb.best_score;
    await admin.from('leaderboard').update({
      full_name: name, best_score: Math.max(score, lb.best_score), best_level: Math.max(level, lb.best_level), updated_at: new Date(now).toISOString(),
    }).eq('user_id', user.id).eq('game', GAME);
  }
  const myBest = Math.max(score, lb?.best_score ?? 0);
  const { count: above } = await admin.from('leaderboard').select('user_id', { count: 'exact', head: true }).eq('game', GAME).gt('best_score', myBest);

  return json(req, 200, { score, correct, wrong, kills, lives, waves, new_best: best, rank: (above ?? 0) + 1 });
});
