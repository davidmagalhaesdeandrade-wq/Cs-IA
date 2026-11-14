import { db, issueSession, requireUser, respond } from './_shared/auth.mjs';

const usernameOk = (name) => /^[A-Za-z0-9_]{3,16}$/.test(name);
const bodyOf = (event) => { try { return JSON.parse(event.body || '{}'); } catch { return {}; } };

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') {
      if (event.queryStringParameters?.action !== 'me') return respond(405, { error: 'Ação inválida.' });
      const auth = await requireUser(event);
      if (auth.error) return auth.error;
      return respond(200, { user: auth.user });
    }
    if (event.httpMethod !== 'POST') return respond(405, { error: 'Método não permitido.' });
    const body = bodyOf(event);
    const action = body.action;
    if (action === 'logout') return respond(200, { ok: true }, { 'Set-Cookie': 'ts2_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' });
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!usernameOk(username)) return respond(400, { error: 'Use um nome de 3 a 16 caracteres (letras, números ou _).' });
    if (password.length < 10 || password.length > 128) return respond(400, { error: 'A senha precisa ter de 10 a 128 caracteres.' });

    let user;
    if (action === 'register') {
      const isGoat = username.toLowerCase() === 'goat';
      if (isGoat && (!process.env.ADMIN_BOOTSTRAP_CODE || body.adminCode !== process.env.ADMIN_BOOTSTRAP_CODE)) {
        return respond(403, { error: 'O cadastro da conta Goat exige o código inicial de administrador.' });
      }
      if (!isGoat && body.adminCode) return respond(400, { error: 'O código inicial só pode ser usado na conta Goat.' });
      user = await db('rpc/register_game_user', { method: 'POST', body: JSON.stringify({ p_username: isGoat ? 'Goat' : username, p_password: password, p_admin: isGoat }) });
      await db('game_admin_logs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ actor: user.username, action: 'account.register', details: { role: user.role } }) });
    } else if (action === 'login') {
      user = await db('rpc/authenticate_game_user', { method: 'POST', body: JSON.stringify({ p_username: username, p_password: password }) });
      if (!user) return respond(401, { error: 'Nome ou senha incorretos.' });
    } else return respond(400, { error: 'Ação inválida.' });

    return respond(200, { user }, { 'Set-Cookie': issueSession(user) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha no serviço de conta.';
    const status = /already exists|duplicate key|game_users_username_key/i.test(message) ? 409 : /not configured/i.test(message) ? 503 : 500;
    return respond(status, { error: status === 500 ? 'Não foi possível concluir a operação.' : message });
  }
};
