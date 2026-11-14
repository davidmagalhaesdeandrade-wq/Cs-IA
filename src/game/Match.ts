import * as THREE from 'three';
import type { GameSession } from './GameSession';
import { Actor, Team, WeaponInst } from './Actor';
import type { Bot } from './Bot';
import { audio } from '../core/Audio';
import { buildC4 } from '../render/weaponModels';
import { pick, rand, shuffle } from '../core/util';
import { WEAPONS } from '../data/weapons';

export type Phase = 'freeze' | 'live' | 'planted' | 'post' | 'end';
export type EndReason = 'elim' | 'bomb' | 'defuse' | 'time';

export const FREEZE_TIME = 6;
export const BUY_TIME = 15;
export const ROUND_TIME = 115;
export const BOMB_TIME = 40;
export const POST_TIME = 6;
export const WIN_ROUNDS = 7;
export const HALF_ROUNDS = 6;
const MAX_MONEY = 16000;

export interface Bomb {
  state: 'none' | 'carried' | 'dropped' | 'planted' | 'defused' | 'exploded';
  carrier: Actor | null;
  pos: THREE.Vector3;
  site: 'A' | 'B' | null;
  timer: number;
  model: THREE.Group | null;
  defuser: Actor | null;
  defuseT: number;
  defuseTotal: number;
  beepT: number;
  plantedBy: Actor | null;
}

export class Match {
  s: GameSession;
  phase: Phase = 'freeze';
  timer = FREEZE_TIME;
  round = 0;
  score: Record<Team, number> = { T: 0, CT: 0 };
  lossStreak: Record<Team, number> = { T: 1, CT: 1 };
  roundStart = 0;
  liveStart = 0;
  swapped = false;
  plantTime = 3.2;
  tSite: 'A' | 'B' = 'A';
  lastWinner: Team | null = null;
  lastReason: EndReason | null = null;
  bombPickupBot: Bot | null = null;
  history: { winner: Team; reason: EndReason }[] = [];
  bomb: Bomb = { state: 'none', carrier: null, pos: new THREE.Vector3(), site: null, timer: 0, model: null, defuser: null, defuseT: 0, defuseTotal: 10, beepT: 0, plantedBy: null };
  matchWinner: Team | null = null;
  startMoney: number;

  constructor(s: GameSession, startMoney: number) {
    this.s = s;
    this.startMoney = startMoney;
  }

  get buyTimeLeft() {
    if (this.phase === 'freeze') return BUY_TIME + this.timer;
    if (this.phase !== 'live' && this.phase !== 'planted') return 0;
    return Math.max(0, BUY_TIME - (this.s.time - this.liveStart));
  }
  canBuy(a: Actor) {
    return a.alive && this.buyTimeLeft > 0 && this.s.map.inBuyZone(a.pos, a.team);
  }

  siteCenter(site: 'A' | 'B') { return this.s.map.siteCenters[site].clone(); }

  startMatch() {
    for (const a of this.s.actors) a.money = this.startMoney;
    this.startRound();
  }

  startRound() {
    const s = this.s;
    this.round++;
    if (this.round === HALF_ROUNDS + 1 && !this.swapped) {
      this.swapped = true;
      s.swapTeams();
      const sc = this.score.T; this.score.T = this.score.CT; this.score.CT = sc;
      this.lossStreak = { T: 1, CT: 1 };
      for (const a of s.actors) a.money = this.startMoney;
      s.hud.centerMessage('TROCA DE LADOS', 'Intervalo — os times trocaram de lado', '#e9e9e9', 3);
    }
    this.phase = 'freeze';
    this.timer = FREEZE_TIME;
    this.roundStart = s.time;
    this.bombPickupBot = null;
    this.removeBombModel();
    this.bomb = { state: 'none', carrier: null, pos: new THREE.Vector3(), site: null, timer: 0, model: null, defuser: null, defuseT: 0, defuseTotal: 10, beepT: 0, plantedBy: null };
    s.prepareRound();
    // give bomb
    const ts = s.actors.filter((a) => a.team === 'T');
    const player = s.player;
    const carrier = player.team === 'T' ? player : pick(ts);
    if (carrier) {
      carrier.c4 = new WeaponInst('c4');
      this.bomb.state = 'carried';
      this.bomb.carrier = carrier;
    }
    // bots buy + plan
    this.tSite = Math.random() < 0.5 ? 'A' : 'B';
    for (const b of s.bots) this.botBuy(b.a);
    s.planBots(this.tSite);
    for (const a of s.actors) a.roundKills = 0;
    if (this.round > 1 || true) s.hud.centerMessage(`ROUND ${this.round}`, this.round === HALF_ROUNDS ? 'Último round do primeiro tempo' : (s.player.team === 'T' ? 'Plante a bomba ou elimine os CTs' : 'Defenda os bombsites'), '#ffffff', 2.5);
  }

