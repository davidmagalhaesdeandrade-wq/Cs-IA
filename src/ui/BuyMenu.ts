import type { GameSession } from '../game/GameSession';
import { BUY_LAYOUT, EQUIPMENT, WEAPONS, GRENADE_LIMITS, MAX_GRENADES } from '../data/weapons';
import { el, money } from '../core/util';
import { weaponIcon } from '../render/thumbnails';
import { audio } from '../core/Audio';
import { WeaponInst } from '../game/Actor';
import { skinManager } from '../data/skins';

const EQUIP_ICON: Record<string, string> = {
  kevlar: `<svg viewBox="0 0 24 24" width="64" height="40"><path fill="#fff" d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z"/></svg>`,
  kevlarHelmet: `<svg viewBox="0 0 48 24" width="90" height="40"><path fill="#fff" d="M12 3C7 3 3 7 3 12v3h4l1 3h8l2-3h1v-3c0-5-3-9-7-9z"/><path fill="#fff" d="M34 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z"/></svg>`,
  defuser: `<svg viewBox="0 0 24 24" width="64" height="40"><path fill="#fff" d="M5 3l5 6-2 2-5-6zM19 3l-5 6 2 2 5-6zM8 12h8v9H8z"/></svg>`
};

export class BuyMenu {
  root: HTMLDivElement;
  open = false;
  constructor(private s: GameSession, parent: HTMLElement) {
    this.root = el('div', 'buymenu');
    parent.appendChild(this.root);
  }

  toggle(v?: boolean) {
    this.open = v ?? !this.open;
    this.root.classList.toggle('show', this.open);
    if (this.open) this.render();
  }

  /** why the player cannot buy this item, or null if allowed */
  reason(id: string): string | null {
    const p = this.s.player;
    const m = this.s.match;
    if (!p.alive) return 'Você está morto';
    if (m.buyTimeLeft <= 0) return 'Tempo de compra esgotado';
    if (!m.canBuy(p)) return 'Fora da zona de compra';
    const eq = EQUIPMENT.find((e) => e.id === id);
    if (eq) {
      if (eq.team !== 'both' && eq.team !== p.team) return 'Exclusivo CT';
      if (id === 'defuser' && p.kit) return 'Você já possui';
      if (id === 'kevlar' && p.armor >= 100) return 'Você já possui';
      if (id === 'kevlarHelmet' && p.armor >= 100 && p.helmet) return 'Você já possui';
      const price = this.price(id);
      if (p.money < price) return 'Dinheiro insuficiente';
      return null;
    }
    const d = WEAPONS[id];
    if (d.team !== 'both' && d.team !== p.team) return d.team === 'T' ? 'Exclusivo TR' : 'Exclusivo CT';
    if (d.slot === 'grenade') {
      const have = p.grenades.filter((g) => g.def.id === id).length;
      if (have >= (GRENADE_LIMITS[id] ?? 1)) return 'Limite atingido';
      if (p.grenades.length >= MAX_GRENADES) return 'Limite de granadas';
    }
    if (d.slot === 'primary' && p.primary?.def.id === id) return 'Você já possui';
    if (d.slot === 'secondary' && p.secondary?.def.id === id) return 'Você já possui';
    if (p.money < d.price) return 'Dinheiro insuficiente';
    return null;
  }

  price(id: string) {
    const p = this.s.player;
    if (id === 'kevlarHelmet') return p.armor >= 100 ? 350 : 1000;
    const eq = EQUIPMENT.find((e) => e.id === id);
    if (eq) return eq.price;
    return WEAPONS[id].price;
  }

  buy(id: string) {
    const r = this.reason(id);
    if (r) { audio.ui('error'); this.s.hud.notice(r); return; }
    const p = this.s.player;
    const price = this.price(id);
    p.money -= price;
    if (id === 'kevlar') p.armor = 100;
    else if (id === 'kevlarHelmet') { p.armor = 100; p.helmet = true; }
    else if (id === 'defuser') p.kit = true;
    else {
      const d = WEAPONS[id];
      const inst = new WeaponInst(id, skinManager.get(id));
      if (d.slot === 'primary') {
        if (p.primary) this.s.dropWeaponAt(p.primary, p.pos.clone());
        p.primary = inst;
        this.s.pc.equip('primary', true);
      } else if (d.slot === 'secondary') {
        if (p.secondary) this.s.dropWeaponAt(p.secondary, p.pos.clone());
        p.secondary = inst;
        if (!p.primary) this.s.pc.equip('secondary', true);
      } else if (d.slot === 'grenade') p.grenades.push(inst);
    }
    audio.buy();
    this.render();
  }

  render() {
    const p = this.s.player;
    const m = this.s.match;
    const cols = BUY_LAYOUT.map((col, ci) => {
      const items = col.items.map((id, ii) => {
        const r = this.reason(id);
        const eq = EQUIPMENT.find((e) => e.id === id);
        const name = eq ? eq.name : WEAPONS[id].name;
        const team = eq ? eq.team : WEAPONS[id].team;
        if (team !== 'both' && team !== p.team) return '';
        const icon = eq ? EQUIP_ICON[id] : `<img src="${weaponIcon(id)}">`;
        const owned = r === 'Você já possui';
        return `<button class="buy-item ${r ? 'na' : ''} ${owned ? 'owned' : ''}" data-id="${id}" title="${r ?? ''}">
          <span class="bi-key">${ii + 1}</span><span class="bi-name">${name}</span>
          <span class="bi-icon">${icon}</span>
          <span class="bi-price">${money(this.price(id))}</span>
          ${r && !owned ? `<span class="bi-reason">${r}</span>` : ''}${owned ? '<span class="bi-reason ok">EQUIPADO</span>' : ''}
        </button>`;
      }).join('');
      return `<div class="buy-col"><div class="buy-col-title"><span>${ci + 1}</span>${col.title}</div>${items}</div>`;
    }).join('');
    this.root.innerHTML = `
      <div class="buy-panel">
        <div class="buy-head"><span class="buy-money">${money(p.money)}</span><span class="buy-time">Tempo de compra restante <b>${Math.ceil(m.buyTimeLeft)}s</b></span><span class="buy-team ${p.team === 'T' ? 't' : 'ct'}">${p.team === 'T' ? 'TERRORISTAS' : 'CONTRA-TERRORISTAS'}</span></div>
        <div class="buy-grid">${cols}</div>
        <div class="buy-foot"><span>[B] / [ESC] FECHAR</span><span>Clique para comprar · itens repetidos substituem o atual</span></div>
      </div>`;
    this.root.querySelectorAll<HTMLButtonElement>('.buy-item').forEach((b) => {
      b.onclick = () => this.buy(b.dataset.id!);
      b.onmouseenter = () => audio.ui('hover');
    });
  }

  tick() {
    if (!this.open) return;
    const t = this.root.querySelector('.buy-time b');
    if (t) t.textContent = Math.ceil(this.s.match.buyTimeLeft) + 's';
    if (this.s.match.buyTimeLeft <= 0 || !this.s.player.alive) this.s.closeBuyMenu();
  }
}
