import { el } from '../core/util';
import { audio } from '../core/Audio';
import type { MatchConfig } from '../game/GameSession';

interface MapInfo { id: string; name: string; theme: string; status: 'play' | 'dev' | 'demo'; pal: [string, string, string, string]; style: 'desert' | 'city' | 'industrial' | 'jungle' | 'tower' | 'canal' }
export const MAPS: MapInfo[] = [
  { id: 'dust2', name: 'Dust II', theme: 'Cidade desértica do Oriente Médio', status: 'play', pal: ['#f2c98a', '#d9a35f', '#8d5a2b', '#5aa1e0'], style: 'desert' },
  { id: 'mirage', name: 'Mirage', theme: 'Mercado marroquino ensolarado', status: 'dev', pal: ['#f4d7a1', '#e0b06b', '#9c6a3a', '#7fb8e8'], style: 'desert' },
  { id: 'inferno', name: 'Inferno', theme: 'Vila italiana de pedra', status: 'dev', pal: ['#e8c9a0', '#c98a5a', '#7a4a2a', '#9cc6e6'], style: 'city' },
  { id: 'nuke', name: 'Nuke', theme: 'Usina nuclear industrial', status: 'dev', pal: ['#c9d3da', '#8fa3b0', '#3d4f5c', '#a9c9e6'], style: 'industrial' },
  { id: 'ancient', name: 'Ancient', theme: 'Ruínas maias na selva', status: 'dev', pal: ['#b7c99a', '#6f8f5a', '#3a4f2e', '#c8e0d0'], style: 'jungle' },
  { id: 'anubis', name: 'Anubis', theme: 'Templo egípcio à beira do Nilo', status: 'demo', pal: ['#f0d9a8', '#cfa75f', '#6b4f2a', '#79b6d8'], style: 'canal' },
  { id: 'vertigo', name: 'Vertigo', theme: 'Arranha-céu em construção', status: 'dev', pal: ['#d6dde3', '#9aa7b1', '#4a5560', '#8fc1ea'], style: 'tower' },
  { id: 'overpass', name: 'Overpass', theme: 'Parque urbano e canais de Berlim', status: 'dev', pal: ['#c7d1b8', '#8ea08a', '#4d5a4a', '#b0cfe8'], style: 'canal' }
];

