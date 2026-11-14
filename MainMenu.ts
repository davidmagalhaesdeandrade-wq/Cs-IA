import * as THREE from 'three';
import { el } from '../core/util';
import { audio } from '../core/Audio';
import { settings } from '../core/Settings';
import { CharacterModel, AGENTS } from '../render/characterModel';
import { buildWeapon, propCrate } from '../render/weaponModels';
import { wallTex, floorSandTex, smokeTex } from '../render/textures';
import { skinManager, skinById, RARITY_COLOR } from '../data/skins';
import { skinThumb, sharedEnv } from '../render/thumbnails';
import { InventoryScreen } from './Inventory';
import { LoadoutScreen, loadAgents } from './Loadout';
import { SettingsPanel } from './SettingsUI';
import { MapSelectScreen, mapArt, MAPS } from './MapSelect';
import type { MatchConfig } from '../game/GameSession';

export const VERSION = '1.0.0';

export interface Profile { matches: number; wins: number; kills: number; xp: number }
export function loadProfile(): Profile {
  try { const r = localStorage.getItem('ts2_profile'); if (r) return { matches: 0, wins: 0, kills: 0, xp: 0, ...JSON.parse(r) }; } catch { /* */ }
  return { matches: 0, wins: 0, kills: 0, xp: 0 };
}
export function saveProfile(p: Profile) { try { localStorage.setItem('ts2_profile', JSON.stringify(p)); } catch { /* */ } }
const RANKS = ['Prata I', 'Prata II', 'Prata Elite', 'Ouro I', 'Ouro II', 'Ouro Mestre', 'Mestre Guardião', 'Águia', 'Supremo', 'Global Elite'];

