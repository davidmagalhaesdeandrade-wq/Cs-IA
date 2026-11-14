import { db, requireUser, respond } from './_shared/auth.mjs';

const bodyOf = (event) => {
  if (!event.body || event.body.length > 4096) return {};
  try { return JSON.parse(event.body); } catch { return {}; }
};

async function snapshot(userId) {
  await db('rpc/ensure_game_inventory', { method: 'POST', body: JSON.stringify({ p_user_id: userId }) });
  const [users, owned, equipped, catalog] = await Promise.all([
    db(`game_users?select=credits&id=eq.${encodeURIComponent(userId)}&limit=1`),
    db(`game_inventory?select=skin_id,purchased_at&user_id=eq.${encodeURIComponent(userId)}`),
    db(`game_equipped_skins?select=weapon,skin_id&user_id=eq.${encodeURIComponent(userId)}`),
    db('game_skin_catalog?select=id,weapon,name,rarity,price&active=eq.true&order=weapon.asc,name.asc')
  ]);
  return { credits: users?.[0]?.credits ?? 0, owned: owned || [], equipped: equipped || [], catalog: catalog || [] };
}

export const handler = async (event) => {
  try {
    const auth = await requireUser(event);
    if (auth.error) return auth.error;
    if (event.httpMethod === 'GET') return respond(200, await snapshot(auth.user.id));
    if (event.httpMethod !== 'POST') return respond(405, { error: 'Método não permitido.' });
    const body = bodyOf(event);
    if (typeof body.skinId !== 'string' || !/^[a-z0-9_]{3,64}$/.test(body.skinId)) return respond(400, { error: 'Acabamento inválido.' });
    if (body.action === 'purchase') {
      const purchase = await db('rpc/purchase_game_skin', { method: 'POST', body: JSON.stringify({ p_user_id: auth.user.id, p_skin_id: body.skinId }) });
      return respond(200, { purchase, ...(await snapshot(auth.user.id)) });
    }
    if (body.action === 'equip') {
      const result = await db('rpc/equip_game_skin', { method: 'POST', body: JSON.stringify({ p_user_id: auth.user.id, p_skin_id: body.skinId }) });
      return respond(200, { result, ...(await snapshot(auth.user.id)) });
    }
    return respond(400, { error: 'Ação inválida.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = /not configured/i.test(message) ? 503 : /insuficiente|indisponível|não pertence|já está/i.test(message) ? 409 : 500;
    return respond(status, { error: status === 500 ? 'Não foi possível atualizar o inventário.' : message });
  }
};
