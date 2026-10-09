import { h } from './dom';

export function showLoading(root: HTMLElement): { progress(done: number, total: number): void } {
  const fill = h('i');
  root.replaceChildren(h('div', { cls: 'screen loading', id: 'loading' }, h('h1', {}, 'CAMP GLOWSTICK — SUMMER 1987'), h('div', { cls: 'bar' }, fill), h('p', {}, 'Packing the coolers...')));
  return { progress: (d, t) => { fill.style.width = `${(d / t) * 100}%`; } };
}
