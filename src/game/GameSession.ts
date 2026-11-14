import * as THREE from 'three';
import { Dust2Map } from '../world/Dust2';
import { CollisionWorld } from '../world/Collision';
import { Nav } from '../world/Nav';
import { Actor, Team, WeaponInst, HitGroup } from './Actor';
import { Bot, Difficulty, pickName } from './Bot';
import { Match } from './Match';
import { Effects } from './Effects';
import { Grenades } from './Grenades';
import { Viewmodel } from './Viewmodel';
import { PlayerController } from './PlayerController';
import { HUD } from '../ui/HUD';
import { BuyMenu } from '../ui/BuyMenu';
import { SettingsPanel } from '../ui/SettingsUI';
import { CharacterModel, AGENTS, AgentStyle } from '../render/characterModel';
import { buildWeapon } from '../render/weaponModels';
import { sharedEnv } from '../render/thumbnails';
import { input } from '../core/Input';
import { audio } from '../core/Audio';
import { settings } from '../core/Settings';
import { clamp, damp, dirFromYawPitch, el, pick, rand, shuffle, yawTo } from '../core/util';
import { WEAPONS } from '../data/weapons';
import { skinManager } from '../data/skins';
import { loadAgents } from '../ui/Loadout';

export interface MatchConfig {
  team: 'T' | 'CT' | 'random';
  difficulty: Difficulty;
  size: 1 | 3 | 5;
  money: 'standard' | 'rich';
}

interface Drop { inst: WeaponInst; mesh: THREE.Object3D; pos: THREE.Vector3; vel: THREE.Vector3; t: number }

export function hfovToV(hfov: number) {
  return (2 * Math.atan(Math.tan((hfov * Math.PI) / 360) / (4 / 3)) * 180) / Math.PI;
}

const cellPt = (map: Dust2Map, x: number, z: number) => map.cellCenter(x, z);

export class GameSession {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  map: Dust2Map;
  collision: CollisionWorld;
  nav: Nav;
  effects: Effects;
  grenades: Grenades;
  viewmodel: Viewmodel;
  hud!: HUD;
  buyMenu!: BuyMenu;
  match: Match;
  actors: Actor[] = [];
  bots: Bot[] = [];
  player: Actor;
  pc: PlayerController;
  playerModel: CharacterModel;
  config: MatchConfig;
  time = 0;
  paused = false;
  state: 'intro' | 'playing' | 'ended' = 'intro';
  introT = 0;
  drops: Drop[] = [];
  spotted = new Set<number>();
  killedBy: string | null = null;
  ui: HTMLDivElement;
  private spotT = 0;
  private specIdx = 0;
  private shakeAmt = 0;
  private expectUnlock = false;
  private pauseEl: HTMLDivElement;
  private endEl: HTMLDivElement;
  private introEl: HTMLDivElement;
  private lockEl: HTMLDivElement;
  private settingsPanel: SettingsPanel | null = null;
  private unsub: (() => void)[] = [];
  private specCam = new THREE.Vector3();
  private agents: Record<'T' | 'CT', string>;
  private touchControls: HTMLDivElement | null = null;
  private touchCleanup: (() => void)[] = [];
  onExit: (action: 'menu' | 'restart') => void;

  constructor(renderer: THREE.WebGLRenderer, config: MatchConfig, uiRoot: HTMLElement, onExit: (a: 'menu' | 'restart') => void) {
    this.renderer = renderer;
    this.config = config;
    this.onExit = onExit;
    this.camera = new THREE.PerspectiveCamera(hfovToV(settings.data.fov), innerWidth / innerHeight, 0.05, 1500);
    this.map = new Dust2Map();
    this.map.build(this.scene, settings.data.quality, settings.data.shadows);
    this.collision = this.map.collision;
    this.nav = new Nav(this.map);
    this.effects = new Effects(this.scene);
    this.grenades = new Grenades({
      collision: this.collision, effects: this.effects, scene: this.scene,
      actors: () => this.actors,
      damage: (v, a, hp, w, from) => this.damage(v, a, hp, 0, w, null, from),
      onFlash: (v, secs) => { v.flash = Math.max(v.flash, secs); v.flashMax = Math.max(v.flash, secs); if (v.isPlayer) this.shake(0.2); }
    });
    this.viewmodel = new Viewmodel(sharedEnv(renderer));
    this.agents = loadAgents();

    // ---------- teams ----------
    let team: Team = config.team === 'random' ? (Math.random() < 0.5 ? 'T' : 'CT') : config.team;
    this.player = new Actor(settings.data.playerName || 'Player', team, true);
    this.actors.push(this.player);
    const used = new Set<string>();
    const n = config.size;
    for (let i = 0; i < n - 1; i++) this.addBot(team, used);
    for (let i = 0; i < n; i++) this.addBot(team === 'T' ? 'CT' : 'T', used);
    this.pc = new PlayerController(this, this.player);
    this.playerModel = new CharacterModel(this.agentFor(this.player));
    this.playerModel.root.visible = false;
    this.scene.add(this.playerModel.root);
    this.match = new Match(this, config.money === 'rich' ? 16000 : 800);
    this.setViewmodelTeam();

    // ---------- UI ----------
    this.ui = el('div', 'game-ui');
    uiRoot.appendChild(this.ui);
    this.hud = new HUD(this, this.ui);
    this.buyMenu = new BuyMenu(this, this.ui);
    this.pauseEl = el('div', 'pause');
    this.ui.appendChild(this.pauseEl);
    this.endEl = el('div', 'matchend');
    this.ui.appendChild(this.endEl);
    this.introEl = el('div', 'intro', `<div class="intro-bars"></div><div class="intro-title"><small>COMPETITIVO · BOTS ${config.difficulty.toUpperCase()}</small><h1>DUST II</h1><p>${team === 'T' ? 'Você joga como TERRORISTA' : 'Você joga como CONTRA-TERRORISTA'}</p></div><div class="intro-skip">[ESPAÇO] / [CLIQUE] PULAR</div>`);
    this.ui.appendChild(this.introEl);
    this.lockEl = el('div', 'lockhint', 'CLIQUE PARA CONTINUAR');
    this.ui.appendChild(this.lockEl);
    this.createTouchControls();

    this.unsub.push(this.onKey.bind(this) as any);
    input.keyHandlers.push(this.keyHandler);
    input.lockHandlers.push(this.lockHandler);
    renderer.domElement.addEventListener('mousedown', this.clickHandler);
    input.gameActive = true;
    this.match.startMatch();
    this.hud.root.style.opacity = '0';
    audio.startAmbient();
    this.resize();
  }

