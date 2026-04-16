"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export interface KeyboardShortcutsOptions {
  onOpenSearch?: () => void;
  onOpenHelp?: () => void;
  onEscape?: () => void;
}

// Chord state: first key pressed waiting for second
type ChordKey = "g" | "n" | null;

/**
 * Registers global keyboard shortcuts:
 *
 * Ctrl+K / Cmd+K  → open command palette (search)
 * Ctrl+/          → show shortcuts help
 * Escape          → close dialogs
 *
 * Chord sequences (must be pressed within 1 second):
 *   g h → go to /panel
 *   g m → go to /makineler
 *   g b → go to /arizalar
 *   g s → go to /parcalar
 *   g r → go to /raporlar
 *   n b → new breakdown /arizalar/yeni
 *   n m → new machine /makineler/yeni
 */
export function useKeyboardShortcuts(options: KeyboardShortcutsOptions = {}) {
  const router = useRouter();
  const chordRef = useRef<ChordKey>(null);
  const chordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep callbacks in a ref so the effect doesn't re-run when they change
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  useEffect(() => {
    function clearChord() {
      chordRef.current = null;
      if (chordTimerRef.current) {
        clearTimeout(chordTimerRef.current);
        chordTimerRef.current = null;
      }
    }

    function setChord(key: ChordKey) {
      chordRef.current = key;
      // Auto-cancel chord after 1 second
      if (chordTimerRef.current) clearTimeout(chordTimerRef.current);
      chordTimerRef.current = setTimeout(clearChord, 1000);
    }

    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Ctrl+K / Cmd+K → open search
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        callbacksRef.current.onOpenSearch?.();
        clearChord();
        return;
      }

      // Ctrl+/ → open help
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        callbacksRef.current.onOpenHelp?.();
        clearChord();
        return;
      }

      // Escape
      if (e.key === "Escape") {
        callbacksRef.current.onEscape?.();
        clearChord();
        return;
      }

      // Don't process chords when typing in inputs
      if (isInput) return;

      const current = chordRef.current;

      // Second key of chord
      if (current === "g") {
        clearChord();
        switch (e.key) {
          case "h": router.push("/panel"); break;
          case "m": router.push("/makineler"); break;
          case "b": router.push("/arizalar"); break;
          case "s": router.push("/parcalar"); break;
          case "r": router.push("/raporlar"); break;
        }
        return;
      }

      if (current === "n") {
        clearChord();
        switch (e.key) {
          case "b": router.push("/arizalar/yeni"); break;
          case "m": router.push("/makineler/yeni"); break;
        }
        return;
      }

      // First key of a chord
      if (e.key === "g") {
        setChord("g");
        return;
      }
      if (e.key === "n") {
        setChord("n");
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      clearChord();
    };
  }, [router]); // callbacksRef handles option updates without re-registering
}
