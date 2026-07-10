const MAX_BODY_BYTES = 4096;
const MAX_FEEDBACK_LENGTH = 500;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_REQUESTS_PER_IP = 30;
const SKILL_ID = /^[a-z0-9][a-z0-9-]{1,63}$/;
const DEVICE_ID = /^[A-Za-z0-9._:-]{16,128}$/;

function json(body, status = 200, request, env) {
  const origin = env.ALLOWED_ORIGIN || '*';
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'cache-control': 'no-store',
  };
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers });
}

function knownSkill(env, skillId) {
  const configured = String(env.SKILL_IDS || '').split(',').map((value) => value.trim()).filter(Boolean);
  return configured.length === 0 || configured.includes(skillId);
}

async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  const buffer = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function pseudonym(env, value) {
  return digest(`${env.RATING_SALT || 'configure-a-rating-salt'}:${value}`);
}

async function enforceRateLimit(request, env) {
  if (!env.DB) return null;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await pseudonym(env, ip);
  const now = Date.now();
  const current = await env.DB.prepare('SELECT window_started, request_count FROM rate_limits WHERE ip_hash = ?')
    .bind(ipHash).first();
  const windowStarted = current && now - Number(current.window_started) < WINDOW_MS
    ? Number(current.window_started) : now;
  const requestCount = windowStarted === Number(current?.window_started) ? Number(current.request_count) + 1 : 1;
  if (requestCount > MAX_REQUESTS_PER_IP) return { limited: true };
  await env.DB.prepare(
    'INSERT INTO rate_limits (ip_hash, window_started, request_count) VALUES (?, ?, ?) '
      + 'ON CONFLICT(ip_hash) DO UPDATE SET window_started = excluded.window_started, request_count = excluded.request_count',
  ).bind(ipHash, windowStarted, requestCount).run();
  return null;
}

async function submit(request, env) {
  if (!env.DB) return json({ ok: false, error: 'rating database is not configured' }, 503, request, env);
  const limited = await enforceRateLimit(request, env);
  if (limited) return json({ ok: false, error: 'rate limit exceeded' }, 429, request, env);
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) {
    return json({ ok: false, error: 'request is too large' }, 413, request, env);
  }
  let body;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json({ ok: false, error: 'request is too large' }, 413, request, env);
    body = JSON.parse(raw);
  } catch {
    return json({ ok: false, error: 'invalid JSON' }, 400, request, env);
  }
  const skillId = String(body?.skill_id || '').trim();
  const rating = Number(body?.rating);
  const deviceId = String(body?.device_id || '').trim();
  const version = String(body?.version || '').trim().slice(0, 128);
  const feedback = String(body?.feedback || '').trim().slice(0, MAX_FEEDBACK_LENGTH);
  if (!SKILL_ID.test(skillId) || !knownSkill(env, skillId)) {
    return json({ ok: false, error: 'unknown skill_id' }, 400, request, env);
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return json({ ok: false, error: 'rating must be an integer from 1 to 5' }, 400, request, env);
  }
  if (!DEVICE_ID.test(deviceId)) return json({ ok: false, error: 'invalid device_id' }, 400, request, env);
  const deviceHash = await pseudonym(env, deviceId);
  const now = new Date().toISOString();
  await env.DB.prepare(
    'INSERT INTO ratings (skill_id, device_hash, rating, version, feedback, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) '
      + 'ON CONFLICT(skill_id, device_hash) DO UPDATE SET rating = excluded.rating, version = excluded.version, '
      + 'feedback = excluded.feedback, updated_at = excluded.updated_at',
  ).bind(skillId, deviceHash, rating, version, feedback, now, now).run();
  return json({ ok: true, skill_id: skillId, rating, updated_at: now }, 200, request, env);
}

async function exportRatings(request, env) {
  const expected = String(env.RATING_EXPORT_TOKEN || '');
  const provided = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!expected || provided !== expected) return json({ ok: false, error: 'unauthorized' }, 401, request, env);
  if (!env.DB) return json({ ok: false, error: 'rating database is not configured' }, 503, request, env);
  const result = await env.DB.prepare(
    'SELECT skill_id, device_hash AS voter_hash, rating, version, updated_at FROM ratings ORDER BY updated_at ASC',
  ).all();
  return json({ ok: true, generated_at: new Date().toISOString(), ratings: result.results || [] }, 200, request, env);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return json({}, 204, request, env);
    const url = new URL(request.url);
    try {
      if (url.pathname === '/health' && request.method === 'GET') return json({ ok: true }, 200, request, env);
      if (url.pathname === '/v1/ratings' && request.method === 'POST') return submit(request, env);
      if (url.pathname === '/v1/ratings/export' && request.method === 'GET') return exportRatings(request, env);
      return json({ ok: false, error: 'not found' }, 404, request, env);
    } catch (error) {
      return json({ ok: false, error: 'internal server error' }, 500, request, env);
    }
  },
};
