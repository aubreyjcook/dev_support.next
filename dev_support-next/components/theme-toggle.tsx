"use client";

import { useSyncExternalStore } from "react";

import { THEME_STORAGE_KEY } from "@/lib/theme";

type Theme = "light" | "dark" | "system";

const CYCLE: readonly Theme[] = ["system", "light", "dark"];

const LABEL: Record<Theme, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

/** Internal event so the toggle re-renders immediately in the same tab. */
const CHANGE_EVENT = "helpdesk-theme-change";

function readStoredTheme(): Theme {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

function subscribe(onChange: () => void): () => void {
  // `storage` fires for other tabs; the custom event covers this one.
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** The server cannot know the preference, so hydration starts from "system". */
function getServerSnapshot(): Theme {
  return "system";
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="2.75" />
      <path d="M8 1.5v1.2M8 13.3v1.2M1.5 8h1.2M13.3 8h1.2M3.4 3.4l.85.85M11.75 11.75l.85.85M12.6 3.4l-.85.85M4.25 11.75l-.85.85" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8Z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="1.8" y="2.6" width="12.4" height="8.2" rx="1.2" />
      <path d="M5.6 13.4h4.8" />
    </svg>
  );
}

/**
 * Cycles System -> Light -> Dark.
 *
 * The theme lives in `localStorage` plus a `data-theme` attribute on `<html>`,
 * i.e. outside React. `useSyncExternalStore` reads that external store, which
 * keeps server and client renders consistent (no hydration mismatch, no
 * `setState` in an effect) and syncs the icon across browser tabs.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readStoredTheme, getServerSnapshot);

  function cycleTheme() {
    const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length];

    const root = document.documentElement;
    if (next === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", next);
    }

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Storage disabled (private mode): the choice simply does not persist.
    }

    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="btn btn-ghost size-8 p-0"
      title={`Theme: ${LABEL[theme]} (click to change)`}
      aria-label={`Theme: ${LABEL[theme]}. Click to change.`}
    >
      {theme === "light" ? <SunIcon /> : theme === "dark" ? <MoonIcon /> : <SystemIcon />}
    </button>
  );
}
