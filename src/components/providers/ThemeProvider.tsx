"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
} from "react";

import { useSettingsStore } from "@/store/settings";

import { ThemeMode } from "@/types/settings";

type ThemeContextType = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
};

type ThemeProviderProps = {
  children: React.ReactNode;
  attribute?: string;
  forcedTheme?: ThemeMode;
  enableSystem?: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export function ThemeProvider({
  children,
  attribute = "class",
  forcedTheme,
  enableSystem = true,
}: ThemeProviderProps) {
  const {
    user,
    updateUserSettings,
    themeMode,
    motionEnabled,
    colorMode,
    contrast,
    setThemeMode,
  } = useSettingsStore();

  // Use forcedTheme if provided, otherwise use themeMode (new source of truth).
  // Fall back to user.theme for backwards compatibility if themeMode is somehow absent.
  const currentTheme = forcedTheme || themeMode || user.theme;

  // Function to apply theme to the DOM
  const applyTheme = useCallback(
    (theme: ThemeMode) => {
      const root = window.document.documentElement;

      // Remove both themes first from class
      root.classList.remove("light", "dark");

      // For data attributes other than class
      if (attribute !== "class") {
        root.removeAttribute(attribute);
      }

      // Handle system preference if enabled
      if (theme === "system" && enableSystem) {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
          .matches
          ? "dark"
          : "light";

        // Always add the class for Tailwind
        if (systemTheme === "dark") {
          root.classList.add("dark");
        }

        // Also set the attribute if different from class
        if (attribute !== "class") {
          root.setAttribute(attribute, systemTheme);
        }
      } else {
        // Apply the theme directly
        if (theme === "dark") {
          root.classList.add("dark");
        }

        // Also set the attribute if different from class
        if (attribute !== "class") {
          root.setAttribute(attribute, theme);
        }
      }
    },
    [attribute, enableSystem]
  );

  // Apply theme when it changes
  useEffect(() => {
    if (forcedTheme) {
      applyTheme(forcedTheme);
    } else {
      applyTheme(themeMode || user.theme);
    }
  }, [themeMode, user.theme, forcedTheme, applyTheme]);

  // Listen for system theme changes if system preference is enabled
  useEffect(() => {
    const activeTheme = forcedTheme || themeMode || user.theme;
    if (forcedTheme || !enableSystem || activeTheme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      applyTheme("system");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeMode, user.theme, forcedTheme, enableSystem, applyTheme]);

  // Apply design-system data attributes to <html>
  useEffect(() => {
    const root = window.document.documentElement;
    root.setAttribute("data-motion", motionEnabled ? "on" : "off");
  }, [motionEnabled]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.setAttribute("data-color-mode", colorMode);
  }, [colorMode]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.setAttribute("data-contrast", contrast);
  }, [contrast]);

  const setTheme = (theme: ThemeMode) => {
    // Update both sources of truth: user.theme (DB-backed, backwards compat)
    // and themeMode (new client-side source of truth for design system).
    updateUserSettings({ theme });
    setThemeMode(theme);

    // If forcedTheme is set, we don't apply the theme change directly
    // as the forcedTheme will override it in the UI
    if (!forcedTheme) {
      applyTheme(theme);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme: currentTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
