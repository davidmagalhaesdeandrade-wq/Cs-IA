import * as THREE from 'three';
import './styles.css';
import { input } from './core/Input';
import { audio } from './core/Audio';
import { settings } from './core/Settings';
import { MainMenu, loadProfile, saveProfile } from './ui/MainMenu';
import { GameSession, MatchConfig } from './game/GameSession';
import { mapArt, MAPS } from './ui/MapSelect';
import { el } from './core/util';
import { refreshAuth, authUser } from './core/Auth';
import { AdminPanel } from './ui/AdminPanel';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLDivElement;

const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouchDevice, powerPreference: isTouchDevice ? 'low-power' : 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = settings.data.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

function applyRenderSettings() {
  const d = settings.data;
  const base = Math.min(isTouchDevice ? 1.25 : 2, devicePixelRatio || 1);
  renderer.setPixelRatio(base * d.renderScale * (d.quality === 'low' ? 0.75 : 1));
  renderer.setSize(innerWidth, innerHeight, false);
  if (renderer.shadowMap.enabled !== d.shadows) {
    renderer.shadowMap.enabled = d.shadows;
    const scenes = [menu.scene, session?.scene].filter(Boolean) as THREE.Scene[];
    scenes.forEach((s) => s.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material; if (m) m.needsUpdate = true; }));
  }
  if (session) {
    const sun = session.map.sun;
    sun.castShadow = d.shadows;
    const sz = isTouchDevice
      ? (d.quality === 'high' ? 1024 : d.quality === 'medium' ? 512 : 256)
      : (d.quality === 'high' ? 4096 : d.quality === 'medium' ? 2048 : 1024);
    if (sun.shadow.mapSize.x !== sz) {
      sun.shadow.mapSize.set(sz, sz);
      sun.shadow.map?.dispose();
      (sun.shadow as any).map = null;
    }
  }
}

input.init(canvas);
let session: GameSession | null = null;
let lastCfg: MatchConfig | null = null;

const menu = new MainMenu(renderer, uiRoot, (cfg) => startMatch(cfg));
void refreshAuth().then(() => menu.render());
applyRenderSettings();
settings.onChange(applyRenderSettings);
window.addEventListener('resize', () => { applyRenderSettings(); session?.resize(); });

// audio needs a user gesture
const unlockAudio = () => { audio.ensure(); if (!session) audio.startMenuMusic(); window.removeEventListener('pointerdown', unlockAudio); window.removeEventListener('keydown', unlockAudio); };
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

const TIPS = [
  'Pare de se mover antes de atirar: a precisão melhora muito.',
  'Atire em rajadas curtas com o AK-47 para controlar o recuo.',
  'Agachar reduz a dispersão dos disparos.',
  'Segure SHIFT para andar sem fazer barulho de passos.',
  'O kit de desarme reduz o tempo de desarme de 10 para 5 segundos.',
  'Pressione F para inspecionar sua arma. Exiba sua skin!',
  'Flashbangs cegam quem estiver olhando na direção delas.',
  'Granadas de fumaça bloqueiam a visão dos bots.'
];

function showLoading(cfg: MatchConfig) {
  const m = MAPS[0];
  const ld = el('div', 'loading', `
    <img class="ld-bg" src="${mapArt(m, 1280, 720)}">
    <div class="ld-shade"></div>
    <div class="ld-content">
      <div class="ld-mode">COMPETITIVO · ${cfg.size}v${cfg.size} · BOTS ${({ easy: 'FÁCEIS', normal: 'NORMAIS', hard: 'DIFÍCEIS' } as any)[cfg.difficulty]}</div>
      <div class="ld-map">DUST II</div>
      <div class="ld-tip">DICA: ${TIPS[Math.floor(Math.random() * TIPS.length)]}</div>
      <div class="ld-bar"><i></i></div>
      <div class="ld-status">Carregando…</div>
    </div>`);
  uiRoot.appendChild(ld);
  return ld;
}

