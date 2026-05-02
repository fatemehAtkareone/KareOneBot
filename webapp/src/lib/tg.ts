// Telegram WebApp SDK wrapper
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        initDataUnsafe: { user?: { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string } };
        version: string;
        themeParams: Record<string, string>;
        colorScheme: "light" | "dark";
        viewportHeight: number;
        viewportStableHeight: number;
        ready(): void;
        expand(): void;
        close(): void;
        BackButton: { isVisible: boolean; show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
        MainButton: {
          text: string; isVisible: boolean; isActive: boolean;
          show(): void; hide(): void; setText(t: string): void;
          onClick(cb: () => void): void; offClick(cb: () => void): void;
          showProgress(leaveActive?: boolean): void; hideProgress(): void;
          setParams(p: { color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }): void;
        };
        HapticFeedback: {
          impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
          notificationOccurred(type: "error" | "success" | "warning"): void;
          selectionChanged(): void;
        };
        onEvent(event: string, cb: () => void): void;
        offEvent(event: string, cb: () => void): void;
        setHeaderColor(color: string): void;
        setBackgroundColor(color: string): void;
        sendData(data: string): void;
        openLink(url: string, options?: { try_instant_view?: boolean }): void;
        openTelegramLink(url: string): void;
      };
    };
  }
}

export const tg = () => window.Telegram?.WebApp;

export function initTelegram(): void {
  const w = tg();
  if (!w) return;
  w.ready();
  w.expand();
  applyTheme();
  w.onEvent("themeChanged", applyTheme);
}

function hexToRgb(hex?: string): string | null {
  if (!hex) return null;
  const m = hex.replace(/^#/, "").match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

export function applyTheme(): void {
  const w = tg();
  if (!w) return;
  const root = document.documentElement;
  const tp = w.themeParams ?? {};
  if (w.colorScheme === "dark") root.classList.add("dark"); else root.classList.remove("dark");
  const set = (cssVar: string, hex?: string) => {
    const rgb = hexToRgb(hex);
    if (rgb) root.style.setProperty(cssVar, rgb);
  };
  set("--tg-bg", tp.bg_color);
  set("--tg-text", tp.text_color);
  set("--tg-hint", tp.hint_color);
  set("--tg-link", tp.link_color);
  set("--tg-button", tp.button_color);
  set("--tg-button-text", tp.button_text_color);
  set("--tg-secondary-bg", tp.secondary_bg_color);
  set("--tg-card", tp.section_bg_color);
  set("--tg-accent", tp.accent_text_color);
}

export function haptic(kind: "light" | "medium" | "heavy" | "success" | "warning" | "error" | "selection" = "light") {
  const h = tg()?.HapticFeedback;
  if (!h) return;
  if (kind === "success" || kind === "warning" || kind === "error") h.notificationOccurred(kind);
  else if (kind === "selection") h.selectionChanged();
  else h.impactOccurred(kind);
}

export function setRtl(locale?: string) {
  const isFa = (locale ?? document.documentElement.lang ?? "fa").startsWith("fa");
  document.documentElement.dir = isFa ? "rtl" : "ltr";
  document.documentElement.lang = isFa ? "fa" : "en";
}
