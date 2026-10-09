import { MAX_CAP, MIN_CAP } from '../net/protocol';
import { ERROR_TEXT, type NetErrorKind } from '../net/session';
import { h } from './dom';

export interface MenuHandlers { onHost: (name: string, cap: number) => void; onJoin: (name: string, code: string) => void }

export function showMenu(root: HTMLElement, hd: MenuHandlers, opts: { code?: string; error?: NetErrorKind | string; name?: string } = {}): { setError(e: string): void; busy(b: boolean): void } {
  const name = h('input', { id: 'name', maxlength: '14', placeholder: 'Counselor name', value: opts.name ?? `Camper${Math.floor(Math.random() * 90 + 10)}` });
  const cap = h('select', { id: 'cap' }, ...Array.from({ length: MAX_CAP - MIN_CAP + 1 }, (_, i) => h('option', { value: String(MIN_CAP + i), selected: MIN_CAP + i === MAX_CAP }, `${MIN_CAP + i} campers`)));
  const code = h('input', { id: 'join-code', maxlength: '12', placeholder: 'pine21', autocapitalize: 'off', autocomplete: 'off', value: opts.code ?? '' });
  const err = h('div', { id: 'error', cls: 'error hidden', role: 'alert' });
  const host = h('button', { id: 'btn-host', onclick: () => hd.onHost(name.value.trim(), Number(cap.value)) }, 'Start camp');
  const join = h('button', { id: 'btn-join', cls: 'alt', onclick: () => hd.onJoin(name.value.trim(), code.value) }, 'Join camp');
  code.addEventListener('keydown', (e) => { if (e.key === 'Enter') join.click(); });
  const setError = (e: string) => { const msg = (ERROR_TEXT as Record<string, string>)[e] ?? e; err.textContent = msg; err.classList.toggle('hidden', !msg); };
  if (opts.error) setError(opts.error);
  root.replaceChildren(h('div', { cls: 'screen', id: 'menu' }, h('div', { cls: 'card' },
    h('h1', {}, 'Camp Glowstick'),
    h('p', { cls: 'sub' }, 'Summer 1987 · Registration Desk · Cabin 6 is waiting'),
    h('label', { for: 'name' }, 'Your name'), name,
    h('label', { for: 'cap' }, 'Start a new camp'),
    h('div', { cls: 'row' }, cap, host),
    h('label', { for: 'join-code' }, 'Or join with a camp code'),
    h('div', { cls: 'row' }, code, join),
    err)));
  return { setError, busy: (b) => { host.disabled = join.disabled = b; } };
}
