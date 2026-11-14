/** Polled + event-driven input. Event callbacks are needed for actions that require user activation (pointer lock). */
class InputManager {
  keys = new Set<string>();
  pressed = new Set<string>();
  released = new Set<string>();
  buttons = new Set<number>();
  virtualKeys = new Set<string>();
  virtualButtons = new Set<number>();
  bPressed = new Set<number>();
  bReleased = new Set<number>();
  dx = 0;
  dy = 0;
  wheel = 0;
  locked = false;
  canvas!: HTMLCanvasElement;
  keyHandlers: ((code: string, down: boolean, e: KeyboardEvent) => void)[] = [];
  lockHandlers: ((locked: boolean) => void)[] = [];
  /** when true, gameplay keys are captured (prevent default on Tab etc.) */
  gameActive = false;

  init(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    window.addEventListener('keydown', (e) => {
      if (this.gameActive && ['Tab', 'Space', 'KeyB', 'ControlLeft', 'AltLeft', 'F1', 'KeyF'].includes(e.code)) e.preventDefault();
      if (e.ctrlKey && this.gameActive && (e.code === 'KeyW' || e.code === 'KeyS' || e.code === 'KeyD' || e.code === 'KeyA')) e.preventDefault();
      if (!e.repeat) {
        if (!this.keys.has(e.code)) this.pressed.add(e.code);
        this.keys.add(e.code);
        this.keyHandlers.forEach((h) => h(e.code, true, e));
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.released.add(e.code);
      this.keyHandlers.forEach((h) => h(e.code, false, e));
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.buttons.clear(); this.virtualKeys.clear(); this.virtualButtons.clear(); });
    window.addEventListener('mousedown', (e) => {
      this.buttons.add(e.button);
      this.bPressed.add(e.button);
    });
    window.addEventListener('mouseup', (e) => {
      this.buttons.delete(e.button);
      this.bReleased.add(e.button);
    });
    window.addEventListener('contextmenu', (e) => { if (this.gameActive) e.preventDefault(); });
    window.addEventListener('mousemove', (e) => {
      if (this.locked) {
        // guard against browser spikes on lock acquisition
        if (Math.abs(e.movementX) < 400 && Math.abs(e.movementY) < 400) {
          this.dx += e.movementX;
          this.dy += e.movementY;
        }
      }
    });
    window.addEventListener('wheel', (e) => { this.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      this.lockHandlers.forEach((h) => h(this.locked));
    });
  }
  requestLock() {
    if (this.locked) return;
    try {
      const p: any = this.canvas.requestPointerLock({ unadjustedMovement: true } as any);
      if (p && p.catch) p.catch(() => { try { this.canvas.requestPointerLock(); } catch { /* */ } });
    } catch {
      try { this.canvas.requestPointerLock(); } catch { /* */ }
    }
  }
  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
  setVirtualKey(code: string, down: boolean) {
    if (down && !this.virtualKeys.has(code)) this.pressed.add(code);
    if (down) this.virtualKeys.add(code); else { this.virtualKeys.delete(code); this.released.add(code); }
  }
  setVirtualMouse(button: number, down: boolean) {
    if (down && !this.virtualButtons.has(button)) this.bPressed.add(button);
    if (down) this.virtualButtons.add(button); else { this.virtualButtons.delete(button); this.bReleased.add(button); }
  }
  addLookDelta(dx: number, dy: number) { this.dx += dx; this.dy += dy; }
  down(code: string) { return this.keys.has(code) || this.virtualKeys.has(code); }
  hit(code: string) { return this.pressed.has(code); }
  mouse(b: number) { return this.buttons.has(b) || this.virtualButtons.has(b); }
  mouseHit(b: number) { return this.bPressed.has(b); }
  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.bPressed.clear();
    this.bReleased.clear();
    this.dx = 0;
    this.dy = 0;
    this.wheel = 0;
  }
}

export const input = new InputManager();
