import en, { type Dict } from "./en";
import fa from "./fa";

const dicts: Record<string, Dict> = { fa, en };
export type Locale = keyof typeof dicts;

export function t(locale: string | undefined, key: string, vars?: Record<string, string | number>): string {
  const dict = dicts[locale ?? "fa"] ?? dicts.fa!;
  const tmpl = dict[key] ?? en[key] ?? key;
  if (!vars) return tmpl;
  return tmpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}
