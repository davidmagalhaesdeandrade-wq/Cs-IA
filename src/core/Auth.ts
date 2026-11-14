export interface GameUser { id: string; username: string; role: 'player' | 'admin'; xp: number; matches: number; wins: number; kills: number; credits: number; rank: string }
let currentUser: GameUser | null = null;
export const authUser = () => currentUser;
export const setAuthUser = (user: GameUser | null) => { currentUser = user; };

export async function refreshAuth(): Promise<GameUser | null> {
  try {
    const res = await fetch('/.netlify/functions/auth?action=me', { credentials: 'same-origin', cache: 'no-store' });
    if (!res.ok) { currentUser = null; return null; }
    const data = await res.json();
    currentUser = data.user ?? null;
  } catch { currentUser = null; }
  return currentUser;
}
