"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform);

/** The find shortcut as this keyboard prints it: "⌘ F" on a Mac, "Ctrl F" elsewhere (and on the server, until hydrated). */
export function useFindKey(): string {
  const mac = useSyncExternalStore(subscribe, isMac, () => false);
  return mac ? "⌘ F" : "Ctrl F";
}
