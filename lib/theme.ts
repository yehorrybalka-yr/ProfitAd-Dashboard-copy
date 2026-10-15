export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "profitad-theme";
const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
}

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia(COLOR_SCHEME_QUERY).matches ? "dark" : "light";
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") return getSystemTheme();
  return preference;
}

export function applyResolvedTheme(resolved: ResolvedTheme): ResolvedTheme {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
  return resolved;
}

export function applyTheme(preference: ThemePreference): ResolvedTheme {
  return applyResolvedTheme(resolveTheme(preference));
}

/** Слушает смену темы ОС; вызывается сразу и при каждом изменении. */
export function subscribeToSystemTheme(
  onChange: (theme: ResolvedTheme) => void,
): () => void {
  const mq = window.matchMedia(COLOR_SCHEME_QUERY);

  const notify = () => onChange(mq.matches ? "dark" : "light");
  notify();

  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", notify);
    return () => mq.removeEventListener("change", notify);
  }

  mq.addListener(notify);
  return () => mq.removeListener(notify);
}
