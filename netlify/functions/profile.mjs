import { db, requireUser, respond } from './_shared/auth.mjs';

export const handler = async (event) => {
  try {
    const auth = await requireUser(event);
    if (auth.error) return auth.error;
    if (event.httpMethod !== 'POST') return respond(405, { error: 'Método não permitido.' });
    const body = JSON.parse(event.body || '{}');
    const kills = Number(body.kills), matches = Number(body.matches), wins = Number(body.wins);
    if (!Number.isInteger(kills) || !Number.isInteger(matches) || !Number.isInteger(wins)) return respond(400, { error: 'Estatísticas inválidas.' });
    const profile = await db('rpc/add_game_stats', { method: 'POST', body: JSON.stringify({ p_user_id: auth.user.id, p_kills: kills, p_matches: matches, p_wins: wins }) });
    return respond(200, { profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return respond(/not configured/i.test(message) ? 503 : 400, { error: /not configured/i.test(message) ? message : 'Não foi possível salvar as estatísticas da conta.' });
  }
};
