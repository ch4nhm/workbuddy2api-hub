import { DICT, HANT_CHARS, HANT_PHRASES } from "@/lib/i18n-data";

export type Language = "zh" | "zh-Hant" | "en";

const LANG_KEY = "wb-lang";
const HAN = /[\u4e00-\u9fff]/;
const WS = /\s+/g;
const ATTRS = ["title", "placeholder", "aria-label", "data-label", "alt"];
const SKIP: Record<string, number> = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, NOSCRIPT: 1 };

interface TextNodeState extends Text {
  __wbSrc?: string;
  __wbOut?: string | null;
}

interface ElementState extends Element {
  __wbAttr?: Record<string, string | null>;
}

const RULES: Array<[RegExp, (...args: string[]) => string]> = [
  [/（国际版共 (\d+) 个，启用 (\d+) 个）/, (m, n, e) => `(Global: ${n} total, ${e} enabled)`],
  [/（国内版共 (\d+) 个，启用 (\d+) 个）/, (m, n, e) => `(China: ${n} total, ${e} enabled)`],
  [/有 (\d+) 把 Key 没有绑定出口/, (m, n) => `${n} keys have no exit bound`],
  [/共 (\d+) 条记录/, (m, n) => `${n} records`],
  [/第 (\d+) \/ (\d+) 页 · 共 ([\d,]+) 条记录/, (m, a, b, c) => `Page ${a} / ${b} · ${c} records`],
  [/共 (\d+) 个，启用 (\d+) 个/, (m, a, b) => `${a} total, ${b} enabled`],
  [/含失败共 ([\d,]+) 次/, (m, n) => `${n} calls including failures`],
  [/失败 ([\d,]+) 次/, (m, n) => `${n} failed`],
];

const enKeys = Object.keys(DICT).sort((a, b) => b.length - a.length);
const enByFirst: Record<string, string[]> = {};
for (const key of enKeys) {
  const first = key.charAt(0);
  (enByFirst[first] ||= []).push(key);
}

const hantKeys = Object.keys(HANT_PHRASES).sort((a, b) => b.length - a.length);
const hantByFirst: Record<string, string[]> = {};
for (const key of hantKeys) {
  const first = key.charAt(0);
  (hantByFirst[first] ||= []).push(key);
}

function lookup(text: string, index: number, buckets: Record<string, string[]>): string | null {
  const bucket = buckets[text.charAt(index)];
  if (!bucket) return null;
  for (const key of bucket) {
    if (text.slice(index, index + key.length) === key) return key;
  }
  return null;
}

export function translate(text: unknown): string {
  let value = String(text ?? "");
  const whole = Object.prototype.hasOwnProperty.call(DICT, value) ? DICT[value] : null;
  if (whole != null) return whole;
  for (const [pattern, replace] of RULES) value = value.replace(pattern, replace);
  const afterRules = Object.prototype.hasOwnProperty.call(DICT, value) ? DICT[value] : null;
  if (afterRules != null) return afterRules;

  let output = "";
  let index = 0;
  while (index < value.length) {
    const hit = lookup(value, index, enByFirst);
    if (hit) {
      output += DICT[hit];
      index += hit.length;
    } else {
      output += value.charAt(index);
      index += 1;
    }
  }
  return output;
}

export function translateHant(text: unknown): string {
  const value = String(text ?? "");
  const whole = Object.prototype.hasOwnProperty.call(HANT_PHRASES, value)
    ? HANT_PHRASES[value]
    : null;
  if (whole != null) return whole;

  let output = "";
  let index = 0;
  while (index < value.length) {
    const hit = lookup(value, index, hantByFirst);
    if (hit) {
      output += HANT_PHRASES[hit];
      index += hit.length;
    } else {
      const char = value.charAt(index);
      output += Object.prototype.hasOwnProperty.call(HANT_CHARS, char)
        ? HANT_CHARS[char]
        : char;
      index += 1;
    }
  }
  return output;
}

function readInitialLanguage(): Language {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("lang");
    if (fromUrl === "en" || fromUrl === "zh" || fromUrl === "zh-Hant") return fromUrl;
  } catch {
    // Fall through to the instance default.
  }
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === "en" || saved === "zh" || saved === "zh-Hant") return saved;
  } catch {
    // Instance default is next.
  }
  const instance = document.documentElement.getAttribute("data-ui-language");
  return instance === "en" || instance === "zh-Hant" ? instance : "zh";
}

