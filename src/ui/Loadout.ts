import * as THREE from 'three';
import { AGENTS, AgentStyle, CharacterModel } from '../render/characterModel';
import { buildWeapon } from '../render/weaponModels';
import { el } from '../core/util';
import { audio } from '../core/Audio';
import { skinManager, skinById, RARITY_COLOR } from '../data/skins';
import { skinThumb } from '../render/thumbnails';
import { WEAPONS } from '../data/weapons';

const KEY = 'ts2_agents_v1';
export function loadAgents(): Record<'T' | 'CT', string> {
  try {
    const r = localStorage.getItem(KEY);
    if (r) return { T: 't_phoenix', CT: 'ct_gign', ...JSON.parse(r) };
  } catch { /* */ }
  return { T: 't_phoenix', CT: 'ct_gign' };
}
function saveAgents(a: Record<'T' | 'CT', string>) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* */ } }

const portraitCache = new Map<string, string>();
let pr: THREE.WebGLRenderer | null = null;
export function agentPortrait(st: AgentStyle): string {
  if (portraitCache.has(st.id)) return portraitCache.get(st.id)!;
  if (!pr) {
    pr = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    pr.outputColorSpace = THREE.SRGBColorSpace;
    pr.toneMapping = THREE.ACESFilmicToneMapping;
  }
  pr.setSize(220, 300, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x554433, 1.4));
  const d = new THREE.DirectionalLight(0xffeedd, 2.4);
  d.position.set(1, 2, 2);
  scene.add(d);
  const rim = new THREE.DirectionalLight(0x88aaff, 1.5);
  rim.position.set(-2, 1, -2);
  scene.add(rim);
  const m = new CharacterModel(st);
  m.setWeapon(buildWeapon(st.team === 'T' ? 'ak47' : 'm4a4'), 'rifle');
  m.update(0.016, { speed: 0, crouch: 0, pitch: 0, dead: false });
  m.root.rotation.y = Math.PI + 0.5;
  scene.add(m.root);
  const cam = new THREE.PerspectiveCamera(30, 220 / 300, 0.1, 20);
  cam.position.set(0, 1.25, 3.6);
  cam.lookAt(0, 1.0, 0);
  pr.setClearColor(0x000000, 0);
  pr.render(scene, cam);
  const url = pr.domElement.toDataURL();
  portraitCache.set(st.id, url);
  return url;
}

/** "Equipamentos" screen: choose agents + view equipped skins */
export class LoadoutScreen {
  root: HTMLDivElement;
  constructor(parent: HTMLElement, private onClose: () => void, private onChange: () => void) {
    this.root = el('div', 'screen loadout');
    parent.appendChild(this.root);
    this.render();
    requestAnimationFrame(() => this.root.classList.add('show'));
  }
  render() {
    const sel = loadAgents();
    const agentCards = (team: 'T' | 'CT') => AGENTS.filter((a) => a.team === team).map((a) => `
      <button class="agent-card ${sel[team] === a.id ? 'active' : ''} ${team === 'T' ? 't' : 'ct'}" data-id="${a.id}" data-team="${team}">
        <img src="${agentPortrait(a)}"><div class="ag-name">${a.name}</div><div class="ag-desc">${a.desc}</div>
        ${sel[team] === a.id ? '<div class="ag-eq">EQUIPADO</div>' : ''}
      </button>`).join('');
    const weapons = ['ak47', 'm4a4', 'm4a1s', 'awp', 'glock', 'usps', 'deagle', 'knife'];
    const skins = weapons.map((w) => {
      const sk = skinById(skinManager.get(w))!;
      return `<div class="lo-skin" style="--rc:${RARITY_COLOR[sk.rarity]}"><img src="${skinThumb(w, sk.pattern, 240, 120)}"><div><b>${WEAPONS[w].name}</b><small>${sk.name}</small></div></div>`;
    }).join('');
    this.root.innerHTML = `
      <div class="screen-head"><h1>EQUIPAMENTOS</h1><span>Escolha seus agentes e confira o arsenal equipado</span><button class="close" data-act="back">✕ VOLTAR</button></div>
      <div class="lo-body">
        <div class="lo-col"><h3 class="t">AGENTES TERRORISTAS</h3><div class="agents">${agentCards('T')}</div>
        <h3 class="ct">AGENTES CONTRA-TERRORISTAS</h3><div class="agents">${agentCards('CT')}</div></div>
        <div class="lo-col narrow"><h3>ARSENAL EQUIPADO</h3><div class="lo-skins">${skins}</div><p class="lo-tip">Altere as skins na tela de Inventário.</p></div>
      </div>`;
    this.root.querySelectorAll<HTMLButtonElement>('.agent-card').forEach((b) => {
      b.onmouseenter = () => audio.ui('hover');
      b.onclick = () => {
        const a = loadAgents();
        a[b.dataset.team as 'T' | 'CT'] = b.dataset.id!;
        saveAgents(a);
        audio.ui('equip');
        this.render();
        this.onChange();
      };
    });
    (this.root.querySelector('[data-act=back]') as HTMLButtonElement).onclick = () => { audio.ui('back'); this.onClose(); };
  }
  destroy() { this.root.remove(); }
}
