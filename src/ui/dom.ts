type Child = Node | string | null | false | undefined;
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<Record<string, string | boolean | ((e: Event) => void)>> = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, '').toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v !== undefined) el.setAttribute(k === 'cls' ? 'class' : k, v);
  }
  for (const k of kids) if (k) el.append(k);
  return el;
}
export const clear = (el: HTMLElement): void => { el.replaceChildren(); };
