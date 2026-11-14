import * as THREE from 'three';
import { settings } from './Settings';

export type ShotKind = 'rifle' | 'rifle2' | 'pistol' | 'deagle' | 'sniper' | 'smg' | 'shotgun' | 'silenced' | 'silencedPistol';

/** All sounds are synthesized with the Web Audio API — no external assets. */
class AudioManager {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfx!: GainNode;
  music!: GainNode;
  reverb!: ConvolverNode;
  reverbSend!: GainNode;
  noise!: AudioBuffer;
  private musicNodes: AudioNode[] = [];
  private musicTimer: number | null = null;
  private ambientNodes: AudioNode[] = [];
  private lastUi = 0;

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx!;
    this.master = c.createGain();
    this.master.connect(c.destination);
    this.sfx = c.createGain();
    this.sfx.connect(this.master);
    this.music = c.createGain();
    this.music.connect(this.master);
    // white noise buffer
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // generated impulse response for a dry outdoor slap-back reverb
    const irLen = Math.floor(c.sampleRate * 1.6);
    const ir = c.createBuffer(2, irLen, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < irLen; i++) {
        const t = i / irLen;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2) * (i < c.sampleRate * 0.012 ? 0.2 : 1);
      }
    }
    this.reverb = c.createConvolver();
    this.reverb.buffer = ir;
    this.reverbSend = c.createGain();
    this.reverbSend.gain.value = 0.35;
    this.reverbSend.connect(this.reverb);
    this.reverb.connect(this.sfx);
    this.applyVolumes();
    settings.onChange(() => this.applyVolumes());
  }

  applyVolumes() {
    if (!this.ctx) return;
    const s = settings.data;
    this.master.gain.value = s.masterVolume;
    this.sfx.gain.value = s.sfxVolume;
    this.music.gain.value = s.musicVolume * 0.5;
  }

  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  setListener(pos: THREE.Vector3, fwd: THREE.Vector3) {
    if (!this.ctx) return;
    const l: any = this.ctx.listener;
    if (l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setTargetAtTime(pos.x, t, 0.01);
      l.positionY.setTargetAtTime(pos.y, t, 0.01);
      l.positionZ.setTargetAtTime(pos.z, t, 0.01);
      l.forwardX.setTargetAtTime(fwd.x, t, 0.01);
      l.forwardY.setTargetAtTime(fwd.y, t, 0.01);
      l.forwardZ.setTargetAtTime(fwd.z, t, 0.01);
      l.upX.value = 0; l.upY.value = 1; l.upZ.value = 0;
    } else {
      l.setPosition(pos.x, pos.y, pos.z);
      l.setOrientation(fwd.x, fwd.y, fwd.z, 0, 1, 0);
    }
  }

  /** returns a node to connect sources to; spatialized if pos given */
  private out(pos?: THREE.Vector3 | null, vol = 1, reverb = 0): AudioNode {
    const c = this.ctx!;
    const g = c.createGain();
    g.gain.value = vol;
    if (pos) {
      const p = c.createPanner();
      p.panningModel = 'HRTF';
      p.distanceModel = 'inverse';
      p.refDistance = 4;
      p.rolloffFactor = 1.1;
      p.maxDistance = 300;
      p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z;
      g.connect(p);
      p.connect(this.sfx);
    } else g.connect(this.sfx);
    if (reverb > 0) {
      const r = c.createGain();
      r.gain.value = reverb;
      g.connect(r);
      r.connect(this.reverbSend);
    }
    return g;
  }

  private noiseSrc(dur: number) {
    const c = this.ctx!;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const off = Math.random() * 1.5;
    s.start(c.currentTime, off, dur + 0.05);
    return s;
  }

  private env(g: GainNode, t: number, a: number, peak: number, dec: number, curve = 'exp') {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (curve === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
    else g.gain.linearRampToValueAtTime(0, t + a + dec);
  }

  private noiseBurst(dest: AudioNode, t: number, dur: number, type: BiquadFilterType, f0: number, f1: number, q: number, vol: number, attack = 0.002) {
    const c = this.ctx!;
    const src = this.noiseSrc(dur + attack);
    const f = c.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain();
    this.env(g, t, attack, vol, dur);
    src.connect(f); f.connect(g); g.connect(dest);
  }

  private tone(dest: AudioNode, t: number, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, attack = 0.003) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    const g = c.createGain();
    this.env(g, t, attack, vol, dur);
    o.connect(g); g.connect(dest);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  shot(kind: ShotKind, pos: THREE.Vector3 | null, local: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const v = local ? 0.75 : 1.4;
    const rv = local ? 0.5 : 0.9;
    switch (kind) {
      case 'rifle': {
        const o = this.out(pos, v, rv);
        this.noiseBurst(o, t, 0.035, 'highpass', 3000, 1500, 0.7, 0.9);
        this.noiseBurst(o, t, 0.22, 'lowpass', 4200, 500, 0.9, 1.0);
        this.tone(o, t, 'sine', 160, 42, 0.16, 1.1);
        this.tone(o, t, 'triangle', 90, 35, 0.12, 0.5);
        break;
      }
      case 'rifle2': {
        const o = this.out(pos, v * 0.9, rv);
        this.noiseBurst(o, t, 0.03, 'highpass', 3600, 2000, 0.7, 0.8);
        this.noiseBurst(o, t, 0.17, 'lowpass', 5200, 700, 1.0, 0.9);
        this.tone(o, t, 'sine', 190, 55, 0.12, 0.9);
        break;
      }
      case 'smg': {
        const o = this.out(pos, v * 0.75, rv);
        this.noiseBurst(o, t, 0.025, 'highpass', 3500, 2200, 0.7, 0.6);
        this.noiseBurst(o, t, 0.12, 'lowpass', 4600, 800, 1, 0.8);
        this.tone(o, t, 'sine', 220, 70, 0.08, 0.7);
        break;
      }
      case 'pistol': {
        const o = this.out(pos, v * 0.75, rv);
        this.noiseBurst(o, t, 0.02, 'highpass', 4000, 2500, 0.7, 0.7);
        this.noiseBurst(o, t, 0.14, 'lowpass', 5000, 900, 1, 0.8);
        this.tone(o, t, 'sine', 260, 80, 0.07, 0.7);
        break;
      }
      case 'deagle': {
        const o = this.out(pos, v * 1.1, rv * 1.2);
        this.noiseBurst(o, t, 0.04, 'highpass', 2800, 1200, 0.7, 1);
        this.noiseBurst(o, t, 0.32, 'lowpass', 3500, 300, 1, 1.1);
        this.tone(o, t, 'sine', 140, 35, 0.22, 1.2);
        break;
      }
      case 'sniper': {
        const o = this.out(pos, v * 1.25, rv * 1.6);
        this.noiseBurst(o, t, 0.05, 'highpass', 2500, 900, 0.7, 1.1);
        this.noiseBurst(o, t, 0.6, 'lowpass', 3000, 160, 1, 1.25);
        this.tone(o, t, 'sine', 110, 28, 0.42, 1.4);
        this.tone(o, t, 'square', 70, 30, 0.2, 0.25);
        break;
      }
      case 'shotgun': {
        const o = this.out(pos, v * 1.1, rv * 1.2);
        this.noiseBurst(o, t, 0.4, 'lowpass', 2600, 200, 1, 1.25);
        this.tone(o, t, 'sine', 120, 35, 0.25, 1.2);
        break;
      }
      case 'silenced':
      case 'silencedPistol': {
        const o = this.out(pos, local ? 0.5 : 0.6, 0.15);
        this.noiseBurst(o, t, 0.07, 'bandpass', 2400, 900, 1.2, 0.9);
        this.noiseBurst(o, t, 0.012, 'highpass', 6000, 5000, 1, 0.4);
        this.tone(o, t, 'sine', 400, 120, 0.05, 0.4);
        // mechanical clack
        this.noiseBurst(o, t + 0.03, 0.02, 'bandpass', 3500, 3000, 4, 0.35);
        break;
      }
    }
  }

  dryFire() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.out(null, 0.5);
    this.noiseBurst(o, t, 0.02, 'bandpass', 4000, 3000, 5, 0.6);
  }

  click(pos: THREE.Vector3 | null, t0 = 0, f = 3000, vol = 0.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + t0;
    const o = this.out(pos, vol);
    this.noiseBurst(o, t, 0.025, 'bandpass', f, f * 0.8, 6, 0.8);
    this.tone(o, t, 'square', f / 4, f / 6, 0.015, 0.08);
  }

  reload(dur: number, pos: THREE.Vector3 | null = null, local = true) {
    if (!this.ctx) return;
    const v = local ? 0.6 : 0.8;
    this.click(pos, dur * 0.15, 1800, v);           // mag release
    this.cloth(pos, dur * 0.3, v * 0.5);
    this.click(pos, dur * 0.6, 2600, v);           // mag insert
    this.click(pos, dur * 0.64, 1500, v * 0.7);
    this.click(pos, dur * 0.85, 3200, v);          // bolt
    this.click(pos, dur * 0.9, 2000, v * 0.9);
  }

  bolt(pos: THREE.Vector3 | null, delay = 0.35) {
    this.click(pos, delay, 2200, 0.55);
    this.click(pos, delay + 0.18, 2800, 0.55);
  }

  cloth(pos: THREE.Vector3 | null, t0 = 0, vol = 0.3) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + t0;
    const o = this.out(pos, vol);
    this.noiseBurst(o, t, 0.12, 'bandpass', 900, 1600, 0.8, 0.5, 0.03);
  }

  equip(kind: string) {
    if (!this.ctx) return;
    this.cloth(null, 0, 0.35);
    if (kind === 'knife') {
      const t = this.ctx.currentTime;
      const o = this.out(null, 0.35);
      this.tone(o, t + 0.05, 'sine', 5200, 4800, 0.25, 0.08);
      this.noiseBurst(o, t + 0.04, 0.15, 'highpass', 6000, 8000, 0.5, 0.3);
    } else this.click(null, 0.12, 2400, 0.4);
  }

  footstep(pos: THREE.Vector3 | null, surface: string, vol = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.out(pos, (pos ? 1.2 : 0.35) * vol);
    if (surface === 'wood' || surface === 'metal') {
      this.noiseBurst(o, t, 0.06, 'bandpass', surface === 'metal' ? 1800 : 700, 400, 2, 0.8);
      this.tone(o, t, 'sine', surface === 'metal' ? 420 : 160, 90, 0.05, 0.5);
    } else {
      this.noiseBurst(o, t, 0.07, 'bandpass', 1100 + Math.random() * 400, 500, 1.2, 0.8);
      this.noiseBurst(o, t + 0.015, 0.05, 'highpass', 3000, 2000, 0.5, 0.25);
    }
  }

  land(vol = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.out(null, 0.5 * vol);
    this.noiseBurst(o, t, 0.12, 'lowpass', 900, 200, 1, 1);
    this.cloth(null, 0.02, 0.25);
  }

  jump() { this.cloth(null, 0, 0.25); }

  hitBody(pos: THREE.Vector3 | null, local = true) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.out(pos, local ? 0.55 : 0.8);
    this.noiseBurst(o, t, 0.08, 'lowpass', 1200, 300, 1, 1);
    this.tone(o, t, 'sine', 180, 80, 0.06, 0.5);
  }

  headshot(pos: THREE.Vector3 | null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.out(pos, 0.6);
    this.tone(o, t, 'sine', 2350, 2300, 0.18, 0.5);
    this.tone(o, t, 'sine', 3520, 3400, 0.12, 0.3);
    this.noiseBurst(o, t, 0.03, 'highpass', 5000, 4000, 1, 0.5);
  }

  hurt() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.out(null, 0.5);
    this.noiseBurst(o, t, 0.1, 'lowpass', 900, 200, 1, 0.9);
    this.tone(o, t, 'sine', 100, 50, 0.12, 0.7);
  }

  knifeSwing(hit: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.out(null, 0.45);
    this.noiseBurst(o, t, 0.18, 'bandpass', 700, 3500, 1.5, 0.8, 0.04);
    if (hit) {
      this.noiseBurst(o, t + 0.08, 0.1, 'lowpass', 1500, 300, 1, 1);
      this.tone(o, t + 0.08, 'sine', 150, 70, 0.08, 0.8);
    }
  }

  impact(pos: THREE.Vector3, surface: string) {
    if (!this.ctx || Math.random() < 0.4) return;
    const t = this.ctx.currentTime;
    const o = this.out(pos, 0.35);
    if (surface === 'metal') this.tone(o, t, 'triangle', 2800 + Math.random() * 800, 2000, 0.08, 0.4);
    else if (surface === 'wood') this.noiseBurst(o, t, 0.05, 'bandpass', 900, 600, 2, 0.8);
    else this.noiseBurst(o, t, 0.06, 'bandpass', 2200, 1200, 1, 0.6);
  }

  beep(pos: THREE.Vector3 | null, freq = 2650, vol = 0.6) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.out(pos, vol);
    this.tone(o, t, 'square', freq, freq, 0.09, 0.25, 0.001);
    this.tone(o, t, 'sine', freq / 2, freq / 2, 0.09, 0.2, 0.001);
  }

  keypad(i: number) {
    if (!this.ctx) return;
    const freqs = [1209, 1336, 1477, 1633, 941, 852, 770];
    this.beep(null, freqs[i % freqs.length] * 1.6, 0.25);
  }

  explosion(pos: THREE.Vector3 | null, big = true) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.out(pos, big ? 2.2 : 1.6, 1.5);
    this.noiseBurst(o, t, big ? 2.6 : 1.2, 'lowpass', 2400, 60, 0.8, 1.3, 0.005);
    this.noiseBurst(o, t, 0.08, 'highpass', 2000, 800, 0.6, 1);
    this.tone(o, t, 'sine', 90, 22, big ? 1.4 : 0.8, 1.6);
    this.tone(o, t + 0.05, 'sawtooth', 50, 25, big ? 1 : 0.5, 0.4);
  }

  flashbang(pos: THREE.Vector3 | null, ringStrength: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.out(pos, 1.6, 1.2);
    this.noiseBurst(o, t, 0.5, 'highpass', 1500, 400, 0.6, 1.2);
    this.tone(o, t, 'sine', 120, 40, 0.3, 0.9);
    if (ringStrength > 0.15) {
      const r = this.out(null, 0.18 * ringStrength);
      this.tone(r, t + 0.02, 'sine', 3600, 3550, 2.5 * ringStrength + 0.4, 1, 0.01);
    }
  }

  smokePop(pos: THREE.Vector3) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.out(pos, 0.9);
    this.noiseBurst(o, t, 0.06, 'lowpass', 1500, 400, 1, 1);
    this.noiseBurst(o, t + 0.03, 2.4, 'highpass', 2500, 1200, 0.5, 0.45, 0.2);
  }

  bounce(pos: THREE.Vector3) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.out(pos, 0.5);
    this.tone(o, t, 'triangle', 1700, 1200, 0.05, 0.4);
    this.noiseBurst(o, t, 0.03, 'bandpass', 2500, 2000, 3, 0.4);
  }

  pin() {
    this.click(null, 0, 4200, 0.4);
    this.click(null, 0.12, 3000, 0.3);
  }

  throwWhoosh() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noiseBurst(this.out(null, 0.3), t, 0.2, 'bandpass', 600, 1800, 1.2, 0.6, 0.05);
  }

  ui(kind: 'hover' | 'click' | 'back' | 'error' | 'equip') {
    this.ensure();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (kind === 'hover') {
      if (t - this.lastUi < 0.04) return;
      this.lastUi = t;
      this.tone(this.out(null, 0.08), t, 'sine', 1900, 1800, 0.03, 0.6);
    } else if (kind === 'click') {
      const o = this.out(null, 0.25);
      this.tone(o, t, 'sine', 1100, 900, 0.06, 0.7);
      this.noiseBurst(o, t, 0.02, 'highpass', 6000, 5000, 1, 0.2);
    } else if (kind === 'back') {
      this.tone(this.out(null, 0.2), t, 'sine', 800, 600, 0.07, 0.6);
    } else if (kind === 'error') {
      const o = this.out(null, 0.25);
      this.tone(o, t, 'square', 220, 200, 0.1, 0.3);
      this.tone(o, t + 0.11, 'square', 180, 170, 0.12, 0.3);
    } else if (kind === 'equip') {
      const o = this.out(null, 0.3);
      this.tone(o, t, 'sine', 880, 880, 0.08, 0.5);
      this.tone(o, t + 0.08, 'sine', 1320, 1320, 0.15, 0.5);
    }
  }

  buy() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.out(null, 0.35);
    this.click(null, 0, 2500, 0.4);
    this.tone(o, t + 0.04, 'triangle', 1568, 1568, 0.1, 0.5);
    this.tone(o, t + 0.11, 'triangle', 2093, 2093, 0.2, 0.5);
  }

  roundStart() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.out(null, 0.3);
    [523, 659, 784].forEach((f, i) => this.tone(o, t + i * 0.09, 'triangle', f, f, 0.18, 0.5));
  }

  bombPlantedAnnounce() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.out(null, 0.35);
    for (let i = 0; i < 3; i++) {
      this.tone(o, t + i * 0.22, 'sawtooth', 880, 860, 0.16, 0.3);
      this.tone(o, t + i * 0.22, 'sine', 440, 440, 0.16, 0.4);
    }
  }

  roundEnd(win: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.out(null, 0.32);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    lp.connect(o);
    const notes = win ? [392, 523, 659, 784, 1046] : [440, 415, 349, 294, 220];
    notes.forEach((f, i) => {
      this.tone(lp, t + i * 0.14, 'sawtooth', f, f, win && i === 4 ? 1.2 : 0.3, 0.35, 0.01);
      this.tone(lp, t + i * 0.14, 'triangle', f / 2, f / 2, win && i === 4 ? 1.2 : 0.3, 0.3, 0.01);
    });
  }

  startMenuMusic() {
    this.ensure();
    if (!this.ctx || this.musicNodes.length) return;
    const c = this.ctx;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    lp.Q.value = 2;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = c.createGain();
    lfoG.gain.value = 350;
    lfo.connect(lfoG);
    lfoG.connect(lp.frequency);
    lfo.start();
    const bus = c.createGain();
    bus.gain.value = 0;
    bus.gain.linearRampToValueAtTime(0.22, c.currentTime + 3);
    lp.connect(bus);
    bus.connect(this.music);
    const delay = c.createDelay();
    delay.delayTime.value = 0.42;
    const fb = c.createGain();
    fb.gain.value = 0.35;
    bus.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(this.music);
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [130.8, 196, 261.6], [196, 246.9, 293.7]];
    const voices: OscillatorNode[] = [];
    for (let i = 0; i < 6; i++) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = (i % 2 ? 7 : -7);
      const g = c.createGain();
      g.gain.value = 0.12;
      o.connect(g); g.connect(lp);
      o.start();
      voices.push(o);
    }
    const bass = c.createOscillator();
    bass.type = 'sine';
    const bg = c.createGain();
    bg.gain.value = 0.35;
    bass.connect(bg); bg.connect(bus);
    bass.start();
    let ci = 0;
    const setChord = () => {
      const ch = chords[ci % chords.length];
      const t = c.currentTime;
      voices.forEach((v, i) => v.frequency.setTargetAtTime(ch[i % 3] * (i >= 3 ? 2 : 1), t, 0.6));
      bass.frequency.setTargetAtTime(ch[0] / 2, t, 0.4);
      // soft pulse
      for (let k = 0; k < 4; k++) {
        const tt = t + k * 2;
        const p = c.createOscillator();
        p.type = 'triangle';
        p.frequency.value = ch[(k + 1) % 3] * 2;
        const pg = c.createGain();
        pg.gain.setValueAtTime(0.0001, tt);
        pg.gain.linearRampToValueAtTime(0.05, tt + 0.02);
        pg.gain.exponentialRampToValueAtTime(0.0001, tt + 1.2);
        p.connect(pg); pg.connect(bus);
        p.start(tt); p.stop(tt + 1.3);
      }
      ci++;
    };
    setChord();
    this.musicTimer = window.setInterval(setChord, 8000);
    this.musicNodes = [lfo, bass, ...voices, bus];
  }

  stopMenuMusic() {
    if (!this.ctx) return;
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    const bus = this.musicNodes[this.musicNodes.length - 1] as GainNode;
    if (bus) bus.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    const nodes = this.musicNodes;
    this.musicNodes = [];
    setTimeout(() => nodes.forEach((n: any) => { try { n.stop && n.stop(); n.disconnect(); } catch { /* */ } }), 1500);
  }

  startAmbient() {
    if (!this.ctx || this.ambientNodes.length) return;
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 380;
    const g = c.createGain();
    g.gain.value = 0.045;
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.11;
    const lg = c.createGain();
    lg.gain.value = 0.025;
    lfo.connect(lg); lg.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    s.start(); lfo.start();
    this.ambientNodes = [s, lfo, g];
  }
  stopAmbient() {
    this.ambientNodes.forEach((n: any) => { try { n.stop && n.stop(); n.disconnect(); } catch { /* */ } });
    this.ambientNodes = [];
  }
}

export const audio = new AudioManager();
