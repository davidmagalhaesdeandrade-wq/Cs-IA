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
        const catalog = action === 'players' ? await db('game_skin_catalog?select=id,weapon,name,rarity,price&active=eq.true&order=weapon.asc,name.asc') : [];
        return respond(200, { players, logs, catalog, online: 0, matches: 0, mode: 'offline-bots' });
      }
      if (action === 'logs') return respond(200, { logs: await db('game_admin_logs?select=id,actor,action,details,created_at&order=created_at.desc&limit=200') });
      if (action === 'economy') return respond(200, { catalog: await db('game_skin_catalog?select=id,weapon,name,rarity,price,active&order=price.asc,weapon.asc') });
      return respond(400, { error: 'Ação inválida.' });
    }
    if (event.httpMethod !== 'POST') return respond(405, { error: 'Método não permitido.' });
    const body = JSON.parse(event.body || '{}');
    if (body.action === 'skin') {
      const id = typeof body.id === 'string' ? body.id : '';
      const skinId = typeof body.skinId === 'string' ? body.skinId : '';
      const target = (await db(`game_users?select=id,username&id=eq.${encodeURIComponent(id)}&limit=1`))?.[0];
      const skin = (await db(`game_skin_catalog?select=id,weapon&id=eq.${encodeURIComponent(skinId)}&active=eq.true&limit=1`))?.[0];
      if (!target || !skin || !['grant', 'revoke'].includes(body.operation)) return respond(400, { error: 'Jogador, item ou operação inválida.' });
      if (body.operation === 'grant') {
        await db('game_inventory', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ user_id: target.id, skin_id: skin.id }) });
      } else {
        await db(`game_inventory?user_id=eq.${encodeURIComponent(target.id)}&skin_id=eq.${encodeURIComponent(skin.id)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      }
      await db('game_admin_logs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ actor: actor.username, action: `player.skin_${body.operation}`, details: { target: target.username, skin: skin.id } }) });
      return respond(200, { ok: true });
    }
    if (body.action === 'price') {
      const skinId = typeof body.skinId === 'string' ? body.skinId : '';
      const price = Number(body.price);
      if (!skinId || !Number.isInteger(price) || price < 0 || price > 2_000_000) return respond(400, { error: 'Preço inválido.' });
      const skin = (await db(`game_skin_catalog?select=id,price&id=eq.${encodeURIComponent(skinId)}&active=eq.true&limit=1`))?.[0];
      if (!skin) return respond(404, { error: 'Skin não encontrada.' });
      await db(`game_skin_catalog?id=eq.${encodeURIComponent(skinId)}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ price }) });
      await db('game_admin_logs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ actor: actor.username, action: 'economy.price', details: { skin: skinId, before: skin.price, after: price } }) });
      return respond(200, { ok: true });
    }
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