  private createTouchControls() {
    if (!('ontouchstart' in window) && navigator.maxTouchPoints < 1) return;
    const root = el('div', 'touch-controls', `
      <div class="touch-stick-zone"><div class="touch-stick"><i></i></div></div>
      <div class="touch-look-zone" aria-label="Área para mover a câmera"></div>
      <div class="touch-actions">
        <button data-touch-key="Space" aria-label="Pular">↑</button>
        <button data-touch-key="ControlLeft" aria-label="Agachar">⌄</button>
        <button data-touch-key="ShiftLeft" aria-label="Andar em silêncio">SHIFT</button>
        <button data-touch-key="KeyR" aria-label="Recarregar">R</button>
        <button data-touch-key="KeyF" aria-label="Inspecionar">F</button>
        <button data-touch-key="KeyE" aria-label="Interagir">E</button>
        <button data-touch-key="Digit1" aria-label="Arma principal">1</button>
        <button data-touch-key="Digit2" aria-label="Pistola">2</button>
        <button data-touch-key="Digit3" aria-label="Faca">3</button>
        <button data-touch-key="Digit4" aria-label="Granada">4</button>
        <button data-touch-key="Digit5" aria-label="C4">5</button>
        <button data-touch-key="Escape" aria-label="Pausar">Ⅱ</button>
        <button data-touch-mouse="2" aria-label="Mira secundária">AIM</button>
        <button data-touch-mouse="0" class="touch-fire" aria-label="Atirar">FIRE</button>
      </div>`);
    this.ui.appendChild(root);
    this.touchControls = root;
    const stick = root.querySelector('.touch-stick-zone') as HTMLElement;
    const knob = root.querySelector('.touch-stick') as HTMLElement;
    let moveId = -1, lookId = -1, originX = 0, originY = 0, lastX = 0, lastY = 0;
    const releaseMove = () => {
      for (const k of ['KeyW','KeyA','KeyS','KeyD']) input.setVirtualKey(k, false);
      knob.style.transform = 'translate(0,0)';
      moveId = -1;
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== moveId) return;
      const dx = e.clientX - originX, dy = e.clientY - originY;
      const len = Math.max(1, Math.hypot(dx, dy)), scale = Math.min(1, 48 / len);
      const x = dx * scale, y = dy * scale;
      knob.style.transform = `translate(${x}px,${y}px)`;
      input.setVirtualKey('KeyW', y < -12);
      input.setVirtualKey('KeyS', y > 12);
      input.setVirtualKey('KeyA', x < -12);
      input.setVirtualKey('KeyD', x > 12);
    };
    const onMoveStart = (e: PointerEvent) => {
      if (moveId !== -1) return;
      e.preventDefault(); moveId = e.pointerId; originX = e.clientX; originY = e.clientY;
      stick.setPointerCapture(e.pointerId); move(e);
    };
    const onMoveEnd = (e: PointerEvent) => { if (e.pointerId === moveId) releaseMove(); };
    stick.addEventListener('pointerdown', onMoveStart);
    stick.addEventListener('pointermove', move);
    stick.addEventListener('pointerup', onMoveEnd);
    stick.addEventListener('pointercancel', onMoveEnd);
    const look = root.querySelector('.touch-look-zone') as HTMLElement;
    look.addEventListener('pointerdown', (e) => { if (lookId !== -1) return; e.preventDefault(); lookId = e.pointerId; lastX=e.clientX; lastY=e.clientY; look.setPointerCapture(e.pointerId); });
    look.addEventListener('pointermove', (e) => { if(e.pointerId!==lookId) return; input.addLookDelta((e.clientX-lastX)*1.35,(e.clientY-lastY)*1.35); lastX=e.clientX; lastY=e.clientY; });
    const stopLook = (e: PointerEvent) => { if(e.pointerId===lookId) lookId=-1; };
    look.addEventListener('pointerup', stopLook); look.addEventListener('pointercancel', stopLook);
    root.querySelectorAll<HTMLButtonElement>('[data-touch-key]').forEach((b) => {
      const key=b.dataset.touchKey!;
      const down=(e:PointerEvent)=>{e.preventDefault();b.setPointerCapture(e.pointerId);input.setVirtualKey(key,true);};
      const up=()=>input.setVirtualKey(key,false);
      b.addEventListener('pointerdown',down); b.addEventListener('pointerup',up); b.addEventListener('pointercancel',up); b.addEventListener('lostpointercapture',up);
    });
    root.querySelectorAll<HTMLButtonElement>('[data-touch-mouse]').forEach((b) => {
      const button=Number(b.dataset.touchMouse);
      const down=(e:PointerEvent)=>{e.preventDefault();b.setPointerCapture(e.pointerId);input.setVirtualMouse(button,true);};
      const up=()=>input.setVirtualMouse(button,false);
      b.addEventListener('pointerdown',down); b.addEventListener('pointerup',up); b.addEventListener('pointercancel',up); b.addEventListener('lostpointercapture',up);
    });
  }

  // ---------------------------------------------------------------- setup helpers
  private agentFor(a: Actor): AgentStyle {
    if (a.isPlayer) return AGENTS.find((x) => x.id === this.agents[a.team]) || AGENTS.find((x) => x.team === a.team)!;
    const list = AGENTS.filter((x) => x.team === a.team);
    return list[a.id % list.length];
  }

  private addBot(team: Team, used: Set<string>) {
    const a = new Actor('Bot ' + pickName(used), team, false);
    a.model = new CharacterModel(this.agentFor(a));
    this.scene.add(a.model.root);
    this.actors.push(a);
    this.bots.push(new Bot(this, a, this.config.difficulty));
  }

  private setViewmodelTeam() {
    const st = this.agentFor(this.player);
    this.viewmodel.setTeamColors(st.shirt, st.gloves);
  }

  swapTeams() {
    for (const a of this.actors) {
      a.team = a.team === 'T' ? 'CT' : 'T';
      a.primary = null; a.secondary = null; a.grenades = []; a.armor = 0; a.helmet = false; a.kit = false; a.c4 = null;
      a.alive = false; // forces re-equip in prepareRound
      if (a.model) {
        this.scene.remove(a.model.root);
        a.model = new CharacterModel(this.agentFor(a));
        this.scene.add(a.model.root);
      }
    }
    this.scene.remove(this.playerModel.root);
    this.playerModel = new CharacterModel(this.agentFor(this.player));
    this.playerModel.root.visible = false;
    this.scene.add(this.playerModel.root);
    this.setViewmodelTeam();
  }

  prepareRound() {
    // clear world
    for (const d of this.drops) this.scene.remove(d.mesh);
    this.drops = [];
    this.grenades.clear();
    const tsp = shuffle(this.map.tSpawns.slice()), ctsp = shuffle(this.map.ctSpawns.slice());
    let ti = 0, ci = 0;
    for (const a of this.actors) {
      const wasDead = !a.alive;
      if (wasDead || this.match.round === 1) {
        a.primary = null;
        a.grenades = [];
        a.armor = 0; a.helmet = false; a.kit = false;
        const pid = a.team === 'T' ? 'glock' : 'usps';
        a.secondary = new WeaponInst(pid, a.isPlayer ? skinManager.get(pid) : 'default');
      }
      if (a.isPlayer) a.knife = new WeaponInst('knife', skinManager.get('knife'));
      // refill reserve ammo between rounds for survivors' weapons
      for (const w of [a.primary, a.secondary]) if (w) { w.reserve = w.def.reserve; w.reloading = false; }
      a.c4 = null;
      a.alive = true;
      a.hp = 100;
      a.vel.set(0, 0, 0);
      a.flash = 0;
      a.crouch = 0; a.crouching = false;
      a.damageBy.clear();
      a.recoilIndex = 0; a.spreadHeat = 0;
      const sp = a.team === 'T' ? tsp[ti++ % tsp.length] : ctsp[ci++ % ctsp.length];
      a.pos.copy(sp).add(new THREE.Vector3(rand(-0.6, 0.6), 0.02, rand(-0.6, 0.6)));
      a.yaw = a.team === 'T' ? rand(-0.3, 0.3) : Math.PI + rand(-0.3, 0.3);
      a.pitch = 0;
      a.slot = a.bestSlot();
      a.onGround = true;
      if (a.model) {
        a.model.resetPose();
        a.model.root.visible = true;
        a.model.root.position.copy(a.pos);
        a.model.root.rotation.y = a.yaw;
        this.refreshBotWeaponModel(a);
      }
    }
    for (const b of this.bots) b.resetForRound();
    this.playerModel.root.visible = false;
    this.playerModel.resetPose();
    this.pc.resetForRound();
    this.pc.equip(this.player.bestSlot(), true);
    this.killedBy = null;
    this.spotted.clear();
    this.closeBuyMenu();
  }

  planBots(site: 'A' | 'B') {
    const M = this.map;
    const P = (x: number, z: number) => cellPt(M, x, z);
    const routesA = [[P(25, 34), P(31, 30), P(32, 22), P(32, 14)], [P(17, 30), P(17, 21), P(21, 18), P(23, 14)]];
    const routeB = [P(10, 34), P(8, 28), P(5, 24), P(5, 15)];
    const tHoldA = [P(28, 5), P(30, 8), P(26, 9), P(32, 6), P(29, 3)];
    const tHoldB = [P(4, 6), P(7, 9), P(2, 8), P(8, 4), P(5, 3)];
    const ts = this.bots.filter((b) => b.a.team === 'T');
    const cts = this.bots.filter((b) => b.a.team === 'CT');
    ts.forEach((b, i) => {
      const route = site === 'A' ? routesA[i % 2] : routeB;
      const holds = site === 'A' ? tHoldA : tHoldB;
      const look = site === 'A' ? (i % 2 ? P(22, 4) : P(23, 14)) : P(12, 4);
      let hold = holds[i % holds.length];
      if (b.a.c4) hold = M.siteCenters[site].clone().add(new THREE.Vector3(rand(-2, 2), 0, rand(-2, 2)));
      b.planRound(route, hold, look);
    });
    const roles: { hold: THREE.Vector3; look: THREE.Vector3 }[] = [
      { hold: P(27, 9), look: P(32, 18) },
      { hold: P(5, 9), look: P(5, 18) },
      { hold: P(16, 10), look: P(16, 26) },
      { hold: P(24, 10), look: P(23, 17) },
      { hold: P(8, 6), look: P(5, 16) }
    ];
    const order = shuffle([0, 1, 2, 3, 4]);
    cts.forEach((b, i) => {
      const r = roles[order[i % roles.length]];
      b.planRound([], r.hold, r.look);
    });
  }

  refreshBotWeaponModel(a: Actor) {
    if (!a.model) return;
    const w = a.weapon;
    const cat = w.def.category;
    const kind = cat === 'pistol' ? 'pistol' : cat === 'knife' || cat === 'grenade' || cat === 'c4' ? 'knife' : 'rifle';
    const mdl = buildWeapon(w.def.id, 'default');
    mdl.traverse((o) => { o.castShadow = true; });
    a.model.setWeapon(mdl, kind);
  }

  // ---------------------------------------------------------------- input
  private keyHandler = (code: string, down: boolean) => this.onKey(code, down);
  private lockHandler = (locked: boolean) => {
    if (!locked && this.expectUnlock) { this.expectUnlock = false; return; }
    if (!locked && this.state === 'playing' && !this.paused && !this.buyMenu.open) this.pause(true);
  };
  private clickHandler = () => {
    if (this.state === 'intro') { this.skipIntro(); return; }
    if (this.state !== 'playing' || this.paused || this.buyMenu.open) return;
    if (!input.locked) { input.requestLock(); return; }
    if (!this.player.alive) this.specIdx++;
  };

  private onKey(code: string, down: boolean) {
    if (this.state === 'intro' && down && (code === 'Space' || code === 'Escape' || code === 'Enter')) { this.skipIntro(); return; }
    if (this.state !== 'playing') return;
    if (code === 'Tab') { this.hud.setScoreboard(down); return; }
    if (!down) return;
    if (code === 'Escape') {
      if (this.settingsPanel) { this.closeSettings(); return; }
      if (this.buyMenu.open) { this.closeBuyMenu(); return; }
      if (this.paused) { this.resume(); return; }
      this.pause(false);
      return;
    }
    if (this.paused) return;
    if (code === 'KeyB') {
      if (this.buyMenu.open) this.closeBuyMenu();
      else if (this.match.canBuy(this.player)) {
        this.expectUnlock = input.locked;
        input.exitLock();
        this.buyMenu.toggle(true);
        audio.ui('click');
      } else this.hud.notice(this.match.buyTimeLeft <= 0 ? 'Tempo de compra esgotado' : 'Você precisa estar na zona de compra (spawn)');
      return;
    }
    if (this.buyMenu.open && /^Digit[1-9]$/.test(code)) return;
  }

  closeBuyMenu() {
    if (!this.buyMenu || !this.buyMenu.open) return;
    this.buyMenu.toggle(false);
    if (this.state === 'playing' && !this.paused) input.requestLock();
  }

  pause(fromUnlock: boolean) {
    if (this.paused) return;
    this.paused = true;
    if (!fromUnlock) { this.expectUnlock = input.locked; input.exitLock(); }
    this.pauseEl.innerHTML = `
      <div class="pause-panel">
        <div class="pause-logo">TACTICAL <b>STRIKE</b> 2</div>
        <div class="pause-sub">PARTIDA PAUSADA · DUST II · ${this.match.score.T} : ${this.match.score.CT}</div>
        <button data-a="resume" class="primary">CONTINUAR</button>
        <button data-a="settings">CONFIGURAÇÕES</button>
        <button data-a="restart">REINICIAR PARTIDA</button>
        <button data-a="menu">VOLTAR AO MENU PRINCIPAL</button>
      </div>`;
    this.pauseEl.classList.add('show');
    this.pauseEl.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      b.onmouseenter = () => audio.ui('hover');
      b.onclick = () => {
        audio.ui('click');
        const act = b.dataset.a;
        if (act === 'resume') this.resume();
        else if (act === 'settings') this.openSettings();
        else if (act === 'restart') this.onExit('restart');
        else if (act === 'menu') this.onExit('menu');
      };
    });
  }

  resume() {
    this.paused = false;
    this.pauseEl.classList.remove('show');
    input.requestLock();
  }

  private openSettings() {
    this.settingsPanel = new SettingsPanel(this.ui, () => this.closeSettings());
  }
  private closeSettings() {
    this.settingsPanel?.destroy();
    this.settingsPanel = null;
    this.camera.fov = hfovToV(settings.data.fov);
  }

  private skipIntro() {
    if (this.state !== 'intro') return;
    this.introT = 99;
  }

  // ---------------------------------------------------------------- combat routing
  damage(victim: Actor, attacker: Actor, hp: number, armorDmg: number, weapon: string, group: HitGroup | null, from: THREE.Vector3) {
    if (!victim.alive || this.match.phase === 'end') return;
    const real = Math.min(victim.hp, hp);
    victim.hp -= hp;
    victim.armor = Math.max(0, victim.armor - armorDmg);
    if (attacker !== victim) victim.damageBy.set(attacker.id, (victim.damageBy.get(attacker.id) || 0) + real);
    if (victim.model) victim.model.flinch();
    if (victim.isPlayer) {
      this.hud.damageFrom(from);
      audio.hurt();
      this.pc.punchPitch += 0.025;
      this.shake(0.15);
    }
    if (attacker.isPlayer && attacker !== victim) {
      this.hud.hitmarker(group === 'head');
      if (group === 'head') audio.headshot(null); else audio.hitBody(null, true);
    }
    // bots react to being shot
    const bot = this.bots.find((b) => b.a === victim);
    if (bot && attacker !== victim && victim.hp > 0) {
      bot.lastKnown = attacker.pos.clone();
      if (bot.state !== 'attack') { bot.a.yaw = yawTo(victim.pos, attacker.pos) + rand(-0.4, 0.4); bot.hear(attacker, attacker.pos); }
    }
    if (victim.hp <= 0) this.kill(victim, attacker, weapon, group === 'head');
  }

  private kill(victim: Actor, attacker: Actor, weapon: string, headshot: boolean) {
    victim.hp = 0;
    victim.alive = false;
    victim.deaths++;
    victim.diedAt = this.time;
    const realKiller = attacker !== victim ? attacker : null;
    if (realKiller) {
      if (realKiller.team !== victim.team) { realKiller.kills++; realKiller.score += 2; realKiller.roundKills++; }
      else { realKiller.kills--; realKiller.score -= 2; }
    }
    for (const [id, dmg] of victim.damageBy) {
      if (realKiller && id === realKiller.id) continue;
      if (dmg >= 40) { const as = this.actors.find((x) => x.id === id); if (as && as.team !== victim.team) { as.assists++; as.score += 1; } }
    }
    this.hud.killfeed(realKiller, victim, weapon, headshot);
    this.match.onKill(victim, realKiller, weapon);
    // drop best gun
    const gun = victim.primary || (victim.secondary && victim.secondary.def.id === 'deagle' ? victim.secondary : null);
    if (gun) this.dropWeaponAt(gun, victim.pos.clone().add(new THREE.Vector3(0, 1, 0)), new THREE.Vector3(rand(-1, 1), 2, rand(-1, 1)));
    if (victim.primary === gun) victim.primary = null;
    if (victim.isPlayer) {
      this.killedBy = realKiller ? `${realKiller.name} (${WEAPONS[weapon]?.name ?? weapon})` : weapon === 'c4' ? 'Explosão da C4' : null;
      this.pc.cancelInteract();
      this.pc.zoom = 0;
      this.playerModel.root.visible = true;
      this.playerModel.root.position.copy(victim.pos);
      this.playerModel.root.rotation.y = victim.yaw;
      this.playerModel.setWeapon(null, 'none');
      this.specIdx = 0;
      this.closeBuyMenu();
      this.hud.setScoreboard(false);
    }
    if (realKiller && realKiller.isPlayer && realKiller.team !== victim.team) {
      const reward = WEAPONS[weapon]?.killReward ?? 300;
      this.hud.notice(`+${'$' + reward} · Eliminou ${victim.name}${headshot ? ' (HEADSHOT)' : ''}`);
    }
  }

  noise(src: Actor, pos: THREE.Vector3, radius: number) {
    for (const b of this.bots) {
      if (b.a === src || !b.a.alive) continue;
      if (b.a.pos.distanceTo(pos) < radius) b.hear(src, pos);
    }
  }

  shake(a: number) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  // ---------------------------------------------------------------- drops
  dropWeaponAt(inst: WeaponInst, pos: THREE.Vector3, vel = new THREE.Vector3()) {
    const mesh = buildWeapon(inst.def.id, 'default');
    mesh.traverse((o) => { o.castShadow = true; });
    mesh.position.copy(pos);
    mesh.rotation.set(0, Math.random() * 6, Math.PI / 2);
    this.scene.add(mesh);
    inst.reloading = false;
    this.drops.push({ inst, mesh, pos: pos.clone(), vel: vel.clone(), t: 0 });
  }

  dropActive(a: Actor) {
    const w = a.weapon;
    const fwd = dirFromYawPitch(a.yaw, a.pitch);
    const pos = a.eyePos().addScaledVector(fwd, 0.6);
    const vel = fwd.multiplyScalar(5).add(new THREE.Vector3(0, 1.5, 0));
    if (a.slot === 'c4' && a.c4) {
      this.match.dropBomb(a, a.pos.clone().addScaledVector(dirFromYawPitch(a.yaw, 0), 1.2));
    } else if (a.slot === 'primary' && a.primary) {
      this.dropWeaponAt(a.primary, pos, vel);
      a.primary = null;
    } else if (a.slot === 'secondary' && a.secondary) {
      this.dropWeaponAt(a.secondary, pos, vel);
      a.secondary = null;
    } else return;
    audio.cloth(null, 0, 0.4);
    if (a.isPlayer) this.pc.equip(a.bestSlot(), true);
    void w;
  }

  nearbyDrop(a: Actor): Drop | null {
    let best: Drop | null = null, bd = 1.8;
    for (const d of this.drops) {
      const dist = d.pos.distanceTo(a.pos.clone().setY(d.pos.y));
      if (dist < bd && Math.abs(d.pos.y - a.pos.y) < 1.5) { best = d; bd = dist; }
    }
    return best;
  }

  tryPickup(a: Actor, explicit: boolean) {
    const d = this.nearbyDrop(a);
    if (!d) return;
    const slot = d.inst.def.slot;
    const cur = slot === 'primary' ? a.primary : slot === 'secondary' ? a.secondary : null;
    if (cur && !explicit) return;
    if (d.t < 0.8 && !explicit) return;
    if (cur) this.dropWeaponAt(cur, a.pos.clone().add(new THREE.Vector3(0, 0.8, 0)), dirFromYawPitch(a.yaw, 0).multiplyScalar(2));
    if (slot === 'primary') a.primary = d.inst; else if (slot === 'secondary') a.secondary = d.inst; else return;
    this.scene.remove(d.mesh);
    this.drops.splice(this.drops.indexOf(d), 1);
    if (a.isPlayer) { this.pc.equip(slot, true); audio.click(null, 0, 2400, 0.5); }
    else this.refreshBotWeaponModel(a);
  }

  private updateDrops(dt: number) {
    for (const d of this.drops) {
      d.t += dt;
      if (d.vel.lengthSq() > 0.0001 || d.t < 0.1) {
        d.vel.y -= 16 * dt;
        const g = this.collision.groundHeight(d.pos.x, d.pos.y, d.pos.z, 0.05, Math.max(0.05, -d.vel.y * dt + 0.05));
        d.pos.addScaledVector(d.vel, dt);
        if (g !== null && d.pos.y <= g + 0.04) { d.pos.y = g + 0.04; d.vel.set(0, 0, 0); }
        const wall = this.collision.overlapAny(d.pos.x, d.pos.y, d.pos.z, 0.05, 0.05);
        if (wall && d.vel.y >= 0) { d.vel.x *= -0.3; d.vel.z *= -0.3; }
        d.mesh.position.copy(d.pos);
        d.mesh.rotation.y += dt * 4 * Math.min(1, d.vel.length());
      }
    }
    // auto pickup for empty slots
    for (const a of this.actors) {
      if (!a.alive) continue;
      const d = this.nearbyDrop(a);
      if (!d || d.t < 1) continue;
      const slot = d.inst.def.slot;
      if ((slot === 'primary' && !a.primary) || (slot === 'secondary' && !a.secondary)) {
        if (d.inst.def.team !== 'both' && d.inst.def.team !== a.team && !a.isPlayer) continue;
        this.tryPickup(a, true);
        if (a.isPlayer) this.hud.notice(`Pegou ${a.weapon.def.name}`);
      }
    }
  }

  // ---------------------------------------------------------------- queries
  currentFov() {
    const base = hfovToV(settings.data.fov);
    const w = this.player.weapon.def;
    if (this.pc.zoom > 0 && w.scope) return hfovToV(w.scope[this.pc.zoom - 1]);
    return base;
  }

  viewTarget(): Actor {
    if (this.player.alive) return this.player;
    if (this.time - this.player.diedAt < 2.5) return this.player;
    const mates = this.actors.filter((a) => a.alive && a.team === this.player.team && !a.isPlayer);
    if (!mates.length) return this.player;
    return mates[this.specIdx % mates.length];
  }

  aimedActor(): Actor | null {
    const v = this.viewTarget();
    if (!v.isPlayer || !v.alive) return null;
    const o = this.camera.position;
    const d = new THREE.Vector3();
    this.camera.getWorldDirection(d);
    const wh = this.collision.raycast(o, d, 80);
    const max = wh ? wh.t : 80;
    let best: Actor | null = null, bt = max;
    for (const a of this.actors) {
      if (a === this.player || !a.alive) continue;
      const h = a.hitTest(o, d, bt);
      if (h) { best = a; bt = h.t; }
    }
    return best;
  }

  viewmodelMuzzleWorld(): THREE.Vector3 {
    // approximate: project viewmodel muzzle into world space using camera
    const mz = this.viewmodel.gun?.getObjectByName('muzzle');
    if (!mz) return this.camera.position.clone();
    const p = mz.getWorldPosition(new THREE.Vector3()); // in viewmodel camera space (camera at origin)
    const q = this.camera.quaternion;
    return p.applyQuaternion(q).add(this.camera.position);
  }

  // ---------------------------------------------------------------- loop
  update(dt: number) {
    if (this.state === 'intro') {
      this.introT += dt;
      if (input.hit('Space')) this.introT = 99;
      if (this.introT > 5.5) {
        this.state = 'playing';
        this.introEl.classList.add('hide');
        setTimeout(() => this.introEl.remove(), 900);
        this.hud.root.style.opacity = '1';
        input.requestLock();
      }
      // let bots stand idle with anims
      for (const b of this.bots) if (b.a.model) b.a.model.update(dt, { speed: 0, crouch: 0, pitch: 0, dead: false });
      this.effects.update(dt);
      input.endFrame();
      return;
    }
    if (this.paused || this.state === 'ended') {
      this.lockEl.style.display = 'none';
      input.endFrame();
      return;
    }
    this.time += dt;
    const touchMode = this.touchControls !== null;
    const lookOK = (input.locked || touchMode) && !this.buyMenu.open;
    this.lockEl.style.display = !input.locked && !touchMode && !this.buyMenu.open ? 'flex' : 'none';
    this.pc.update(dt, lookOK, !this.buyMenu.open || true);
    if (this.player.flash > 0) this.player.flash -= dt;
    for (const b of this.bots) b.update(dt);
    // dead bodies
    for (const a of this.actors) {
      if (!a.alive && a.model) a.model.update(dt, { speed: 0, crouch: 0, pitch: 0, dead: true });
    }
    if (!this.player.alive) this.playerModel.update(dt, { speed: 0, crouch: 0, pitch: 0, dead: true });
    this.match.update(dt);
    this.grenades.update(dt);
    this.updateDrops(dt);
    this.effects.update(dt);
    this.buyMenu.tick();
    // spotting for radar
    this.spotT -= dt;
    if (this.spotT <= 0) {
      this.spotT = 0.3;
      this.spotted.clear();
      const allies = this.actors.filter((a) => a.alive && a.team === this.player.team);
      for (const e of this.actors) {
        if (!e.alive || e.team === this.player.team) continue;
        for (const al of allies) {
          if (al.pos.distanceTo(e.pos) > 70) continue;
          if (this.collision.lineOfSight(al.eyePos(), e.eyePos()) && !this.grenades.blocks(al.eyePos(), e.eyePos())) { this.spotted.add(e.id); break; }
        }
      }
    }
    this.hud.update(dt);
    input.endFrame();
  }

  private updateCamera(dt: number) {
    const cam = this.camera;
    const v = this.viewTarget();
    const targetFov = this.currentFov();
    cam.fov = damp(cam.fov, this.pc.focus ? targetFov * 0.88 : targetFov, 18, dt);
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 1.5);
    const sh = this.shakeAmt * this.shakeAmt;
    if (this.state === 'intro') {
      const k = clamp(this.introT / 5.5, 0, 1);
      const pts = [new THREE.Vector3(-10, 45, 70), new THREE.Vector3(-30, 35, 20), new THREE.Vector3(-5, 30, -30), new THREE.Vector3(25, 22, -45)];
      const curve = new THREE.CatmullRomCurve3(pts);
      const e = k * k * (3 - 2 * k);
      cam.position.copy(curve.getPoint(e));
      const look = new THREE.Vector3(0, 0, 0).lerp(this.map.siteCenters.A, e);
      cam.lookAt(look);
      cam.updateProjectionMatrix();
      return;
    }
    if (v === this.player) {
      const p = this.player;
      if (p.alive) {
        cam.position.set(p.pos.x, p.pos.y + p.eye + this.pc.eyeOffset, p.pos.z);
        cam.rotation.order = 'YXZ';
        cam.rotation.set(p.pitch + this.pc.recoilPitch * 0.5 + this.pc.punchPitch + (Math.random() - 0.5) * sh * 0.05, p.yaw + this.pc.recoilYaw * 0.5 + this.pc.punchYaw + (Math.random() - 0.5) * sh * 0.05, 0);
      } else {
        // death cam: orbit corpse looking at killer direction
        const t = this.time - p.diedAt;
        const center = p.pos.clone().add(new THREE.Vector3(0, 0.6, 0));
        const ang = p.yaw + t * 0.4;
        const want = center.clone().add(new THREE.Vector3(Math.sin(ang) * 3, 2.2 + t * 0.2, Math.cos(ang) * 3));
        const hit = this.collision.raycast(center, want.clone().sub(center).normalize(), want.distanceTo(center));
        cam.position.copy(hit ? hit.point.clone().lerp(center, 0.15) : want);
        cam.lookAt(center);
      }
    } else {
      // third person spectate
      const fwd = dirFromYawPitch(v.yaw, v.pitch * 0.5);
      const head = v.eyePos();
      const want = head.clone().addScaledVector(fwd, -2.4).add(new THREE.Vector3(0, 0.45, 0));
      const dir = want.clone().sub(head);
      const len = dir.length();
      dir.normalize();
      const hit = this.collision.raycast(head, dir, len);
      const tgt = hit ? head.clone().addScaledVector(dir, Math.max(0.3, hit.t - 0.3)) : want;
      this.specCam.lerp(tgt, 1 - Math.exp(-12 * dt));
      if (this.specCam.distanceTo(tgt) > 6) this.specCam.copy(tgt);
      cam.position.copy(this.specCam);
      cam.lookAt(head.clone().addScaledVector(fwd, 6));
    }
    cam.updateProjectionMatrix();
    const f = new THREE.Vector3();
    cam.getWorldDirection(f);
    audio.setListener(cam.position, f);
  }

  render(dt: number) {
    this.updateCamera(dt);
    const p = this.player;
    // viewmodel
    const vm = this.viewmodel;
    vm.visible = p.alive && !this.pc.scoped && this.state === 'playing' && this.viewTarget() === p;
    if (this.state === 'playing' && !this.paused) {
      vm.update(dt, { speed: Math.hypot(p.vel.x, p.vel.z), maxSpeed: p.maxSpeed(), onGround: p.onGround, crouch: p.crouch, dx: input.locked ? lastDx : 0, dy: input.locked ? lastDy : 0, walking: p.walking });
    }
    vm.camera.aspect = this.camera.aspect;
    vm.camera.updateProjectionMatrix();
    this.effects.setScale(this.renderer.domElement.height, this.camera.fov);
    const r = this.renderer;
    r.autoClear = true;
    r.render(this.scene, this.camera);
    r.autoClear = false;
    vm.render(r);
    r.autoClear = true;
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  onMatchEnd(winner: Team) {
    this.state = 'ended';
    input.exitLock();
    this.hud.setScoreboard(false);
    const won = winner === this.player.team;
    audio.roundEnd(won);
    const rows = this.actors.slice().sort((a, b) => b.score - a.score).map((a) => `
      <tr class="${a.team === 'T' ? 't' : 'ct'} ${a.isPlayer ? 'me' : ''}"><td>${a.name}</td><td>${a.team === 'T' ? 'TR' : 'CT'}</td><td>${a.kills}</td><td>${a.deaths}</td><td>${a.assists}</td><td>${a.mvps}</td><td>${a.score}</td></tr>`).join('');
    const pl = this.player;
    const kd = (pl.kills / Math.max(1, pl.deaths)).toFixed(2);
    this.endEl.innerHTML = `
      <div class="me-panel ${won ? 'win' : 'lose'}">
        <div class="me-title">${won ? 'VITÓRIA' : 'DERROTA'}</div>
        <div class="me-score"><span class="t">TR ${this.match.score.T}</span> : <span class="ct">${this.match.score.CT} CT</span></div>
        <div class="me-stats"><div><b>${pl.kills}</b><small>ELIMINAÇÕES</small></div><div><b>${pl.deaths}</b><small>MORTES</small></div><div><b>${kd}</b><small>K/D</small></div><div><b>${pl.mvps}</b><small>MVPs</small></div></div>
        <table class="me-table"><tr><th>JOGADOR</th><th>TIME</th><th>K</th><th>M</th><th>A</th><th>MVP</th><th>PONTOS</th></tr>${rows}</table>
        <div class="me-btns"><button data-a="restart" class="primary">JOGAR NOVAMENTE</button><button data-a="menu">MENU PRINCIPAL</button></div>
      </div>`;
    this.endEl.classList.add('show');
    this.endEl.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      b.onclick = () => { audio.ui('click'); this.onExit(b.dataset.a as any); };
    });
  }

  dispose() {
    input.keyHandlers = input.keyHandlers.filter((h) => h !== this.keyHandler);
    input.lockHandlers = input.lockHandlers.filter((h) => h !== this.lockHandler);
    this.renderer.domElement.removeEventListener('mousedown', this.clickHandler);
    input.gameActive = false;
    input.exitLock();
    audio.stopAmbient();
    this.settingsPanel?.destroy();
    this.touchControls?.remove();
    for (const k of ['KeyW','KeyA','KeyS','KeyD','Space','ControlLeft','KeyR','KeyF']) input.setVirtualKey(k, false);
    input.setVirtualMouse(0, false);
    this.ui.remove();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
  }
}

// mouse deltas are consumed by input.endFrame inside update, so snapshot them for the viewmodel sway
let lastDx = 0, lastDy = 0;
window.addEventListener('mousemove', (e) => { lastDx = e.movementX; lastDy = e.movementY; setTimeout(() => { lastDx = 0; lastDy = 0; }, 30); });
void pick;
