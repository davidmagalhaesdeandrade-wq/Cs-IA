import { authUser } from '../core/Auth';
import { audio } from '../core/Audio';
import { el } from '../core/util';

type Tab = 'dashboard' | 'players' | 'matches' | 'economy' | 'bots' | 'maps' | 'logs' | 'settings';
type Player = { id: string; username: string; role: string; is_banned: boolean; xp: number; matches: number; wins: number; kills: number; credits: number; rank: string; created_at: string };
type AdminData = { players: Player[]; logs: { actor: string; action: string; details: any; created_at: string }[]; online: number; matches: number; mode: string };
const html = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const TABS: [Tab, string][] = [['dashboard', 'VISÃO GERAL'], ['players', 'JOGADORES'], ['matches', 'PARTIDAS'], ['economy', 'ECONOMIA'], ['bots', 'BOTS'], ['maps', 'MAPAS'], ['logs', 'LOGS'], ['settings', 'CONFIGURAÇÕES']];

export class AdminPanel {
  root: HTMLDivElement;
  tab: Tab = 'dashboard';
  data: AdminData = { players: [], logs: [], online: 0, matches: 0, mode: 'offline-bots' };
  query = '';
  constructor(parent: HTMLElement, private onClose: () => void, private practice: (action: string) => void = () => {}, private practiceEnabled: () => boolean = () => false) {
    this.root = el('div', 'admin-overlay');
    parent.appendChild(this.root);
    void this.load();
  }
  private async load() {
    try {
      const res = await fetch(`/.netlify/functions/admin?action=${this.tab === 'logs' ? 'logs' : this.tab === 'players' ? 'players' : 'overview'}`, { credentials: 'same-origin', cache: 'no-store' });
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
  }
  private content() {
    if (this.tab === 'dashboard') return `<div class="admin-stats"><article><b>${this.data.players.length}</b><small>CONTAS</small></article><article><b>${this.data.online}</b><small>JOGADORES ONLINE</small></article><article><b>${this.data.players.reduce((sum, p) => sum + p.matches, 0)}</b><small>PARTIDAS REGISTRADAS</small></article><article><b>${this.data.players.reduce((sum, p) => sum + p.kills, 0)}</b><small>ABATES REGISTRADOS</small></article></div><section class="admin-card"><h2>STATUS DO SERVIDOR · OFFLINE COM BOTS</h2><p>Partidas remotas ativas: ${this.data.matches}. A sessão de jogo atual roda no navegador do jogador.</p><h2>ATIVIDADE RECENTE</h2>${this.logsTable(8)}</section>`;
    if (this.tab === 'players' || this.tab === 'economy') return `<section class="admin-card"><div class="admin-card-head"><h2>${this.tab === 'players' ? 'CONTAS E JOGADORES' : 'ECONOMIA DA CONTA'}</h2><div><input data-search placeholder="Pesquisar nome" value="${html(this.query)}"><button data-refresh>ATUALIZAR</button></div></div>${this.playersTable()}</section>`;
    if (this.tab === 'logs') return `<section class="admin-card"><div class="admin-card-head"><h2>HISTÓRICO ADMINISTRATIVO</h2><button data-refresh>ATUALIZAR</button></div>${this.logsTable(200)}</section>`;
    if (this.tab === 'bots') return `<section class="admin-card"><h2>PRÁTICA LOCAL COM BOTS</h2><p>Os poderes abaixo só afetam a partida offline desta sessão e nunca clientes multiplayer.</p>${this.practiceEnabled() ? `<div class="admin-actions"><button data-practice="aim-assist">ASSISTÊNCIA DE MIRA</button><button data-practice="wall-vision">VISÃO DE BOTS</button><button data-practice="fly">VOAR</button><button data-practice="noclip">NOCLIP</button><button data-practice="godmode">GODMODE</button></div>` : '<div class="admin-empty">Inicie uma partida local e digite /painel para ativar ferramentas de prática.</div>'}<div class="admin-note">Quantidade e dificuldade dos bots são selecionadas antes de iniciar a partida. Ajuste em JOGAR → CONFIGURAR PARTIDA.</div></section>`;
    if (this.tab === 'matches') return `<section class="admin-card"><h2>PARTIDAS</h2><div class="admin-empty">Este jogo executa partidas locais com bots; não existe servidor multiplayer conectado para listar, pausar ou encerrar partidas remotas.</div></section>`;
    if (this.tab === 'maps') return `<section class="admin-card"><h2>MAPAS DISPONÍVEIS</h2><div class="admin-empty">A seleção e o balanceamento do mapa ficam no fluxo JOGAR. Mudanças de mapa ocorrem ao iniciar uma nova partida.</div></section>`;
    return `<section class="admin-card"><h2>CONFIGURAÇÃO DO SERVIDOR</h2><div class="admin-empty">Autenticação e contas usam a função segura do Netlify e a tabela de banco configurada. Manutenção e acesso administrativo devem ser controlados pelas variáveis do deploy de teste.</div></section>`;
  }
  private playersTable() {
    const rows = this.data.players.filter((p) => p.username.toLowerCase().includes(this.query.toLowerCase())).map((p) => `<tr><td><b>${html(p.username)}</b><small>${html(p.role)}${p.is_banned ? ' · BLOQUEADO' : ''}</small></td><td>${html(p.rank)}</td><td>${p.xp.toLocaleString('pt-BR')}</td><td>$${p.credits.toLocaleString('pt-BR')}</td><td>${p.matches} · ${p.wins} · ${p.kills}</td><td><div class="admin-row-actions"><button data-player="${html(p.id)}" data-action="cash">+$1.000</button><button data-player="${html(p.id)}" data-action="xp">+500 XP</button><button data-player="${html(p.id)}" data-action="rank">ALTERAR RANK</button><button data-player="${html(p.id)}" data-action="role">${p.role === 'admin' ? 'REMOVER ADMIN' : 'TORNAR ADMIN'}</button><button data-player="${html(p.id)}" data-action="ban">${p.is_banned ? 'DESBLOQUEAR' : 'BANIR'}</button></div></td></tr>`).join('');
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
    const response = await fetch('/.netlify/functions/admin', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, changes }) });
    const result = await response.json();
    if (!response.ok) { this.render(result.error || 'Ação recusada.'); return; }
    await this.load();
  }
  destroy() { this.root.remove(); }
}
