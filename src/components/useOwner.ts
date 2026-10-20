"use client";

import { useEffect, useState } from "react";

// One request per page load, shared by every component below. Signing in or out reloads the page, which resets it.
let ownerCheck: Promise<boolean> | undefined;
const checkOwner = () =>
  (ownerCheck ??= fetch("/api/me", { cache: "no-store" })
    .then((r) => r.json())
    .then((d) => Boolean(d.owner))
    .catch(() => false));

/** Hook shared by every component that shows owner-only tools. Visitors get false and never see them. */
export function useOwner(): boolean | null {
  const [owner, setOwner] = useState<boolean | null>(null);
  useEffect(() => {
    checkOwner().then(setOwner);
  }, []);
  return owner;
}