  private botBuy(a: Actor) {
    const give = (id: string) => {
      const d = WEAPONS[id];
      if (a.money < d.price) return false;
      a.money -= d.price;
      const inst = new WeaponInst(id);
      if (d.slot === 'primary') { if (a.primary) this.s.dropWeaponAt(a.primary, a.pos.clone()); a.primary = inst; }
      else if (d.slot === 'secondary') a.secondary = inst;
      else if (d.slot === 'grenade') a.grenades.push(inst);
      return true;
    };
    const armor = (helmet: boolean) => {
      const cost = helmet ? (a.armor >= 100 ? 350 : 1000) : 650;
      if (a.money < cost || (a.armor >= 100 && (a.helmet || !helmet))) return;
      a.money -= cost; a.armor = 100; if (helmet) a.helmet = true;
    };
    const pistolRound = this.round === 1 || this.round === HALF_ROUNDS + 1;
    if (!a.primary) {
      if (a.money >= 5700 && Math.random() < 0.18) give('awp');
      else if (a.money >= 3700) give(a.team === 'T' ? 'ak47' : (Math.random() < 0.5 ? 'm4a4' : 'm4a1s'));
      else if (!pistolRound && a.money >= 2300 && Math.random() < 0.7) give(a.team === 'T' ? (Math.random() < 0.6 ? 'galil' : 'mac10') : (Math.random() < 0.6 ? 'famas' : 'mp9'));
    }
    if (a.money >= 1000) armor(true); else if (a.money >= 650) armor(false);
    if (pistolRound && a.money >= 700 && Math.random() < 0.3 && !a.primary) {
      if (a.secondary && a.secondary.def.id !== 'deagle') give('deagle');
    }
    if (a.team === 'CT' && !a.kit && a.money >= 400 && Math.random() < 0.5) { a.money -= 400; a.kit = true; }
    const nades = shuffle(['he', 'flash', 'smoke']);
    for (const n of nades) if (a.money >= 500 && a.grenades.length < 2 && Math.random() < 0.5) give(n);
  }