export class I18nController {
  language: Language = readInitialLanguage();
  private observer: MutationObserver | null = null;
  private cached = new WeakMap<Element, boolean>();
  private listeners = new Set<() => void>();

  start(): void {
    document.documentElement.setAttribute("data-lang", this.language);
    document.documentElement.lang =
      this.language === "en" ? "en" : this.language === "zh-Hant" ? "zh-Hant-TW" : "zh-CN";
    this.apply();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  set(language: Language): void {
    this.language = language;
    try {
      localStorage.setItem(LANG_KEY, language);
    } catch {
      // The active page still switches in memory.
    }
    document.documentElement.setAttribute("data-lang", language);
    document.documentElement.lang =
      language === "en" ? "en" : language === "zh-Hant" ? "zh-Hant-TW" : "zh-CN";
    this.observer?.disconnect();
    this.observer = null;
    document.documentElement.setAttribute("data-i18n-revision", String(Date.now()));
    this.apply();
    this.listeners.forEach((listener) => listener());
  }

  apply(): void {
    if (this.language === "zh") return;
    this.walk(document.documentElement);
    this.observe();
  }

  destroy(): void {
    this.observer?.disconnect();
    this.observer = null;
  }

  private allowed(element: Element | null): boolean {
    const chain: Element[] = [];
    let current = element;
    let verdict = true;
    let settled = false;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      const cached = this.cached.get(current);
      if (cached !== undefined) {
        verdict = cached;
        settled = true;
        break;
      }
      if (SKIP[current.tagName] || current.hasAttribute("data-no-i18n")) {
        verdict = false;
        settled = true;
        break;
      }
      chain.push(current);
      current = current.parentElement;
    }
    if (current && current.nodeType !== Node.ELEMENT_NODE) settled = true;
    if (settled) chain.forEach((node) => this.cached.set(node, verdict));
    return verdict;
  }

  private doText(node: Text): void {
    const state = node as TextNodeState;
    const current = node.data;
    if (state.__wbOut === current) return;
    state.__wbSrc = current;
    if (!HAN.test(current)) return;
    const translated =
      this.language === "en"
        ? translate(current.replace(WS, " "))
        : this.language === "zh-Hant"
          ? translateHant(current.replace(WS, " "))
          : current;
    if (translated === current) return;
    state.__wbOut = translated;
    node.data = translated;
  }

  private doAttrs(element: Element): void {
    if (!element.hasAttributes()) return;
    const state = element as ElementState;
    const store = (state.__wbAttr ||= {});
    for (const attribute of ATTRS) {
      if (!element.hasAttribute(attribute)) continue;
      const current = element.getAttribute(attribute) || "";
      const outputSlot = `${attribute}|out`;
      if (store[outputSlot] === current) continue;
      store[attribute] = current;
      if (!HAN.test(current)) continue;
      const translated =
        this.language === "en"
          ? translate(current.replace(WS, " "))
          : this.language === "zh-Hant"
            ? translateHant(current.replace(WS, " "))
            : current;
      if (translated === current) continue;
      store[outputSlot] = translated;
      element.setAttribute(attribute, translated);
    }
  }

  private walk(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.parentElement && this.allowed(node.parentElement)) this.doText(node as Text);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || !this.allowed(node as Element)) return;
    this.doAttrs(node as Element);
    node.childNodes.forEach((child) => this.walk(child));
  }

  private observe(): void {
    if (this.observer || typeof MutationObserver === "undefined") return;
    this.observer = new MutationObserver((records) => {
      if (this.language === "zh") return;
      for (const record of records) {
        if (record.type === "childList") {
          record.addedNodes.forEach((node) => this.walk(node));
        } else if (record.type === "characterData") {
          if (record.target.parentElement && this.allowed(record.target.parentElement)) {
            this.doText(record.target as Text);
          }
        } else {
          this.doAttrs(record.target as Element);
        }
      }
    });
    this.observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRS,
    });
  }
}

export const i18n = new I18nController();

if (typeof window !== "undefined") {
  const nativeConfirm = window.confirm.bind(window);
  const nativeAlert = window.alert.bind(window);
  window.confirm = (message?: string) =>
    nativeConfirm(
      i18n.language === "en"
        ? translate(message)
        : i18n.language === "zh-Hant"
          ? translateHant(message)
          : message,
    );
  window.alert = (message?: string) =>
    nativeAlert(
      i18n.language === "en"
        ? translate(message)
        : i18n.language === "zh-Hant"
          ? translateHant(message)
          : message,
    );
}
