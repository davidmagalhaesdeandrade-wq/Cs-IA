import { authUser } from '../core/Auth';
import { audio } from '../core/Audio';
import { el } from '../core/util';

type Tab = 'dashboard' | 'players' | 'matches' | 'economy' | 'bots' | 'maps' | 'logs' | 'settings';
type Player = { id: string; username: string; role: string; is_banned: boolean; xp: number; matches: number; wins: number; kills: number; credits: number; rank: string; created_at: string };
type AdminData = { players: Player[]; logs: { actor: string; action: string; details: any; created_at: string }[]; online: number; matches: number; mode: string; catalog: { id: string; weapon: string; name: string; rarity: string; price: number }[] };
const html = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const TABS: [Tab, string][] = [['dashboard', 'VISÃO GERAL'], ['players', 'JOGADORES'], ['matches', 'PARTIDAS'], ['economy', 'ECONOMIA'], ['bots', 'BOTS'], ['maps', 'MAPAS'], ['logs', 'LOGS'], ['settings', 'CONFIGURAÇÕES']];

export class AdminPanel {
  root: HTMLDivElement;
  tab: Tab = 'dashboard';
  data: AdminData = { players: [], logs: [], online: 0, matches: 0, mode: 'offline-bots', catalog: [] };
  query = '';
  constructor(parent: HTMLElement, private onClose: () => void, private practice: (action: string) => void = () => {}, private practiceEnabled: () => boolean = () => false, private gameAction: (action: string) => void = () => {}, private localMatch: () => boolean = () => false, private gameSettings: () => { size: number; difficulty: string } | null = () => null) {
    this.root = el('div', 'admin-overlay');
    parent.appendChild(this.root);
    void this.load();
  }
  private async load() {
    try {
      const action = this.tab === 'logs' ? 'logs' : this.tab === 'players' ? 'players' : this.tab === 'economy' ? 'economy' : 'overview';
      const res = await fetch(`/.netlify/functions/admin?action=${action}`, { credentials: 'same-origin', cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não foi possível carregar o painel.');
      if (data.logs && !data.players) this.data.logs = data.logs;
      else this.data = { ...this.data, ...data };
      this.render();
    } catch (error) {
      this.render(error instanceof Error ? error.message : 'Serviço administrativo indisponível.');
    }
  }
  private render(error = '') {
    if (authUser()?.role !== 'admin') {
      this.root.innerHTML = '<div class="admin-denied"><h2>ACESSO NEGADO</h2><p>Somente uma conta administradora autenticada pode abrir /painel.</p><button data-close>VOLTAR</button></div>';
      this.root.querySelector('[data-close]')!.addEventListener('click', () => this.onClose());
      return;
    }
    this.root.innerHTML = `
      <div class="admin-shell">
        <header class="admin-head"><div><small>OPERATION STRIKE · CONTROLE</small><h1>PAINEL ADMINISTRATIVO</h1></div><button data-close aria-label="Fechar painel">×</button></header>
        <nav class="admin-tabs">${TABS.map(([id, label]) => `<button data-tab="${id}" class="${id === this.tab ? 'active' : ''}">${label}</button>`).join('')}</nav>
        <main class="admin-body"><div class="admin-message ${error ? 'error' : ''}" role="status">${html(error || (this.data.mode === 'offline-bots' ? 'Servidor: modo offline · partidas online não estão habilitadas neste projeto.' : ''))}</div>${this.content()}</main>
      </div>`;
    this.root.querySelector('[data-close]')!.addEventListener('click', () => this.onClose());
    this.root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => b.onclick = () => { this.tab = b.dataset.tab as Tab; audio.ui('click'); this.render(); void this.load(); });
    this.root.querySelectorAll<HTMLButtonElement>('[data-refresh]').forEach((b) => b.onclick = () => { void this.load(); });
    this.root.querySelectorAll<HTMLInputElement>('[data-search]').forEach((input) => input.oninput = () => { this.query = input.value; this.render(); });
    this.root.querySelectorAll<HTMLButtonElement>('[data-player][data-action]').forEach((button) => button.onclick = () => { void this.updatePlayer(button.dataset.player!, button.dataset.action!); });
    this.root.querySelectorAll<HTMLButtonElement>('[data-practice]').forEach((button) => button.onclick = () => { this.practice(button.dataset.practice!); button.classList.toggle('active'); });
    this.root.querySelectorAll<HTMLSelectElement>('[data-game-setting]').forEach((select) => select.onchange = () => this.gameAction(`${select.dataset.gameSetting}:${select.value}`));
    this.root.querySelectorAll<HTMLButtonElement>('[data-match-action]').forEach((button) => button.onclick = () => this.gameAction(button.dataset.matchAction!));
    this.root.querySelectorAll<HTMLButtonElement>('[data-skin-action]').forEach((button) => button.onclick = () => { void this.playerSkin(button.dataset.player!, button.dataset.skinAction as 'grant' | 'revoke'); });
    this.root.querySelectorAll<HTMLButtonElement>('[data-price]').forEach((button) => button.onclick = () => { void this.changePrice(button.dataset.price!); });
  }
  private content() {
    if (this.tab === 'dashboard') return `<div class="admin-stats"><article><b>${this.data.players.length}</b><small>CONTAS</small></article><article><b>${this.data.online}</b><small>JOGADORES ONLINE</small></article><article><b>${this.data.players.reduce((sum, p) => sum + p.matches, 0)}</b><small>PARTIDAS REGISTRADAS</small></article><article><b>${this.data.players.reduce((sum, p) => sum + p.kills, 0)}</b><small>ABATES REGISTRADOS</small></article></div><section class="admin-card"><h2>STATUS DO SERVIDOR · OFFLINE COM BOTS</h2><p>Partidas remotas ativas: ${this.data.matches}. A sessão de jogo atual roda no navegador do jogador.</p><h2>ATIVIDADE RECENTE</h2>${this.logsTable(8)}</section>`;
    if (this.tab === 'players') return `<section class="admin-card"><div class="admin-card-head"><h2>CONTAS E JOGADORES</h2><div><input data-search placeholder="Pesquisar nome" value="${html(this.query)}"><button data-refresh>ATUALIZAR</button></div></div>${this.playersTable()}</section>`;
    if (this.tab === 'economy') return `<section class="admin-card"><div class="admin-card-head"><h2>PREÇOS DA LOJA</h2><button data-refresh>ATUALIZAR</button></div><p>Os preços definidos aqui são validados no servidor e aplicados a todos os dispositivos.</p>${this.economyTable()}</section>`;
    if (this.tab === 'logs') return `<section class="admin-card"><div class="admin-card-head"><h2>HISTÓRICO ADMINISTRATIVO</h2><button data-refresh>ATUALIZAR</button></div>${this.logsTable(200)}</section>`;
    if (this.tab === 'bots') { const game = this.gameSettings(); return `<section class="admin-card"><h2>FERRAMENTAS DE JOGO E BOTS</h2><p>Disponíveis em qualquer partida local suportada. Ainda não existe servidor multiplayer que possa aplicar comandos em outros clientes.</p>${this.practiceEnabled() ? `<div class="admin-actions"><button data-practice="aim-assist">ASSISTÊNCIA DE MIRA</button><button data-practice="wall-vision">VISÃO DE BOTS</button><button data-practice="fly">VOAR</button><button data-practice="noclip">NOCLIP</button><button data-practice="godmode">GODMODE</button></div><label>Formato <select data-game-setting="bots">${[1, 3, 5].map((size) => `<option value="${size}" ${game?.size === size ? 'selected' : ''}>${size}v${size}</option>`).join('')}</select></label><label>Dificuldade <select data-game-setting="difficulty">${[['easy','Fácil'],['normal','Normal'],['hard','Difícil']].map(([id,label]) => `<option value="${id}" ${game?.difficulty === id ? 'selected' : ''}>${label}</option>`).join('')}</select></label>` : '<div class="admin-empty">Abra o painel durante uma partida local em andamento para controlar bots e poderes desta sessão.</div>'}</section>`; }
    if (this.tab === 'matches') return `<section class="admin-card"><h2>PARTIDAS</h2>${this.localMatch() ? `<p>Partida local ativa no navegador atual.</p><div class="admin-actions"><button data-match-action="restart">REINICIAR PARTIDA LOCAL</button><button data-match-action="end">ENCERRAR PARTIDA LOCAL</button></div>` : '<div class="admin-empty">Não há sessão local aberta neste navegador. O backend não executa nem lista partidas online.</div>'}<div class="admin-note">Controles online de pause, kick, troca de mapa e encerramento precisam de um servidor de partidas autoritativo.</div></section>`;
    if (this.tab === 'maps') return `<section class="admin-card"><h2>MAPAS DISPONÍVEIS</h2><div class="admin-empty">Dust II é o único mapa com geometria e colisão jogáveis. Mirage, Inferno e os demais cards são protótipos visuais; não serão oferecidos como mapas de partida até terem layout, navmesh, spawns e colisões completos.</div></section>`;
    return `<section class="admin-card"><h2>CONFIGURAÇÃO DO SERVIDOR</h2><div class="admin-empty">Autenticação e contas usam a função segura do Netlify e a tabela de banco configurada. Manutenção e acesso administrativo devem ser controlados pelas variáveis do deploy de teste.</div></section>`;
  }
  private playersTable() {
    const rows = this.data.players.filter((p) => p.username.toLowerCase().includes(this.query.toLowerCase())).map((p) => `<tr><td><b>${html(p.username)}</b><small>${html(p.role)}${p.is_banned ? ' · BLOQUEADO' : ''}</small></td><td>${html(p.rank)}</td><td>${p.xp.toLocaleString('pt-BR')}</td><td>$${p.credits.toLocaleString('pt-BR')}</td><td>${p.matches} · ${p.wins} · ${p.kills}</td><td><div class="admin-row-actions"><button data-player="${html(p.id)}" data-action="cash">+$1.000</button><button data-player="${html(p.id)}" data-action="xp">+500 XP</button><button data-player="${html(p.id)}" data-action="rank">ALTERAR RANK</button><button data-player="${html(p.id)}" data-action="role">${p.role === 'admin' ? 'REMOVER ADMIN' : 'TORNAR ADMIN'}</button><button data-player="${html(p.id)}" data-action="skin-grant">DAR SKIN</button><button data-player="${html(p.id)}" data-action="skin-revoke">REMOVER SKIN</button><button data-player="${html(p.id)}" data-action="ban">${p.is_banned ? 'DESBLOQUEAR' : 'BANIR'}</button></div></td></tr>`).join('');
    return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>JOGADOR</th><th>RANK</th><th>XP</th><th>SALDO</th><th>PARTIDAS · VITÓRIAS · ABATES</th><th>AÇÕES</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Nenhuma conta encontrada.</td></tr>'}</tbody></table></div>`;
  }
  private logsTable(limit: number) {
    const rows = this.data.logs.slice(0, limit).map((log) => `<tr><td>${html(new Date(log.created_at).toLocaleString('pt-BR'))}</td><td>${html(log.actor)}</td><td>${html(log.action)}</td><td>${html(JSON.stringify(log.details || {}))}</td></tr>`).join('');
    return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>DATA</th><th>ADMIN</th><th>AÇÃO</th><th>DETALHES</th></tr></thead><tbody>${rows || '<tr><td colspan="4">Sem ações registradas.</td></tr>'}</tbody></table></div>`;
  }
  private async updatePlayer(id: string, action: string) {
    const p = this.data.players.find((player) => player.id === id);
    if (!p) return;
    const ranks = ['Prata I','Prata II','Prata Elite','Ouro I','Ouro II','Ouro Mestre','Mestre Guardião','Águia','Supremo','Global Elite'];
    const nextRank = ranks[(ranks.indexOf(p.rank) + 1 + ranks.length) % ranks.length];
    const changes = action === 'cash' ? { credits: Math.min(2_000_000, p.credits + 1000) }
      : action === 'xp' ? { xp: Math.min(2_000_000, p.xp + 500) }
      : action === 'rank' ? { rank: nextRank }
      : action === 'role' ? { role: p.role === 'admin' ? 'player' : 'admin' }
      : { is_banned: !p.is_banned };
    if (action === 'skin-grant' || action === 'skin-revoke') { await this.playerSkin(id, action === 'skin-grant' ? 'grant' : 'revoke'); return; }
    const response = await fetch('/.netlify/functions/admin', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, changes }) });
    const result = await response.json();
    if (!response.ok) { this.render(result.error || 'Ação recusada.'); return; }
    await this.load();
  }
  private economyTable() {
    const rows = this.data.catalog.map((item) => `<tr><td>${html(item.weapon.toUpperCase())}</td><td><b>${html(item.name)}</b><small>${html(item.id)}</small></td><td>${html(item.rarity)}</td><td>$${Number(item.price).toLocaleString('pt-BR')}</td><td><button data-price="${html(item.id)}">ALTERAR PREÇO</button></td></tr>`).join('');
    return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>ARMA</th><th>SKIN</th><th>RARIDADE</th><th>PREÇO</th><th>AÇÃO</th></tr></thead><tbody>${rows || '<tr><td colspan="5">Catálogo indisponível. Aplique a migração de inventário no Supabase.</td></tr>'}</tbody></table></div>`;
  }
  private async playerSkin(playerId: string, operation: 'grant' | 'revoke') {
    const options = this.data.catalog.map((item) => `${item.id} — ${item.weapon} | ${item.name}`).join('\n');
    const skinId = window.prompt(`ID da skin para ${operation === 'grant' ? 'conceder' : 'remover'}:\n${options}`, 'ak47_redline');
    if (!skinId) return;
    const response = await fetch('/.netlify/functions/admin', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'skin', operation, id: playerId, skinId: skinId.trim() }) });
    const data = await response.json();
    if (!response.ok) { this.render(data.error || 'Não foi possível alterar o inventário.'); return; }
    await this.load();
  }
  private async changePrice(skinId: string) {
    const item = this.data.catalog.find((entry) => entry.id === skinId);
    if (!item) return;
    const value = window.prompt(`Novo preço para ${item.weapon} | ${item.name}`, String(item.price));
    if (value === null) return;
    const price = Number(value);
    if (!Number.isInteger(price) || price < 0 || price > 2_000_000) { this.render('Informe um preço inteiro entre 0 e 2.000.000.'); return; }
    const response = await fetch('/.netlify/functions/admin', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'price', skinId, price }) });
    const data = await response.json();
    if (!response.ok) { this.render(data.error || 'Não foi possível alterar o preço.'); return; }
    await this.load();
  }
  destroy() { this.root.remove(); }
}
