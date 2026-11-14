import { settings, SettingsData, DEFAULT_SETTINGS } from '../core/Settings';
import { el } from '../core/util';
import { audio } from '../core/Audio';

type Field =
  | { k: keyof SettingsData; label: string; type: 'range'; min: number; max: number; step: number; fmt?: (v: number) => string }
  | { k: keyof SettingsData; label: string; type: 'select'; options: [string, string][] }
  | { k: keyof SettingsData; label: string; type: 'toggle' }
  | { k: keyof SettingsData; label: string; type: 'color'; options: string[] }
  | { k: keyof SettingsData; label: string; type: 'text' };

const TABS: { id: string; label: string; fields: Field[] }[] = [
  {
    id: 'video', label: 'VÍDEO', fields: [
      { k: 'quality', label: 'Qualidade gráfica', type: 'select', options: [['low', 'Baixa'], ['medium', 'Média'], ['high', 'Alta']] },
      { k: 'renderScale', label: 'Escala de renderização', type: 'range', min: 0.5, max: 1, step: 0.05, fmt: (v) => Math.round(v * 100) + '%' },
      { k: 'shadows', label: 'Sombras', type: 'toggle' },
      { k: 'fov', label: 'Campo de visão (FOV)', type: 'range', min: 70, max: 110, step: 1, fmt: (v) => v + '°' },
      { k: 'showFps', label: 'Mostrar FPS', type: 'toggle' }
    ]
  },
  {
    id: 'audio', label: 'ÁUDIO', fields: [
      { k: 'masterVolume', label: 'Volume geral', type: 'range', min: 0, max: 1, step: 0.01, fmt: (v) => Math.round(v * 100) + '%' },
      { k: 'sfxVolume', label: 'Volume de efeitos', type: 'range', min: 0, max: 1, step: 0.01, fmt: (v) => Math.round(v * 100) + '%' },
      { k: 'musicVolume', label: 'Volume da música do menu', type: 'range', min: 0, max: 1, step: 0.01, fmt: (v) => Math.round(v * 100) + '%' }
    ]
  },
  {
    id: 'game', label: 'JOGABILIDADE', fields: [
      { k: 'playerName', label: 'Nome do jogador', type: 'text' },
      { k: 'sensitivity', label: 'Sensibilidade do mouse', type: 'range', min: 0.2, max: 6, step: 0.05, fmt: (v) => v.toFixed(2) },
      { k: 'crouchToggle', label: 'Agachar: alternar (em vez de segurar)', type: 'toggle' },
      { k: 'crosshairColor', label: 'Cor da mira', type: 'color', options: ['#4dff6a', '#ffffff', '#00e5ff', '#ffe23d', '#ff3df2', '#ff3b3b'] },
      { k: 'crosshairSize', label: 'Tamanho da mira', type: 'range', min: 3, max: 16, step: 1, fmt: (v) => String(v) },
      { k: 'crosshairGap', label: 'Espaço central', type: 'range', min: 0, max: 12, step: 1, fmt: (v) => String(v) },
      { k: 'crosshairThickness', label: 'Espessura', type: 'range', min: 1, max: 4, step: 1, fmt: (v) => String(v) },
      { k: 'crosshairDot', label: 'Ponto central', type: 'toggle' },
      { k: 'crosshairDynamic', label: 'Mira dinâmica (abre ao mover/atirar)', type: 'toggle' }
    ]
  },
  { id: 'controls', label: 'CONTROLES', fields: [] }
];

const CONTROLS: [string, string][] = [
  ['W A S D', 'Movimentação'], ['Mouse', 'Olhar'], ['Botão esquerdo', 'Atirar'], ['Botão direito', 'Mira telescópica / Facada forte / Foco'],
  ['R', 'Recarregar'], ['Espaço', 'Pular'], ['Shift', 'Andar silenciosamente'], ['Ctrl / C', 'Agachar'], ['E (segurar)', 'Plantar / Desarmar / Pegar arma'],
  ['G', 'Soltar arma'], ['B', 'Menu de compras'], ['Tab', 'Placar'], ['Esc', 'Pausa'], ['1', 'Arma primária'], ['2', 'Pistola'], ['3', 'Faca'],
  ['4', 'Granadas (repetir para alternar)'], ['5', 'C4'], ['F', 'Inspecionar arma'], ['Q', 'Última arma'], ['Roda do mouse', 'Trocar arma']
];

export class SettingsPanel {
  root: HTMLDivElement;
  draft: SettingsData;
  tab = 'video';
  constructor(parent: HTMLElement, private onClose: () => void) {
    this.draft = { ...settings.data };
    this.root = el('div', 'settings-overlay');
    parent.appendChild(this.root);
    this.render();
    requestAnimationFrame(() => this.root.classList.add('show'));
  }