const artCache = new Map<string, string>();
/** procedural "key art" for a map card */
export function mapArt(m: MapInfo, w = 480, h = 270): string {
  const k = m.id + w;
  if (artCache.has(k)) return artCache.get(k)!;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  let seed = m.id.split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const r = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const sky = g.createLinearGradient(0, 0, 0, h * 0.7);
  sky.addColorStop(0, m.pal[3]); sky.addColorStop(1, '#f5ead2');
  g.fillStyle = sky; g.fillRect(0, 0, w, h);
  // sun
  const sg = g.createRadialGradient(w * 0.8, h * 0.18, 0, w * 0.8, h * 0.18, h * 0.5);
  sg.addColorStop(0, 'rgba(255,250,220,0.95)'); sg.addColorStop(0.1, 'rgba(255,240,200,0.6)'); sg.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = sg; g.fillRect(0, 0, w, h);
  const ground = h * 0.72;
  // far skyline
  for (let layer = 0; layer < 3; layer++) {
    const col = m.pal[2 - layer] || m.pal[0];
    g.fillStyle = col;
    g.globalAlpha = 0.35 + layer * 0.3;
    let x = -20;
    while (x < w + 20) {
      const bw = 30 + r() * 80, bh = (m.style === 'tower' ? 120 : 40) + r() * (m.style === 'tower' ? 140 : 70) - layer * 15;
      const y = ground - bh + layer * 18;
      g.fillRect(x, y, bw, h);
      if (m.style === 'desert' || m.style === 'canal') { if (r() > 0.6) { g.beginPath(); g.arc(x + bw / 2, y, bw * 0.3, Math.PI, 0); g.fill(); } }
      if (m.style === 'industrial' && r() > 0.5) { g.fillRect(x + bw * 0.4, y - 60, 12, 60); }
      if (m.style === 'jungle' && r() > 0.4) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + bw / 2, y - 40); g.lineTo(x + bw, y); g.fill(); }
      // windows
      if (layer === 2) {
        g.fillStyle = 'rgba(40,25,10,0.5)';
        for (let i = 0; i < 3; i++) g.fillRect(x + 8 + i * (bw / 3), y + 14 + r() * 20, 8, 12);
        g.fillStyle = col;
      }
      x += bw + r() * 10;
    }
  }
  g.globalAlpha = 1;
  // arch / gateway for the hero map
  if (m.id === 'dust2') {
    g.fillStyle = m.pal[1];
    g.fillRect(w * 0.32, h * 0.3, w * 0.36, ground - h * 0.3);
    g.fillStyle = '#5b3a1e';
    g.beginPath(); g.moveTo(w * 0.42, ground); g.lineTo(w * 0.42, h * 0.48); g.arc(w * 0.5, h * 0.48, w * 0.08, Math.PI, 0); g.lineTo(w * 0.58, ground); g.fill();
    g.fillStyle = '#8a5a2a'; g.fillRect(w * 0.425, h * 0.5, w * 0.07, ground - h * 0.5);
    g.fillStyle = '#7a4f24'; g.fillRect(w * 0.505, h * 0.5, w * 0.07, ground - h * 0.5);
    // crates
    g.fillStyle = '#a7773f'; g.fillRect(w * 0.12, ground - 40, 46, 40); g.fillRect(w * 0.15, ground - 78, 40, 38);
    g.strokeStyle = '#5d3d1e'; g.lineWidth = 3; g.strokeRect(w * 0.12, ground - 40, 46, 40); g.strokeRect(w * 0.15, ground - 78, 40, 38);
    // palm
    g.strokeStyle = '#6b5236'; g.lineWidth = 7; g.beginPath(); g.moveTo(w * 0.85, ground); g.quadraticCurveTo(w * 0.83, h * 0.45, w * 0.86, h * 0.3); g.stroke();
    g.strokeStyle = '#4f7a2e'; g.lineWidth = 6;
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; g.beginPath(); g.moveTo(w * 0.86, h * 0.3); g.quadraticCurveTo(w * 0.86 + Math.cos(a) * 40, h * 0.3 - 20, w * 0.86 + Math.cos(a) * 70, h * 0.3 + 25); g.stroke(); }
  }
  // ground
  const gg = g.createLinearGradient(0, ground, 0, h);
  gg.addColorStop(0, m.pal[0]); gg.addColorStop(1, m.pal[1]);
  g.fillStyle = gg; g.fillRect(0, ground, w, h - ground);
  // vignette + grain
  const v = g.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.7);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = v; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.08})`; g.fillRect(r() * w, r() * h, 1, 1); }
  const url = c.toDataURL('image/jpeg', 0.85);
  artCache.set(k, url);
  return url;
}

export class MapSelectScreen {
  root: HTMLDivElement;
  cfg: MatchConfig = { team: 'T', difficulty: 'normal', size: 5, money: 'standard' };
  selected = 'dust2';
  constructor(parent: HTMLElement, private onClose: () => void, private onStart: (c: MatchConfig) => void) {
    try { const r = localStorage.getItem('ts2_matchcfg'); if (r) this.cfg = { ...this.cfg, ...JSON.parse(r) }; } catch { /* */ }
    this.root = el('div', 'screen mapselect');
    parent.appendChild(this.root);
    this.render();
    requestAnimationFrame(() => this.root.classList.add('show'));
  }

  render() {
    const opt = (key: keyof MatchConfig, val: any, label: string, cls = '') => `<button class="opt ${cls} ${this.cfg[key] === val ? 'active' : ''}" data-k="${key}" data-v="${val}">${label}</button>`;
    const cards = MAPS.map((m) => `
      <div class="map-card ${m.status === 'play' ? 'playable' : 'locked'} ${this.selected === m.id ? 'sel' : ''}" data-id="${m.id}">
        <img src="${mapArt(m)}"><div class="mc-shade"></div>
        <div class="mc-info"><div class="mc-name">${m.name}</div><div class="mc-theme">${m.theme}</div></div>
        <div class="mc-status ${m.status}">${m.status === 'play' ? '● JOGÁVEL' : m.status === 'demo' ? 'SOMENTE DEMONSTRAÇÃO' : 'EM DESENVOLVIMENTO'}</div>
      </div>`).join('');
    this.root.innerHTML = `
      <div class="screen-head"><h1>JOGAR</h1><span>Competitivo · Offline contra bots</span><button class="close" data-act="back">✕ VOLTAR</button></div>
      <div class="ms-body">
        <div class="ms-maps"><div class="ms-label">SELECIONE O MAPA</div><div class="map-grid">${cards}</div></div>
        <div class="ms-side">
          <div class="ms-preview"><img src="${mapArt(MAPS[0], 640, 360)}"><div class="msp-name">DUST II</div><div class="msp-meta">Bombsites A e B · 5v5 · Primeiro a 7 rounds</div></div>
          <div class="ms-group"><div class="ms-label">TIME</div><div class="opts">${opt('team', 'T', 'TERRORISTAS', 't')}${opt('team', 'CT', 'CONTRA-TERRORISTAS', 'ct')}${opt('team', 'random', 'ALEATÓRIO')}</div></div>
          <div class="ms-group"><div class="ms-label">DIFICULDADE DOS BOTS</div><div class="opts">${opt('difficulty', 'easy', 'FÁCIL')}${opt('difficulty', 'normal', 'NORMAL')}${opt('difficulty', 'hard', 'DIFÍCIL')}</div></div>
          <div class="ms-group"><div class="ms-label">TAMANHO DA PARTIDA</div><div class="opts">${opt('size', 1, '1v1')}${opt('size', 3, '3v3')}${opt('size', 5, '5v5')}</div></div>
          <div class="ms-group"><div class="ms-label">ECONOMIA</div><div class="opts">${opt('money', 'standard', 'PADRÃO ($800)')}${opt('money', 'rich', 'TREINO ($16.000)')}</div></div>
          <button class="start-btn" data-act="start">INICIAR PARTIDA</button>
        </div>
      </div>
      <div class="toast" data-k="toast"></div>`;
    this.root.querySelectorAll<HTMLButtonElement>('.opt').forEach((b) => {
      b.onmouseenter = () => audio.ui('hover');
      b.onclick = () => {
        audio.ui('click');
        const k = b.dataset.k as keyof MatchConfig;
        let v: any = b.dataset.v;
        if (k === 'size') v = parseInt(v, 10);
        (this.cfg as any)[k] = v;
        try { localStorage.setItem('ts2_matchcfg', JSON.stringify(this.cfg)); } catch { /* */ }
        this.render();
      };
    });
    this.root.querySelectorAll<HTMLDivElement>('.map-card').forEach((c) => {
      c.onmouseenter = () => audio.ui('hover');
      c.onclick = () => {
        const m = MAPS.find((x) => x.id === c.dataset.id)!;
        if (m.status !== 'play') { audio.ui('error'); this.toast(`${m.name}: ${m.status === 'demo' ? 'somente demonstração visual' : 'em desenvolvimento'} — apenas Dust II é jogável`); return; }
        audio.ui('click');
        this.selected = m.id;
        this.render();
      };
      c.ondblclick = () => { if (c.dataset.id === 'dust2') this.start(); };
    });
    (this.root.querySelector('[data-act=back]') as HTMLButtonElement).onclick = () => { audio.ui('back'); this.onClose(); };
    const sb = this.root.querySelector('[data-act=start]') as HTMLButtonElement;
    sb.onmouseenter = () => audio.ui('hover');
    sb.onclick = () => this.start();
  }

  start() { audio.ui('equip'); this.onStart({ ...this.cfg }); }

  toast(t: string) {
    const e = this.root.querySelector('[data-k=toast]') as HTMLElement;
    e.textContent = t;
    e.classList.add('show');
    setTimeout(() => e.classList.remove('show'), 2400);
  }
  destroy() { this.root.remove(); }
}
