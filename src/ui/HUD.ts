import * as THREE from 'three';
import type { GameSession } from '../game/GameSession';
import type { Actor } from '../game/Actor';
import { el, fmtTime, money, clamp } from '../core/util';
import { settings } from '../core/Settings';
import { weaponIcon } from '../render/thumbnails';
import { GW, GH, CELL, OX, OZ } from '../world/Dust2';
import { WEAPONS } from '../data/weapons';

const ICON = {
  health: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z"/></svg>`,
  armor: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z"/></svg>`,
  helmet: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 3C6.5 3 3 7 3 12v3h4l1 3h10l2-3h1v-3c0-5-3.5-9-9-9z"/></svg>`,
  kit: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M4 7h16v12H4zM9 4h6v3H9z"/></svg>`,
  bomb: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 8h18v10H3zM6 5h4v3H6zm8 0h4v3h-4zM7 11h4v2H7z"/></svg>`,
  skull: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a8 8 0 00-8 8c0 3 1.5 5 3 6v3h10v-3c1.5-1 3-3 3-6a8 8 0 00-8-8zm-3 9a2 2 0 110-4 2 2 0 010 4zm6 0a2 2 0 110-4 2 2 0 010 4z"/></svg>`,
  hs: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2.5"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`
};

export class HUD {
  root: HTMLDivElement;
  s: GameSession;
  private els: Record<string, HTMLElement> = {};
  private radar: HTMLCanvasElement;
  private radarBg: HTMLCanvasElement;
  private kills: HTMLDivElement;
  private xh: HTMLDivElement;
  private xhKick = 0;
  private msgT = 0;
  private noticeT = 0;
  private hitT = 0;
  private cache: Record<string, string> = {};
  private fpsAcc = 0; private fpsN = 0; private fpsT = 0;
  scoreboardOpen = false;
  private dmgIndicators: { el: HTMLElement; t: number; from: THREE.Vector3 }[] = [];