export class MainMenu {
  root: HTMLDivElement;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 200);
  char!: CharacterModel;
  dust!: THREE.Points;
  t = 0;
  visible = true;
  screen: { destroy(): void; update?(dt: number): void } | null = null;
  private mouseX = 0; private mouseY = 0;

  constructor(private renderer: THREE.WebGLRenderer, parent: HTMLElement, private onPlay: (c: MatchConfig) => void) {
    this.root = el('div', 'menu');
    parent.appendChild(this.root);
    this.buildScene();
    this.render();
    window.addEventListener('mousemove', (e) => { this.mouseX = e.clientX / innerWidth - 0.5; this.mouseY = e.clientY / innerHeight - 0.5; });
  }

  private buildScene() {
    const s = this.scene;
    s.background = new THREE.Color(0x9fb8d0);
    s.fog = new THREE.Fog(0xcbb79a, 14, 48);
    s.environment = sharedEnv(this.renderer);
    s.environmentIntensity = 0.35;
    const wt = wallTex(0), wt2 = wallTex(1), ft = floorSandTex();
    const wallM = new THREE.MeshStandardMaterial({ map: wt.map, bumpMap: wt.bump, bumpScale: 3, roughness: 0.95 });
    const wallM2 = new THREE.MeshStandardMaterial({ map: wt2.map, bumpMap: wt2.bump, bumpScale: 3, roughness: 0.95 });
    const tex = (t: THREE.Texture, rx: number, ry: number) => { const c = t.clone(); c.needsUpdate = true; c.repeat.set(rx, ry); return c; };
    const floorM = new THREE.MeshStandardMaterial({ map: tex(ft.map, 6, 6), bumpMap: tex(ft.bump, 6, 6), roughness: 1 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorM);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, ry = 0) => {
      const mm = (m as THREE.MeshStandardMaterial).clone();
      if (mm.map) { mm.map = tex(mm.map, w / 4, h / 4); }
      if (mm.bumpMap) { mm.bumpMap = tex(mm.bumpMap, w / 4, h / 4); }
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mm);
      b.position.set(x, y, z); b.rotation.y = ry;
      b.castShadow = b.receiveShadow = true;
      s.add(b);
      return b;
    };
    // courtyard walls with an archway
    box(7, 9, 1, wallM, -6.5, 4.5, -8);
    box(7, 9, 1, wallM, 6.5, 4.5, -8);
    box(6, 3.5, 1, wallM2, 0, 7.25, -8);
    box(1, 10, 14, wallM2, -10, 5, -2, 0.25);
    box(1, 8, 14, wallM, 11, 4, -3, -0.3);
    // gate doors (dark wood) in the arch
    const doorM = new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 0.8 });
    const d1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 5.4, 0.15), doorM); d1.position.set(-1.9, 2.7, -7.2); d1.rotation.y = 0.9; d1.castShadow = true; s.add(d1);
    const d2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 5.4, 0.15), doorM); d2.position.set(1.9, 2.7, -7.2); d2.rotation.y = -0.9; d2.castShadow = true; s.add(d2);
    // distant building through arch
    box(10, 14, 2, wallM2, 0, 7, -20);
    // crates and barrels
    const c1 = propCrate(1.3); c1.position.set(-3.2, 0.65, -3.4); c1.rotation.y = 0.3; s.add(c1);
    const c2 = propCrate(1.3); c2.position.set(-3.6, 1.95, -3.6); c2.rotation.y = 0.1; s.add(c2);
    const c3 = propCrate(1.3); c3.position.set(-4.7, 0.65, -2.4); c3.rotation.y = -0.2; s.add(c3);
    const c4 = propCrate(1.1); c4.position.set(3.6, 0.55, -4.2); c4.rotation.y = 0.5; s.add(c4);
    const bm = new THREE.MeshStandardMaterial({ color: 0x2f5d8a, metalness: 0.5, roughness: 0.5 });
    for (const [x, z] of [[4.6, -3], [5.3, -3.8]]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1, 16), bm); b.position.set(x, 0.5, z); b.castShadow = true; s.add(b); }
    // C4 prop on crate
    const bomb = buildWeapon('c4'); bomb.scale.setScalar(2); bomb.position.set(3.5, 1.1, -4.1); bomb.rotation.y = 0.8; s.add(bomb);
    // character
    const agent = AGENTS.find((a) => a.id === loadAgents().T) || AGENTS[0];
    this.char = new CharacterModel(agent);
    this.char.root.position.set(0.15, 0, -1.2);
    this.char.root.rotation.y = Math.PI - 0.45;
    s.add(this.char.root);
    this.refreshWeapon();
    // lighting: warm sun key + cool rim + soft fill
    s.add(new THREE.HemisphereLight(0xcfe0ff, 0x9a7650, 0.55));
    const sun = new THREE.DirectionalLight(0xffd7a0, 2.6);
    sun.position.set(-6, 9, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -10; sun.shadow.camera.right = 10; sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
    s.add(sun);
    const rim = new THREE.DirectionalLight(0x9cc4ff, 2.2);
    rim.position.set(5, 4, -6);
    s.add(rim);
    const spot = new THREE.SpotLight(0xffeedd, 14, 12, 0.5, 0.6);
    spot.position.set(1.5, 4, 3);
    spot.target = this.char.root;
    s.add(spot);
    // floating dust motes
    const n = 400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = (Math.random() - 0.5) * 14; pos[i * 3 + 1] = Math.random() * 6; pos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.04, map: smokeTex(), transparent: true, opacity: 0.55, depthWrite: false, color: 0xfff1d0 }));
    s.add(this.dust);
  }

  refreshWeapon() {
    const pat = skinById(skinManager.get('ak47'))?.pattern ?? 'default';
    const w = buildWeapon('ak47', pat);
    w.traverse((o) => { o.castShadow = true; });
    this.char.setWeapon(w, 'rifle');
  }

  refreshAgent() {
    const agent = AGENTS.find((a) => a.id === loadAgents().T) || AGENTS[0];
    this.scene.remove(this.char.root);
    this.char = new CharacterModel(agent);
    this.char.root.position.set(0.15, 0, -1.2);
    this.char.root.rotation.y = Math.PI - 0.45;
    this.scene.add(this.char.root);
    this.refreshWeapon();
  }

  render() {
    const p = loadProfile();
    const lvl = Math.min(40, 1 + Math.floor(p.xp / 500));
    const rank = RANKS[Math.min(RANKS.length - 1, Math.floor(p.wins / 2))];
    const ak = skinById(skinManager.get('ak47'))!;
    const awp = skinById('awp_dragon')!;
    this.root.innerHTML = `
      <div class="menu-top">
        <div class="mt-left">
          <div class="logo"><span class="logo-mark"></span>TACTICAL <b>STRIKE</b> <i>2</i></div>
        </div>
        <nav class="mt-nav">
          <button data-nav="play" class="nav-play">JOGAR<span class="tag">NOVO</span></button>
          <button data-nav="inventory">INVENTÁRIO</button>
          <button data-nav="loadout">EQUIPAMENTOS</button>
          <button data-nav="settings">CONFIGURAÇÕES</button>
          <button data-nav="quit">SAIR</button>
        </nav>
        <div class="mt-right"><span class="mt-status"><i></i>OFFLINE</span></div>
      </div>
      <div class="menu-left">
        <div class="news-card hero" data-nav="play">
          <img src="${mapArt(MAPS[0], 520, 300)}">
          <div class="nc-tag">OPERAÇÃO AI RECREATION</div>
          <div class="nc-title">DUST II</div>
          <div class="nc-sub">Competitivo 5v5 contra bots · Clique para jogar</div>
        </div>
        <div class="news-card" data-nav="inventory">
          <div class="nc-tag">NOVO & POPULAR <small>Ver mais</small></div>
          <img class="nc-skin" src="${skinThumb('awp', 'dragon', 400, 180)}">
          <div class="nc-item">AWP | ${awp.name}</div>
          <div class="nc-price" style="color:${RARITY_COLOR[awp.rarity]}">Oculto · Coleção Lenda AI</div>
        </div>
      </div>
      <div class="menu-right">
        <div class="profile">
          <div class="pf-av">${(settings.data.playerName || 'P')[0].toUpperCase()}</div>
          <div class="pf-info"><div class="pf-name">${settings.data.playerName}</div><div class="pf-rank">${rank}</div>
            <div class="pf-lvl"><span>NÍVEL ${lvl}</span><div class="pf-xp"><i style="width:${(p.xp % 500) / 5}%"></i></div></div></div>
        </div>
        <div class="pf-stats"><div><b>${p.matches}</b><small>PARTIDAS</small></div><div><b>${p.wins}</b><small>VITÓRIAS</small></div><div><b>${p.kills}</b><small>ABATES</small></div></div>
        <div class="pf-equipped"><small>EQUIPADA</small><img src="${skinThumb('ak47', ak.pattern, 300, 130)}"><span style="color:${RARITY_COLOR[ak.rarity]}">AK-47 | ${ak.name}</span></div>
        <button class="big-play" data-nav="play"><span>JOGAR</span><small>DUST II · COMPETITIVO</small></button>
      </div>
      <div class="menu-bottom">
        <span>TACTICAL STRIKE 2 · CS2 AI RECREATION · v${VERSION}</span>
        <span class="mb-off"><i></i> MODO OFFLINE · BOTS LOCAIS</span>
        <span class="mb-r">Projeto de fã · Assets 100% procedurais · Não afiliado à Valve</span>
      </div>
      <div class="menu-screens"></div>`;
    this.root.querySelectorAll<HTMLElement>('[data-nav]').forEach((b) => {
      b.addEventListener('mouseenter', () => audio.ui('hover'));
      b.addEventListener('click', () => { audio.ui('click'); this.nav(b.dataset.nav!); });
    });
  }

  nav(where: string) {
    audio.startMenuMusic();
    this.closeScreen();
    const host = this.root.querySelector('.menu-screens') as HTMLElement;
    this.root.classList.add('dim');
    if (where === 'play') this.screen = new MapSelectScreen(host, () => this.closeScreen(true), (c) => this.onPlay(c));
    else if (where === 'inventory') this.screen = new InventoryScreen(host, () => this.closeScreen(true), () => { this.refreshWeapon(); });
    else if (where === 'loadout') this.screen = new LoadoutScreen(host, () => this.closeScreen(true), () => this.refreshAgent());
    else if (where === 'settings') this.screen = new SettingsPanel(host, () => this.closeScreen(true));
    else if (where === 'quit') this.quit(host);
  }

  private quit(host: HTMLElement) {
    const d = el('div', 'confirm', `<div class="confirm-box"><h2>SAIR DO JOGO?</h2><p>Seu progresso e configurações ficam salvos localmente.</p><div><button data-a="no">CANCELAR</button><button data-a="yes" class="primary">SAIR</button></div></div>`);
    host.appendChild(d);
    this.screen = { destroy: () => d.remove() };
    d.querySelector<HTMLButtonElement>('[data-a=no]')!.onclick = () => { audio.ui('back'); this.closeScreen(true); };
    d.querySelector<HTMLButtonElement>('[data-a=yes]')!.onclick = () => {
      audio.stopMenuMusic();
      window.close();
      document.body.innerHTML = `<div class="goodbye"><div class="logo">TACTICAL <b>STRIKE</b> <i>2</i></div><p>Obrigado por jogar! Você já pode fechar esta aba.</p><button onclick="location.reload()">VOLTAR AO JOGO</button></div>`;
    };
  }

  closeScreen(rerender = false) {
    if (this.screen) { this.screen.destroy(); this.screen = null; }
    this.root.classList.remove('dim');
    if (rerender) this.render();
  }

  show() {
    this.visible = true;
    this.root.style.display = 'block';
    this.closeScreen(true);
    this.refreshAgent();
    audio.startMenuMusic();
  }
  hide() {
    this.visible = false;
    this.closeScreen();
    this.root.style.display = 'none';
  }

  update(dt: number) {
    this.t += dt;
    this.char.update(dt, { speed: 0, crouch: 0, pitch: -0.3 + Math.sin(this.t * 0.5) * 0.02, dead: false });
    this.char.head.rotation.y = Math.sin(this.t * 0.35) * 0.18;
    const pos = this.dust.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + dt * 0.08;
      if (y > 6) y = 0;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(this.t + i) * dt * 0.03);
    }
    pos.needsUpdate = true;
    const cam = this.camera;
    cam.aspect = innerWidth / innerHeight;
    cam.position.set(Math.sin(this.t * 0.12) * 0.25 + this.mouseX * 0.35, 1.45 + Math.sin(this.t * 0.2) * 0.05 - this.mouseY * 0.15, 5.6);
    cam.lookAt(0, 1.05, -1.2);
    cam.updateProjectionMatrix();
    this.screen?.update?.(dt);
  }

  draw() {
    this.renderer.render(this.scene, this.camera);
  }
}
