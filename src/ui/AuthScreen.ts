import { authUser, setAuthUser, type GameUser } from '../core/Auth';
import { audio } from '../core/Audio';
import { el } from '../core/util';

export class AuthScreen {
  root: HTMLDivElement;
  mode: 'login' | 'register' = 'login';
  constructor(parent: HTMLElement, private onClose: () => void, private onChange: (user: GameUser | null) => void) {
    this.root = el('div', 'auth-screen');
    parent.appendChild(this.root);
    this.render();
    requestAnimationFrame(() => this.root.classList.add('show'));
  }

  render() {
    const user = authUser();
    if (user) {
      this.root.innerHTML = `<div class="auth-card"><div class="auth-mark">◆</div><p class="auth-kicker">CONTA CONECTADA</p><h2></h2><span class="auth-role"></span><p class="auth-note">Seu progresso de conta é protegido pelo servidor.</p><div class="auth-actions"><button data-a="logout">SAIR DA CONTA</button><button class="primary" data-a="close">VOLTAR AO JOGO</button></div></div>`;
      this.root.querySelector('h2')!.textContent = user.username;
      this.root.querySelector('.auth-role')!.textContent = user.role === 'admin' ? 'ADMINISTRADOR' : 'JOGADOR';
      this.root.querySelector('[data-a=logout]')!.addEventListener('click', () => { void this.logout(); });
      this.root.querySelector('[data-a=close]')!.addEventListener('click', () => this.onClose());
      return;
    }
    this.root.innerHTML = `
      <div class="auth-card">
        <button class="auth-close" data-a="close" aria-label="Voltar">×</button>
        <div class="auth-mark">◆</div><p class="auth-kicker">TACTICAL STRIKE 2</p>
        <h2>${this.mode === 'login' ? 'ENTRAR' : 'CRIAR CONTA'}</h2>
        <div class="auth-tabs"><button data-mode="login" class="${this.mode === 'login' ? 'active' : ''}">ENTRAR</button><button data-mode="register" class="${this.mode === 'register' ? 'active' : ''}">CADASTRAR</button></div>
        <form autocomplete="on">
          <label for="auth-name">NOME DE JOGADOR</label>
          <input id="auth-name" name="username" type="text" minlength="3" maxlength="16" pattern="[A-Za-z0-9_]{3,16}" autocomplete="${this.mode === 'login' ? 'username' : 'username'}" required>
          <label for="auth-password">SENHA</label>
          <input id="auth-password" name="password" type="password" minlength="10" maxlength="128" autocomplete="${this.mode === 'login' ? 'current-password' : 'new-password'}" required>
          ${this.mode === 'register' ? '<div class="auth-admin-code" hidden><label for="auth-code">CÓDIGO INICIAL DE ADMIN</label><input id="auth-code" name="adminCode" type="password" maxlength="128" autocomplete="off"><small>Necessário somente para criar a conta reservada Goat.</small></div>' : ''}
          <p class="auth-message" role="status"></p>
          <button class="primary auth-submit" type="submit">${this.mode === 'login' ? 'ENTRAR' : 'CRIAR CONTA'}</button>
        </form>
        <p class="auth-note">As contas e senhas são armazenadas no banco do servidor. Não use a mesma senha de outros serviços.</p>
      </div>`;
    this.root.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => button.onclick = () => { this.mode = button.dataset.mode as 'login' | 'register'; this.render(); });
    this.root.querySelector('[data-a=close]')!.addEventListener('click', () => this.onClose());
    const name = this.root.querySelector<HTMLInputElement>('#auth-name')!;
    const codeBox = this.root.querySelector<HTMLElement>('.auth-admin-code');
    name.addEventListener('input', () => { if (codeBox) codeBox.hidden = name.value.trim().toLowerCase() !== 'goat'; });
    if (this.mode === 'login') {
      for (const type of ['copy', 'cut', 'paste', 'selectstart', 'contextmenu']) name.addEventListener(type, (event) => event.preventDefault());
      name.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && ['c', 'x', 'v'].includes(event.key.toLowerCase())) event.preventDefault(); });
    }
    this.root.querySelector('form')!.addEventListener('submit', (event) => { event.preventDefault(); void this.submit(); });
  }

  private async submit() {
    const form = this.root.querySelector('form')!;
    const fields = new FormData(form);
    const message = this.root.querySelector<HTMLElement>('.auth-message')!;
    const button = this.root.querySelector<HTMLButtonElement>('.auth-submit')!;
    button.disabled = true; message.textContent = 'Conectando…';
    try {
      const response = await fetch('/.netlify/functions/auth', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: this.mode === 'login' ? 'login' : 'register', username: fields.get('username'), password: fields.get('password'), adminCode: fields.get('adminCode') })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível entrar.');
      setAuthUser(data.user);
      audio.ui('equip');
      this.onChange(data.user);
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : 'Serviço de conta indisponível.';
      button.disabled = false;
    }
  }

  private async logout() {
    await fetch('/.netlify/functions/auth', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) }).catch(() => {});
    setAuthUser(null);
    audio.ui('back');
    this.onChange(null);
  }
  destroy() { this.root.remove(); }
}
