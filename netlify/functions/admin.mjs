import { db, requireUser, respond } from './_shared/auth.mjs';

const safeDetails = (value) => {
  const allowed = {};
  if (Number.isInteger(value?.credits) && value.credits >= 0 && value.credits <= 2_000_000) allowed.credits = value.credits;
  if (Number.isInteger(value?.xp) && value.xp >= 0 && value.xp <= 2_000_000) allowed.xp = value.xp;
  if (['Prata I','Prata II','Prata Elite','Ouro I','Ouro II','Ouro Mestre','Mestre Guardião','Águia','Supremo','Global Elite'].includes(value?.rank)) allowed.rank = value.rank;
  if (['player', 'admin'].includes(value?.role)) allowed.role = value.role;
  if (typeof value?.is_banned === 'boolean') allowed.is_banned = value.is_banned;
  return allowed;
};

export const handler = async (event) => {
  try {
    const auth = await requireUser(event, true);
    if (auth.error) return auth.error;
    const actor = auth.user;
    if (event.httpMethod === 'GET') {
      const action = event.queryStringParameters?.action || 'overview';
      if (action === 'players' || action === 'overview') {
        const players = await db('game_users?select=id,username,role,is_banned,xp,matches,wins,kills,credits,rank,created_at&order=created_at.desc&limit=200');
        const logs = await db('game_admin_logs?select=id,actor,action,details,created_at&order=created_at.desc&limit=40');
        return respond(200, { players, logs, online: 0, matches: 0, mode: 'offline-bots' });
      }
      if (action === 'logs') return respond(200, { logs: await db('game_admin_logs?select=id,actor,action,details,created_at&order=created_at.desc&limit=200') });
      return respond(400, { error: 'Ação inválida.' });
    }
    if (event.httpMethod !== 'POST') return respond(405, { error: 'Método não permitido.' });
    const body = JSON.parse(event.body || '{}');
    const id = typeof body.id === 'string' ? body.id : '';
    const patch = safeDetails(body.changes);
    if (!id || !Object.keys(patch).length) return respond(400, { error: 'Jogador ou alterações inválidas.' });
    const target = (await db(`game_users?select=id,username&id=eq.${encodeURIComponent(id)}&limit=1`))?.[0];
    if (!target) return respond(404, { error: 'Jogador não encontrado.' });
    if (target.id === actor.id && (patch.role === 'player' || patch.is_banned === true)) return respond(400, { error: 'Você não pode remover sua própria administração ou bloquear sua conta.' });
    await db(`game_users?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(patch) });
    await db('game_admin_logs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ actor: actor.username, action: 'player.update', details: { target: target.username, changes: patch } }) });
    return respond(200, { ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha na administração.';
    const status = /not configured/i.test(message) ? 503 : 500;
    return respond(status, { error: status === 500 ? 'Não foi possível concluir a ação administrativa.' : message });
  }
};
