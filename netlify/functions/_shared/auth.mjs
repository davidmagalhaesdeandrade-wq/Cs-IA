import { createHmac, timingSafeEqual } from 'node:crypto';

const json = (statusCode, body, extra = {}) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
  body: JSON.stringify(body)
});

const env = () => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, AUTH_TOKEN_SECRET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !AUTH_TOKEN_SECRET) throw new Error('Serviço de conta ainda não configurado.');
  return { url: SUPABASE_URL.replace(/\/$/, ''), key: SUPABASE_SERVICE_ROLE_KEY, secret: AUTH_TOKEN_SECRET };
};

export async function db(path, init = {}) {
  const { url, key } = env();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers }
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) throw new Error(typeof data === 'object' ? data?.message || data?.hint || 'Falha no banco de dados.' : String(data));
  return data;
}

export function respond(status, data, headers) { return json(status, data, headers); }

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
function sign(payload) {
  const { secret } = env();
  const body = encode(payload);
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

export function issueSession(user) {
  const token = sign({ sub: user.id, username: user.username, exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60 });
  return `ts2_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${process.env.NETLIFY ? '; Secure' : ''}`;
}

export function readSession(event) {
  const cookies = event.headers?.cookie || event.headers?.Cookie || '';
  const token = cookies.split(';').map((part) => part.trim()).find((part) => part.startsWith('ts2_session='))?.slice('ts2_session='.length);
  if (!token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const { secret } = env();
  const expected = createHmac('sha256', secret).update(body).digest();
  let received;
  try { received = Buffer.from(signature, 'base64url'); } catch { return null; }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const user = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return Number(user.exp) > Date.now() / 1000 ? user : null;
  } catch { return null; }
}

export async function requireUser(event, admin = false) {
  const session = readSession(event);
  if (!session) return { error: respond(401, { error: 'Faça login para continuar.' }) };
  const rows = await db(`game_users?select=id,username,role,is_banned,xp,matches,wins,kills,credits,rank&id=eq.${encodeURIComponent(session.sub)}&limit=1`);
  const user = rows?.[0];
  if (!user || user.is_banned) return { error: respond(401, { error: 'Conta indisponível.' }) };
  if (admin && user.role !== 'admin') return { error: respond(403, { error: 'Acesso restrito à administração.' }) };
  return { user };
}