  constructor(s: GameSession, parent: HTMLElement) {
    this.s = s;
    const r = (this.root = el('div', 'hud'));
    parent.appendChild(r);
    r.innerHTML = `
      <div class="hud-top">
        <div class="hud-team t"><div class="hud-avs" data-k="avT"></div><div class="hud-alive" data-k="aliveT"></div></div>
        <div class="hud-score t" data-k="scoreT">0</div>
        <div class="hud-timer-box"><div class="hud-timer" data-k="timer">1:55</div><div class="hud-bombicon" data-k="bombIcon">${ICON.bomb}</div><div class="hud-round" data-k="roundLbl">ROUND 1</div></div>
        <div class="hud-score ct" data-k="scoreCT">0</div>
        <div class="hud-team ct"><div class="hud-alive" data-k="aliveCT"></div><div class="hud-avs" data-k="avCT"></div></div>
      </div>
      <div class="hud-radar-wrap"><canvas class="hud-radar" width="230" height="230"></canvas><div class="hud-loc" data-k="loc"></div></div>
      <div class="hud-fps" data-k="fps"></div>
      <div class="hud-killfeed"></div>
      <div class="hud-xh"></div>
      <div class="hud-hit" data-k="hit"><i></i><i></i><i></i><i></i></div>
      <div class="hud-target" data-k="target"></div>
      <div class="hud-center" data-k="center"><div class="hud-center-title" data-k="cTitle"></div><div class="hud-center-sub" data-k="cSub"></div></div>
      <div class="hud-roundend" data-k="roundEnd"><div class="re-bar"><div class="re-title" data-k="reTitle"></div><div class="re-sub" data-k="reSub"></div></div></div>
      <div class="hud-notice" data-k="notice"></div>
      <div class="hud-progress" data-k="prog"><div class="hud-progress-lbl" data-k="progLbl"></div><div class="hud-progress-bar"><i data-k="progFill"></i></div></div>
      <div class="hud-hint" data-k="hint"></div>
      <div class="hud-bl">
        <div class="hud-hp"><span class="ico">${ICON.health}</span><span class="num" data-k="hp">100</span><div class="hpbar"><i data-k="hpBar"></i></div></div>
        <div class="hud-ar"><span class="ico" data-k="arIco">${ICON.armor}</span><span class="num" data-k="ar">0</span><span class="kit" data-k="kit">${ICON.kit}</span></div>
        <div class="hud-money" data-k="money">$800</div>
        <div class="hud-buyhint" data-k="buyHint">[B] Menu de compras</div>
      </div>
      <div class="hud-br">
        <div class="hud-weapons" data-k="weapons"></div>
        <div class="hud-ammo"><span class="mag" data-k="mag">20</span><span class="sep">|</span><span class="res" data-k="res">120</span></div>
        <div class="hud-wname" data-k="wname"></div>
        <button class="hud-inspect" data-k="inspectBtn" type="button" aria-label="Inspecionar faca">⟳ <span>INSPECIONAR</span> <kbd>F</kbd></button>
      </div>
      <div class="hud-scope" data-k="scope"><div class="scope-ring"></div><div class="scope-h"></div><div class="scope-v"></div></div>
      <div class="hud-flash" data-k="flash"></div>
      <div class="hud-smoke" data-k="smoke"></div>
      <div class="hud-hurt" data-k="hurt"></div>
      <div class="hud-dead" data-k="dead"><div class="dead-title" data-k="deadTitle"></div><div class="dead-sub" data-k="deadSub"></div></div>
      <div class="hud-bombtimer" data-k="bombTimer"></div>
      <div class="hud-scoreboard" data-k="sb"></div>
    `;
    r.querySelectorAll<HTMLElement>('[data-k]').forEach((e) => (this.els[e.dataset.k!] = e));
    this.radar = r.querySelector('.hud-radar')!;
    this.els.inspectBtn.addEventListener('click', () => this.s.inspectWeapon());
    this.kills = r.querySelector('.hud-killfeed')!;
    this.xh = r.querySelector('.hud-xh')!;
    this.buildCrosshair();
    settings.onChange(() => this.buildCrosshair());
    // pre-render radar background
    this.radarBg = document.createElement('canvas');
    this.radarBg.width = GW * 8; this.radarBg.height = GH * 8;
    const c = this.radarBg.getContext('2d')!;
    for (let z = 0; z < GH; z++) for (let x = 0; x < GW; x++) {
      const cell = s.map.cells[z][x];
      if (!cell.walk) continue;
      const l = 52 + cell.h * 14;
      c.fillStyle = cell.tag === 'A' || cell.tag === 'B' ? `hsl(8,35%,${l - 8}%)` : `hsl(35,22%,${l}%)`;
      c.fillRect(x * 8, z * 8, 8, 8);
      if (cell.blocked) { c.fillStyle = 'rgba(60,45,30,0.85)'; c.fillRect(x * 8 + 1, z * 8 + 1, 6, 6); }
    }
    c.strokeStyle = 'rgba(0,0,0,0.5)';
    c.font = 'bold 28px Bahnschrift, Arial'; c.fillStyle = 'rgba(255,90,70,0.9)'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('A', 29 * 8, 6.5 * 8); c.fillText('B', 5.5 * 8, 6.5 * 8);
    c.font = 'bold 13px Bahnschrift, Arial'; c.fillStyle = 'rgba(255,220,120,0.8)';
    c.fillText('T', 18 * 8, 39 * 8); c.fillStyle = 'rgba(140,180,255,0.9)'; c.fillText('CT', 17 * 8, 5 * 8);
  }

  buildCrosshair() {
    const d = settings.data;
    this.xh.innerHTML = '';
    this.xh.style.setProperty('--xc', d.crosshairColor);
    this.xh.style.setProperty('--xs', d.crosshairSize + 'px');
    this.xh.style.setProperty('--xt', d.crosshairThickness + 'px');
    for (const k of ['l', 'r', 't', 'b']) this.xh.appendChild(el('i', 'x-' + k));
    if (d.crosshairDot) this.xh.appendChild(el('b', 'x-dot'));
  }

  crosshairKick(a: number) { this.xhKick = Math.min(30, this.xhKick + a * 600 + 3); }

  hitmarker(head: boolean) {
    this.hitT = 0.25;
    this.els.hit.classList.toggle('head', head);
  }

  damageFrom(from: THREE.Vector3) {
    const e = el('div', 'hud-dmgind');
    this.root.appendChild(e);
    this.dmgIndicators.push({ el: e, t: 1.2, from: from.clone() });
    this.els.hurt.style.opacity = '0.55';
  }