function startMatch(cfg: MatchConfig) {
  lastCfg = cfg;
  audio.ensure();
  audio.stopMenuMusic();
  menu.hide();
  const ld = showLoading(cfg);
  const bar = ld.querySelector('.ld-bar i') as HTMLElement;
  const status = ld.querySelector('.ld-status') as HTMLElement;
  const steps = ['Gerando texturas procedurais…', 'Construindo Dust II…', 'Calculando colisões e navegação…', 'Recrutando bots…', 'Preparando o round…'];
  let i = 0;
  const tick = () => {
    status.textContent = steps[Math.min(i, steps.length - 1)];
    bar.style.width = Math.min(100, (i + 1) * 20) + '%';
    i++;
    if (i === 3) {
      try {
        session = new GameSession(renderer, cfg, uiRoot, exitSession);
        applyRenderSettings();
        // warm-up render to compile shaders while loading screen is visible
        session.render(0.016);
      } catch (e) {
        console.error(e);
        status.textContent = 'Erro ao carregar: ' + (e as Error).message;
        return;
      }
    }
    if (i < steps.length + 1) setTimeout(tick, i === 2 ? 60 : 220);
    else {
      ld.classList.add('hide');
      setTimeout(() => ld.remove(), 700);
    }
  };
  setTimeout(tick, 120);
}

function exitSession(action: 'menu' | 'restart') {
  if (!session) return;
  const p = session.player;
  const prof = loadProfile();
  prof.kills += Math.max(0, p.kills);
  prof.xp += Math.max(0, p.kills) * 100 + p.mvps * 150;
  if (session.state === 'ended' && session.match.matchWinner) {
    prof.matches++;
    if (session.match.matchWinner === p.team) { prof.wins++; prof.xp += 600; }
  }
  saveProfile(prof);
  const account = authUser();
  if (account) {
    const completed = session.state === 'ended';
    const won = completed && session.match.matchWinner === p.team;
    void fetch('/.netlify/functions/profile', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kills: Math.max(0, p.kills), matches: completed ? 1 : 0, wins: won ? 1 : 0 })
    }).then(async (response) => { if (response.ok) { await refreshAuth(); menu.render(); } }).catch(() => {});
  }
  session.dispose();
  session = null;
  if (action === 'restart' && lastCfg) startMatch(lastCfg);
  else menu.show();
}

let adminPanel: AdminPanel | null = null;
function openAdminPanel(resumeAfter = !!session && !session.paused) {
  if (authUser()?.role !== 'admin' || adminPanel) return false;
  if (session && !session.paused) session.pause(false);
  adminPanel = new AdminPanel(uiRoot, () => {
    adminPanel?.destroy(); adminPanel = null;
    if (resumeAfter && session?.paused) session.resume();
  }, (action) => session?.setPracticePower(action), () => !!session && session.state === 'playing');
  return true;
}

let commandBox: HTMLDivElement | null = null;
let commandWasPaused = false;
function openCommand() {
  if (!session || session.state !== 'playing' || commandBox || adminPanel) return;
  commandWasPaused = session.paused;
  if (!session.paused) session.pause(false);
  const box = el('div', 'admin-command', '<label>COMANDO DE JOGO</label><input maxlength="32" autocomplete="off" spellcheck="false" placeholder="/painel"><small>ENTER para executar · ESC para fechar</small><p role="status"></p>');
  uiRoot.appendChild(box); commandBox = box;
  const field = box.querySelector('input')!;
  field.focus();
  field.onkeydown = (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') { closeCommand(); return; }
    if (event.key !== 'Enter') return;
    const command = field.value.trim().toLowerCase();
    if (command === '/painel') {
      if (authUser()?.role !== 'admin') { box.querySelector('p')!.textContent = 'Comando disponível somente para a conta administradora.'; return; }
      closeCommand(true); openAdminPanel(!commandWasPaused); return;
    }
    box.querySelector('p')!.textContent = 'Comando desconhecido.';
  };
}
function closeCommand(openPanel = false) {
  commandBox?.remove(); commandBox = null;
  if (!openPanel && !commandWasPaused && session?.paused) session.resume();
}
window.addEventListener('keydown', (event) => {
  if ((event.code === 'Slash' && !event.ctrlKey && !event.metaKey) || event.code === 'F10') {
    if (session && !commandBox) { event.preventDefault(); openCommand(); }
  }
});

// expose for automated testing / debugging
(window as any).__ts2 = { get session() { return session; }, menu, startMatch, openAdminPanel };

let last = performance.now();
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (session) {
    session.update(dt);
    session.render(dt);
  } else {
    menu.update(dt);
    menu.draw();
    input.endFrame();
  }
}
requestAnimationFrame(frame);