  render() {
    const t = TABS.find((x) => x.id === this.tab)!;
    const body = t.id === 'controls'
      ? `<table class="keys">${CONTROLS.map(([k, v]) => `<tr><td><kbd>${k}</kbd></td><td>${v}</td></tr>`).join('')}</table>`
      : t.fields.map((f) => this.field(f)).join('');
    this.root.innerHTML = `
      <div class="settings-panel">
        <div class="settings-head"><h2>CONFIGURAÇÕES</h2>
          <div class="settings-tabs">${TABS.map((x) => `<button class="${x.id === this.tab ? 'active' : ''}" data-tab="${x.id}">${x.label}</button>`).join('')}</div>
        </div>
        <div class="settings-body">${body}</div>
        <div class="settings-foot">
          <button data-act="reset">RESTAURAR PADRÃO</button>
          <span class="settings-status"></span>
          <button data-act="back">VOLTAR</button>
          <button data-act="apply" class="primary">APLICAR</button>
        </div>
      </div>`;
    this.root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) => (b.onclick = () => { audio.ui('click'); this.tab = b.dataset.tab!; this.render(); }));
    this.root.querySelectorAll<HTMLInputElement>('input[type=range]').forEach((i) => {
      i.oninput = () => {
        const k = i.dataset.k as keyof SettingsData;
        (this.draft as any)[k] = parseFloat(i.value);
        const out = this.root.querySelector(`[data-out="${k}"]`);
        const f = t.fields.find((x) => x.k === k) as any;
        if (out) out.textContent = f.fmt ? f.fmt(parseFloat(i.value)) : i.value;
        this.preview();
      };
    });
    this.root.querySelectorAll<HTMLSelectElement>('select').forEach((s) => (s.onchange = () => { (this.draft as any)[s.dataset.k!] = s.value; }));
    this.root.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach((c) => (c.onchange = () => { (this.draft as any)[c.dataset.k!] = c.checked; this.preview(); }));
    this.root.querySelectorAll<HTMLInputElement>('input[type=text]').forEach((c) => (c.oninput = () => { (this.draft as any)[c.dataset.k!] = c.value.slice(0, 16) || 'Player'; }));
    this.root.querySelectorAll<HTMLButtonElement>('.swatch').forEach((b) => (b.onclick = () => {
      (this.draft as any)[b.dataset.k!] = b.dataset.v;
      this.root.querySelectorAll(`.swatch[data-k="${b.dataset.k}"]`).forEach((x) => x.classList.toggle('active', x === b));
      this.preview();
    }));
    this.root.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => (b.onclick = () => {
      const a = b.dataset.act;
      if (a === 'apply') {
        settings.apply(this.draft);
        audio.ui('equip');
        const st = this.root.querySelector('.settings-status')!;
        st.textContent = '✔ Configurações aplicadas e salvas';
      } else if (a === 'reset') {
        this.draft = { ...DEFAULT_SETTINGS, playerName: this.draft.playerName };
        audio.ui('click');
        this.render();
      } else { audio.ui('back'); this.onClose(); }
    }));
    this.root.querySelectorAll('button').forEach((b) => b.addEventListener('mouseenter', () => audio.ui('hover')));
    this.preview();
  }

  private preview() {
    const pv = this.root.querySelector('.xh-preview') as HTMLElement | null;
    if (!pv) return;
    const d = this.draft;
    pv.style.setProperty('--xc', d.crosshairColor);
    pv.style.setProperty('--xs', d.crosshairSize + 'px');
    pv.style.setProperty('--xt', d.crosshairThickness + 'px');
    pv.style.setProperty('--xg', d.crosshairGap + 'px');
    pv.classList.toggle('has-dot', d.crosshairDot);
  }

  private field(f: Field) {
    const v = this.draft[f.k] as any;
    let ctl = '';
    if (f.type === 'range') ctl = `<input type="range" min="${f.min}" max="${f.max}" step="${f.step}" value="${v}" data-k="${f.k}"><output data-out="${f.k}">${f.fmt ? f.fmt(v) : v}</output>`;
    else if (f.type === 'select') ctl = `<select data-k="${f.k}">${f.options.map(([val, l]) => `<option value="${val}" ${val === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    else if (f.type === 'toggle') ctl = `<label class="toggle"><input type="checkbox" data-k="${f.k}" ${v ? 'checked' : ''}><span></span></label>`;
    else if (f.type === 'text') ctl = `<input type="text" maxlength="16" value="${String(v).replace(/"/g, '')}" data-k="${f.k}">`;
    else if (f.type === 'color') ctl = f.options.map((c) => `<button class="swatch ${c === v ? 'active' : ''}" style="background:${c}" data-k="${f.k}" data-v="${c}"></button>`).join('') + `<div class="xh-preview"><i class="x-l"></i><i class="x-r"></i><i class="x-t"></i><i class="x-b"></i><i class="x-dot"></i></div>`;
    return `<div class="set-row"><label>${f.label}</label><div class="set-ctl">${ctl}</div></div>`;
  }

  destroy() { this.root.remove(); }
}
