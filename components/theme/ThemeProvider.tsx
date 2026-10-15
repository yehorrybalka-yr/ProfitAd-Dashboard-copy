"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  applyResolvedTheme,
  applyTheme,
  getStoredTheme,
  subscribeToSystemTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

interface ThemeContextValue {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  const setPreference = useCallback((pref: ThemePreference) => {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
    setPreferenceState(pref);
    setResolved(applyTheme(pref));
  }, []);

  useEffect(() => {
    const stored = getStoredTheme();
    setPreferenceState(stored);
    setResolved(applyTheme(stored));
  }, []);

  // Следим за системной темой, когда выбрано «как на устройстве»
  useEffect(() => {
    if (preference !== "system") return;

    return subscribeToSystemTheme((theme) => {
      applyResolvedTheme(theme);
      setResolved(theme);
    });
  }, [preference]);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme должен использоваться внутри ThemeProvider");
  return ctx;
}