  update(dt: number) {
    const s = this.s;
    if (this.phase === 'end') return;
    this.timer -= dt;
    switch (this.phase) {
      case 'freeze':
        if (this.timer <= 0) {
          this.phase = 'live';
          this.timer = ROUND_TIME;
          this.liveStart = s.time;
          audio.roundStart();
          s.hud.centerMessage('', s.player.team === 'T' ? 'Vamos, vamos, vamos!' : 'Assumam suas posições!', '#9fd36c', 1.6);
        }
        break;
      case 'live':
        this.checkElims();
        if (this.phase === 'live' && this.timer <= 0) this.endRound('CT', 'time');
        break;
      case 'planted': {
        const b = this.bomb;
        b.timer -= dt;
        // beeps get faster
        b.beepT -= dt;
        const interval = b.timer > 10 ? 1.0 : b.timer > 5 ? 0.5 : b.timer > 2 ? 0.25 : 0.12;
        if (b.beepT <= 0) {
          b.beepT = interval;
          audio.beep(b.pos, 2650, 0.9);
          const led = b.model?.getObjectByName('led') as THREE.Mesh | undefined;
          if (led) { (led.material as THREE.MeshBasicMaterial).color.setHex(0xff2020); setTimeout(() => (led.material as THREE.MeshBasicMaterial).color.setHex(0x330000), 90); }
          s.effects.light(b.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), 3, 0xff2020, 3);
        }
        // defuse
        if (b.defuser) {
          const d = b.defuser;
          if (!d.alive || d.pos.distanceTo(b.pos) > 2.2) this.cancelDefuse(d);
          else {
            b.defuseT += dt;
            d.vel.x = 0; d.vel.z = 0;
            if (b.defuseT >= b.defuseTotal) {
              b.state = 'defused';
              audio.click(b.pos, 0, 1200, 1);
              s.hud.killfeedRaw(`<span class="ct">${d.name}</span> desarmou a bomba`);
              d.score += 2;
              d.money = Math.min(MAX_MONEY, d.money + 300);
              this.endRound('CT', 'defuse');
              break;
            }
          }
        }
        if (b.timer <= 0) {
          b.state = 'exploded';
          this.explode();
          this.endRound('T', 'bomb');
          break;
        }
        this.checkElims();
        break;
      }
      case 'post':
        if (this.timer <= 0) {
          if (this.matchWinner) { this.phase = 'end'; s.onMatchEnd(this.matchWinner); }
          else this.startRound();
        }
        break;
    }
    // bomb dropped pickup
    if (this.bomb.state === 'dropped' && (this.phase === 'live' || this.phase === 'freeze')) {
      for (const a of s.actors) {
        if (a.alive && a.team === 'T' && a.pos.distanceTo(this.bomb.pos) < 1.3) {
          a.c4 = new WeaponInst('c4');
          this.bomb.state = 'carried';
          this.bomb.carrier = a;
          this.removeBombModel();
          if (a.isPlayer) { s.hud.notice('Você pegou a bomba'); audio.click(null, 0, 2000, 0.5); }
          this.bombPickupBot = null;
          break;
        }
      }
    }
    if (this.bomb.model) {
      const lcd = this.bomb.model.getObjectByName('lcd') as THREE.Mesh | undefined;
      if (lcd && this.bomb.state === 'planted') (lcd.material as THREE.MeshBasicMaterial).color.setHSL(0.3, 1, 0.4 + Math.sin(s.time * 10) * 0.1);
    }
  }

  private checkElims() {
    const s = this.s;
    const aliveT = s.actors.some((a) => a.alive && a.team === 'T');
    const aliveCT = s.actors.some((a) => a.alive && a.team === 'CT');
    if (!aliveCT) { this.endRound('T', 'elim'); return; }
    if (!aliveT && this.phase === 'live') this.endRound('CT', 'elim');
  }

  canPlant(a: Actor) {
    if (!a.alive || a.team !== 'T' || !a.c4) return false;
    if (this.phase !== 'live') return false;
    if (!a.onGround) return false;
    return this.s.map.siteAt(a.pos) !== null;
  }

  plant(a: Actor) {
    const s = this.s;
    const site = s.map.siteAt(a.pos);
    a.c4 = null;
    if (a.slot === 'c4') a.slot = a.bestSlot();
    const b = this.bomb;
    b.state = 'planted';
    b.site = site;
    b.timer = BOMB_TIME;
    b.carrier = null;
    b.plantedBy = a;
    b.beepT = 0;
    const fwd = new THREE.Vector3(-Math.sin(a.yaw), 0, -Math.cos(a.yaw));
    b.pos.copy(a.pos).addScaledVector(fwd, 0.45);
    const g = s.collision.groundHeight(b.pos.x, a.pos.y + 0.3, b.pos.z, 0.1, 1.5);
    b.pos.y = g ?? a.pos.y;
    this.spawnBombModel(b.pos, a.yaw, true);
    this.phase = 'planted';
    a.money = Math.min(MAX_MONEY, a.money + 300);
    a.score += 2;
    audio.bombPlantedAnnounce();
    s.hud.centerMessage('BOMBA PLANTADA', `Bombsite ${site} — 40 segundos para a detonação`, '#ff5a4a', 2.6);
    s.hud.killfeedRaw(`<span class="t">${a.name}</span> plantou a bomba no <b>${site}</b>`);
  }

  canDefuse(a: Actor) {
    return a.alive && a.team === 'CT' && this.bomb.state === 'planted' && a.pos.distanceTo(this.bomb.pos) < 1.9 && (!this.bomb.defuser || this.bomb.defuser === a);
  }
  startDefuse(a: Actor) {
    const b = this.bomb;
    if (!this.canDefuse(a) || b.defuser === a) return;
    b.defuser = a;
    b.defuseT = 0;
    b.defuseTotal = a.kit ? 5 : 10;
    audio.click(b.pos, 0, 1800, 0.6);
    audio.cloth(b.pos, 0.1, 0.4);
  }
  cancelDefuse(a: Actor) {
    if (this.bomb.defuser === a) { this.bomb.defuser = null; this.bomb.defuseT = 0; }
  }

  dropBomb(a: Actor, pos: THREE.Vector3) {
    if (!a.c4) return;
    a.c4 = null;
    if (a.slot === 'c4') a.slot = a.bestSlot();
    const b = this.bomb;
    b.state = 'dropped';
    b.carrier = null;
    const g = this.s.collision.groundHeight(pos.x, pos.y + 1, pos.z, 0.1, 4);
    b.pos.set(pos.x, g ?? pos.y, pos.z);
    this.spawnBombModel(b.pos, Math.random() * 6, false);
    // choose a bot to pick it up
    const ts = this.s.bots.filter((x) => x.a.alive && x.a.team === 'T');
    ts.sort((x, y) => x.a.pos.distanceTo(b.pos) - y.a.pos.distanceTo(b.pos));
    this.bombPickupBot = this.s.player.team === 'T' && this.s.player.alive && this.s.player.pos.distanceTo(b.pos) < 20 ? null : ts[0] || null;
  }

  private spawnBombModel(p: THREE.Vector3, yaw: number, planted: boolean) {
    this.removeBombModel();
    const m = buildC4();
    m.scale.setScalar(planted ? 1.6 : 1.4);
    m.position.copy(p);
    m.rotation.y = yaw;
    this.s.scene.add(m);
    this.bomb.model = m;
  }
  private removeBombModel() {
    if (this.bomb.model) { this.s.scene.remove(this.bomb.model); this.bomb.model = null; }
  }

  private explode() {
    const s = this.s, b = this.bomb;
    s.effects.explosion(b.pos, true);
    audio.explosion(b.pos, true);
    s.shake(1.2);
    this.removeBombModel();
    for (const a of s.actors) {
      if (!a.alive) continue;
      const d = a.pos.distanceTo(b.pos);
      const R = 28;
      if (d > R) continue;
      let dmg = 500 * Math.pow(1 - d / R, 2);
      if (a.armor > 0) dmg *= 0.75;
      if (dmg >= 1) s.damage(a, b.plantedBy || a, Math.round(dmg), 0, 'c4', null, b.pos);
    }
  }

  onKill(victim: Actor, attacker: Actor | null, weapon: string) {
    if (attacker && attacker !== victim) {
      if (attacker.team === victim.team) attacker.money = Math.max(0, attacker.money - 300);
      else {
        const def = WEAPONS[weapon];
        const reward = def ? def.killReward : 300;
        attacker.money = Math.min(MAX_MONEY, attacker.money + reward);
      }
    }
    if (victim.c4) this.dropBomb(victim, victim.pos.clone());
    if (this.bomb.defuser === victim) this.cancelDefuse(victim);
  }

  endRound(winner: Team, reason: EndReason) {
    if (this.phase === 'post' || this.phase === 'end') return;
    const s = this.s;
    const planted = this.bomb.state === 'planted' || this.bomb.state === 'exploded' || this.bomb.state === 'defused';
    this.phase = 'post';
    this.timer = POST_TIME;
    this.lastWinner = winner;
    this.lastReason = reason;
    this.score[winner]++;
    this.history.push({ winner, reason });
    const loser: Team = winner === 'T' ? 'CT' : 'T';
    const winReward = reason === 'bomb' || reason === 'defuse' ? 3500 : 3250;
    const lossReward = Math.min(3400, 1400 + (this.lossStreak[loser] - 1) * 500);
    for (const a of s.actors) {
      if (a.team === winner) a.money = Math.min(MAX_MONEY, a.money + winReward);
      else {
        let r = lossReward;
        if (loser === 'T' && planted) r += 800;
        // T survivors after time loss get nothing (CS rule)
        if (loser === 'T' && reason === 'time' && a.alive) r = 0;
        a.money = Math.min(MAX_MONEY, a.money + r);
      }
    }
    this.lossStreak[loser] = Math.min(5, this.lossStreak[loser] + 1);
    this.lossStreak[winner] = Math.max(1, this.lossStreak[winner] - 1);
    if (this.bomb.defuser) this.bomb.defuser = null;
    // MVP
    const winners = s.actors.filter((a) => a.team === winner);
    let mvp: Actor | null = null;
    if (reason === 'defuse' && this.bomb.state === 'defused') mvp = s.actors.find((a) => a.team === 'CT' && a.alive && a.pos.distanceTo(this.bomb.pos) < 2.5) || null;
    if (reason === 'bomb') mvp = this.bomb.plantedBy;
    if (!mvp) mvp = winners.slice().sort((x, y) => y.roundKills - x.roundKills)[0] || null;
    if (mvp) mvp.mvps++;
    const reasonTxt = { elim: 'Todos os inimigos foram eliminados', bomb: 'O alvo foi bombardeado', defuse: 'A bomba foi desarmada', time: 'O tempo acabou — alvo protegido' }[reason];
    const title = winner === 'T' ? 'OS TERRORISTAS VENCERAM' : 'OS CONTRA-TERRORISTAS VENCERAM';
    const pWin = s.player.team === winner;
    s.hud.roundEnd(title, reasonTxt + (mvp ? ` · MVP: ${mvp.name}` : ''), winner, pWin);
    audio.roundEnd(pWin);
    if (this.score[winner] >= WIN_ROUNDS) {
      this.matchWinner = winner;
      this.timer = 4;
    }
  }
}

export { rand };