  centerMessage(title: string, sub: string, color: string, seconds: number) {
    this.els.cTitle.textContent = title;
    this.els.cTitle.style.color = color;
    this.els.cSub.textContent = sub;
    this.els.center.classList.add('show');
    this.msgT = seconds;
  }

  notice(text: string) {
    this.els.notice.textContent = text;
    this.els.notice.classList.add('show');
    this.noticeT = 2.2;
  }

  roundEnd(title: string, sub: string, winner: 'T' | 'CT', playerWon: boolean) {
    const re = this.els.roundEnd;
    re.className = 'hud-roundend show ' + (winner === 'T' ? 't' : 'ct') + (playerWon ? ' win' : ' lose');
    this.els.reTitle.textContent = title;
    this.els.reSub.textContent = sub;
    setTimeout(() => re.classList.remove('show'), 5200);
  }

  killfeed(killer: Actor | null, victim: Actor, weapon: string, headshot: boolean) {
    const row = el('div', 'kf-row' + ((killer && killer.isPlayer) || victim.isPlayer ? ' me' : ''));
    const icon = WEAPONS[weapon] ? `<img src="${weaponIcon(weapon)}" class="kf-ico">` : weapon === 'c4' ? ICON.bomb : ICON.skull;
    row.innerHTML = `${killer && killer !== victim ? `<span class="${killer.team === 'T' ? 't' : 'ct'}">${killer.name}</span>` : ''}
      <span class="kf-w">${icon}${headshot ? `<span class="kf-hs">${ICON.hs}</span>` : ''}</span>
      <span class="${victim.team === 'T' ? 't' : 'ct'}">${victim.name}</span>`;
    this.kills.prepend(row);
    setTimeout(() => row.classList.add('fade'), 6000);
    setTimeout(() => row.remove(), 7000);
    while (this.kills.children.length > 6) this.kills.lastChild!.remove();
  }
  killfeedRaw(html: string) {
    const row = el('div', 'kf-row info', html);
    this.kills.prepend(row);
    setTimeout(() => row.classList.add('fade'), 5000);
    setTimeout(() => row.remove(), 6000);
  }

  private set(k: string, v: string) {
    if (this.cache[k] === v) return;
    this.cache[k] = v;
    this.els[k].textContent = v;
  }
  private html(k: string, v: string) {
    if (this.cache['h' + k] === v) return;
    this.cache['h' + k] = v;
    this.els[k].innerHTML = v;
  }

  update(dt: number) {
    const s = this.s, m = s.match;
    const viewed = s.viewTarget();
    const p = s.player;
    // fps
    this.fpsAcc += dt; this.fpsN++; this.fpsT += dt;
    if (this.fpsT > 0.5) { this.set('fps', settings.data.showFps ? `${Math.round(this.fpsN / this.fpsAcc)} FPS` : ''); this.fpsAcc = 0; this.fpsN = 0; this.fpsT = 0; }
    // top bar
    this.set('scoreT', String(m.score.T));
    this.set('scoreCT', String(m.score.CT));
    const planted = m.phase === 'planted';
    this.els.bombIcon.style.display = planted ? 'block' : 'none';
    this.els.timer.style.display = planted ? 'none' : 'block';
    const t = m.phase === 'freeze' ? m.timer : m.phase === 'live' ? m.timer : m.phase === 'post' ? 0 : 0;
    this.set('timer', fmtTime(t));
    this.els.timer.classList.toggle('low', m.phase === 'live' && m.timer < 10);
    this.els.timer.classList.toggle('freeze', m.phase === 'freeze');
    this.set('roundLbl', m.phase === 'freeze' ? 'TEMPO DE COMPRA' : `ROUND ${m.round}`);
    const ts = s.actors.filter((a) => a.team === 'T'), cts = s.actors.filter((a) => a.team === 'CT');
    const av = (list: Actor[]) => list.map((a) => `<div class="av ${a.alive ? '' : 'dead'} ${a.isPlayer ? 'me' : ''}" style="background:${a.avatarColor}" title="${a.name}">${a.name[0]}${a.c4 ? '<b class="c4dot"></b>' : ''}</div>`).join('');
    this.html('avT', av(ts));
    this.html('avCT', av(cts));
    this.set('aliveT', String(ts.filter((a) => a.alive).length));
    this.set('aliveCT', String(cts.filter((a) => a.alive).length));
    // bomb timer bar (for CT/T awareness)
    if (planted) {
      const b = m.bomb;
      const def = b.defuser ? `<span class="defusing">DESARMANDO ${(b.defuseTotal - b.defuseT).toFixed(1)}s</span>` : '';
      this.html('bombTimer', `<span class="bt-ico">${ICON.bomb}</span> BOMBA PLANTADA NO ${b.site} ${def}`);
      this.els.bombTimer.style.display = 'block';
    } else this.els.bombTimer.style.display = 'none';
    // player block
    const hpActor = viewed;
    this.set('hp', String(Math.max(0, hpActor.hp)));
    (this.els.hpBar as HTMLElement).style.width = clamp(hpActor.hp, 0, 100) + '%';
    this.els.hp.parentElement!.classList.toggle('low', hpActor.hp <= 25);
    this.set('ar', String(hpActor.armor));
    this.html('arIco', hpActor.helmet ? ICON.helmet : ICON.armor);
    this.els.kit.style.display = hpActor.kit ? 'inline-block' : 'none';
    this.set('money', money(hpActor.money));
    const canBuy = p.alive && m.canBuy(p);
    this.els.buyHint.style.display = canBuy ? 'block' : 'none';
    this.set('buyHint', `[B] Comprar · ${Math.ceil(m.buyTimeLeft)}s`);
    // weapon block
    const w = hpActor.weapon;
    const d = w.def;
    this.els.inspectBtn.style.display = p.alive && p.slot === 'knife' && viewed === p ? 'inline-flex' : 'none';
    const showAmmo = d.mag > 0 && d.category !== 'grenade' && d.category !== 'c4';
    this.els.mag.parentElement!.style.visibility = showAmmo ? 'visible' : 'hidden';
    this.set('mag', String(w.mag));
    this.set('res', String(w.reserve));
    this.els.mag.classList.toggle('low', showAmmo && w.mag <= Math.ceil(d.mag * 0.2));
    this.set('wname', w.reloading ? 'RECARREGANDO…' : d.name);
    const slots: [string, string, string | null][] = [
      ['1', hpActor.primary ? hpActor.primary.def.id : '', 'primary'],
      ['2', hpActor.secondary ? hpActor.secondary.def.id : '', 'secondary'],
      ['3', 'knife', 'knife'],
      ['4', hpActor.grenades.map((g) => g.def.id).join(','), 'grenade'],
      ['5', hpActor.c4 ? 'c4' : '', 'c4']
    ];
    const wh = slots.filter((x) => x[1]).map(([k, ids, slot]) => {
      const imgs = ids.split(',').map((id) => `<img src="${weaponIcon(id)}" class="${slot === 'grenade' ? 'nade' : ''}">`).join('');
      return `<div class="ws ${hpActor.slot === slot ? 'active' : ''}"><span class="k">${k}</span>${imgs}</div>`;
    }).join('');
    this.html('weapons', wh);
    // crosshair
    const pc = s.pc;
    const scoped = pc.scoped && p.alive;
    const hideXh = scoped || !p.alive || d.category === 'sniper' && !scoped;
    this.xh.style.display = hideXh ? 'none' : 'block';
    if (d.category === 'sniper' && !scoped && p.alive) { this.xh.style.display = 'none'; }
    const speed = Math.hypot(p.vel.x, p.vel.z);
    this.xhKick = Math.max(0, this.xhKick - dt * 60);
    const dyn = settings.data.crosshairDynamic ? clamp(speed * 1.6 + (p.onGround ? 0 : 12) + this.xhKick, 0, 26) : 0;
    this.xh.style.setProperty('--xg', settings.data.crosshairGap + dyn + 'px');
    this.els.scope.style.display = scoped ? 'block' : 'none';
    // hitmarker
    this.hitT -= dt;
    this.els.hit.style.opacity = this.hitT > 0 ? String(Math.min(1, this.hitT * 6)) : '0';
    // flash & smoke & hurt
    const fl = p.alive && p.flash > 0 ? Math.min(1, p.flash / Math.max(0.5, p.flashMax * 0.35)) : 0;
    this.els.flash.style.opacity = String(fl);
    this.els.smoke.style.opacity = String(s.grenades.density(s.camera.position) * 0.97);
    const hurtO = parseFloat(this.els.hurt.style.opacity || '0');
    this.els.hurt.style.opacity = String(Math.max(p.alive && p.hp < 30 ? 0.35 + Math.sin(s.time * 4) * 0.1 : 0, hurtO - dt * 1.2));
    for (let i = this.dmgIndicators.length - 1; i >= 0; i--) {
      const di = this.dmgIndicators[i];
      di.t -= dt;
      const ang = Math.atan2(di.from.x - p.pos.x, di.from.z - p.pos.z);
      const rel = ang - Math.atan2(-Math.sin(p.yaw), -Math.cos(p.yaw));
      di.el.style.transform = `translate(-50%,-50%) rotate(${-rel}rad) translateY(-130px)`;
      di.el.style.opacity = String(Math.max(0, di.t));
      if (di.t <= 0) { di.el.remove(); this.dmgIndicators.splice(i, 1); }
    }
    // messages
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) this.els.center.classList.remove('show'); }
    if (this.noticeT > 0) { this.noticeT -= dt; if (this.noticeT <= 0) this.els.notice.classList.remove('show'); }
    // interaction progress
    const b = m.bomb;
    let prog = -1, lbl = '';
    if (pc.interact === 'plant') { prog = pc.interactT / m.plantTime; lbl = 'PLANTANDO A BOMBA…'; }
    else if (b.defuser === p) { prog = b.defuseT / b.defuseTotal; lbl = p.kit ? 'DESARMANDO (KIT)…' : 'DESARMANDO A BOMBA…'; }
    this.els.prog.style.display = prog >= 0 ? 'block' : 'none';
    if (prog >= 0) { (this.els.progFill as HTMLElement).style.width = clamp(prog * 100, 0, 100) + '%'; this.set('progLbl', lbl); }
    // contextual hints
    let hint = '';
    if (p.alive && prog < 0) {
      if (p.c4 && s.map.siteAt(p.pos) && m.phase === 'live') hint = 'Segure <b>[E]</b> para plantar a bomba';
      else if (p.c4 && m.phase === 'live' && p.slot === 'c4') hint = 'Vá até o Bombsite <b>A</b> ou <b>B</b> para plantar';
      else if (m.canDefuse(p)) hint = `Segure <b>[E]</b> para desarmar${p.kit ? ' (kit: 5s)' : ' (10s)'}`;
      else if (s.nearbyDrop(p)) hint = `<b>[E]</b> Pegar ${s.nearbyDrop(p)!.inst.def.name}`;
      else if (d.mag > 0 && w.mag === 0 && w.reserve === 0 && showAmmo) hint = 'Sem munição';
    }
    this.html('hint', hint);
    this.els.hint.style.display = hint ? 'block' : 'none';
    // target name under crosshair
    const tgt = s.aimedActor();
    this.html('target', tgt ? `<span class="${tgt.team === p.team ? 'ally' : 'enemy'}">${tgt.name}</span>${tgt.team === p.team ? ` <small>${tgt.hp} HP</small>` : ''}` : '');
    // death / spectate
    if (!p.alive) {
      this.els.dead.style.display = 'block';
      this.set('deadTitle', viewed !== p ? `ASSISTINDO: ${viewed.name.toUpperCase()}` : 'VOCÊ FOI ELIMINADO');
      this.set('deadSub', s.killedBy ? `Eliminado por ${s.killedBy}` + (viewed !== p ? ' · [Clique] próximo jogador' : '') : (viewed !== p ? '[Clique] próximo jogador' : ''));
    } else this.els.dead.style.display = 'none';
    // location
    this.set('loc', s.map.locationName(viewed.pos));
    this.drawRadar(viewed);
    if (this.scoreboardOpen) this.renderScoreboard();
  }

  private drawRadar(center: Actor) {
    const c = this.radar.getContext('2d')!;
    const W = this.radar.width;
    c.clearRect(0, 0, W, W);
    c.save();
    c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2); c.clip();
    c.fillStyle = 'rgba(15,18,22,0.75)'; c.fillRect(0, 0, W, W);
    const scale = 8 / CELL * 0.62; // px per meter
    const px = (center.pos.x - OX) * (8 / CELL), pz = (center.pos.z - OZ) * (8 / CELL);
    c.translate(W / 2, W / 2);
    c.rotate(center.yaw);
    c.scale(0.62, 0.62);
    c.translate(-px, -pz);
    c.globalAlpha = 0.95;
    c.drawImage(this.radarBg, 0, 0);
    c.globalAlpha = 1;
    const s = this.s, p = s.player;
    const toR = (v: THREE.Vector3) => [(v.x - OX) * (8 / CELL), (v.z - OZ) * (8 / CELL)];
    // bomb
    const b = s.match.bomb;
    if (b.state === 'planted' || b.state === 'dropped') {
      const [bx, bz] = toR(b.pos);
      if (b.state === 'planted' || p.team === 'T') {
        c.fillStyle = Math.sin(s.time * 10) > 0 ? '#ff3b30' : '#ffb000';
        c.fillRect(bx - 6, bz - 4, 12, 8);
      }
    }
    for (const a of s.actors) {
      const ally = a.team === center.team;
      const seen = ally || s.spotted.has(a.id);
      if (!seen) continue;
      const [x, z] = toR(a.pos);
      if (!a.alive) {
        c.strokeStyle = ally ? '#6a8' : '#a55'; c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(x - 5, z - 5); c.lineTo(x + 5, z + 5); c.moveTo(x + 5, z - 5); c.lineTo(x - 5, z + 5); c.stroke();
        continue;
      }
      c.fillStyle = a === center ? '#ffffff' : ally ? (a.team === 'T' ? '#f0c060' : '#79a7ff') : '#ff4d4d';
      c.beginPath(); c.arc(x, z, a === center ? 7 : 6, 0, Math.PI * 2); c.fill();
      // direction tick
      c.strokeStyle = c.fillStyle; c.lineWidth = 3;
      c.beginPath(); c.moveTo(x, z); c.lineTo(x - Math.sin(a.yaw) * 12, z - Math.cos(a.yaw) * 12); c.stroke();
      if (a.c4) { c.fillStyle = '#ff3b30'; c.fillRect(x + 5, z - 9, 6, 5); }
    }
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 2;
    c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 2, 0, Math.PI * 2); c.stroke();
    void scale;
  }

  renderScoreboard() {
    const s = this.s, m = s.match;
    const rows = (team: 'T' | 'CT') => s.actors.filter((a) => a.team === team).sort((a, b) => b.score - a.score || b.kills - a.kills).map((a) => `
      <tr class="${a.alive ? '' : 'dead'} ${a.isPlayer ? 'me' : ''}">
        <td class="sb-av"><span style="background:${a.avatarColor}">${a.name[0]}</span></td>
        <td class="sb-name">${a.name}${a.c4 && (s.player.team === 'T') ? ' <span class="sb-c4">C4</span>' : ''}${a.mvps ? ` <span class="sb-mvp">★${a.mvps}</span>` : ''}</td>
        <td>${team === s.player.team || !a.alive ? money(a.money) : ''}</td>
        <td>${a.kills}</td><td>${a.deaths}</td><td>${a.assists}</td><td>${a.score}</td>
        <td class="sb-ping">${a.isPlayer ? 'LOCAL' : 'BOT'}</td>
      </tr>`).join('');
    const head = `<tr><th></th><th>JOGADOR</th><th>DINHEIRO</th><th>K</th><th>M</th><th>A</th><th>PONTOS</th><th>PING</th></tr>`;
    const hist = m.history.map((h) => `<i class="${h.winner === 'T' ? 't' : 'ct'}" title="${h.reason}">${{ elim: '☠', bomb: '✹', defuse: '✂', time: '⏱' }[h.reason]}</i>`).join('');
    this.html('sb', `
      <div class="sb-head"><div class="sb-map">DUST II · COMPETITIVO (BOTS) · OFFLINE</div><div class="sb-hist">${hist}</div></div>
      <div class="sb-team ct"><div class="sb-title"><span>CONTRA-TERRORISTAS</span><b>${m.score.CT}</b></div><table>${head}${rows('CT')}</table></div>
      <div class="sb-team t"><div class="sb-title"><span>TERRORISTAS</span><b>${m.score.T}</b></div><table>${head}${rows('T')}</table></div>
    `);
  }

  setScoreboard(open: boolean) {
    this.scoreboardOpen = open;
    this.els.sb.style.display = open ? 'block' : 'none';
    if (open) this.renderScoreboard();
  }

  destroy() { this.root.remove(); }
}
