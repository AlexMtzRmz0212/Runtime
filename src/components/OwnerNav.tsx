"use client";

import { LockSimple, SignOut } from "@phosphor-icons/react";
import Link from "next/link";
import { NavLink } from "./NavLink";
import { QuickSearch } from "./QuickSearch";
import { useOwner } from "./useOwner";

/** Header links plus the owner-only ones. Visitors see just a lock icon that leads to the sign-in page. */
export function OwnerNav({ links }: { links: { href: string; label: string }[] }) {
  const owner = useOwner();

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <>
      {/* Own row under the wordmark on phones, inline from sm up. */}
      <div className="order-last flex w-full items-center gap-6 overflow-x-auto pb-3 sm:order-none sm:w-auto sm:overflow-visible sm:pb-0">
        {links.map((l) => (
          <NavLink key={l.href} href={l.href}>{l.label}</NavLink>
        ))}
        {owner && <NavLink href="/ranks">Ranks</NavLink>}
        {owner && <NavLink href="/add">Add</NavLink>}
      </div>
      <div className="ml-auto flex items-center gap-4">
        <QuickSearch />
        {owner === false && (
          <Link href="/login" className="-m-2 p-2 text-muted transition-colors hover:text-text" title="Owner sign in" aria-label="Owner sign in">
            <LockSimple size={18} aria-hidden />
          </Link>
        )}
        {owner && (
          <button onClick={logout} className="-m-2 inline-flex cursor-pointer items-center gap-1.5 p-2 text-sm text-muted transition-colors hover:text-text" aria-label="Log out">
            <SignOut size={18} aria-hidden />
            <span className="hidden sm:inline">Log out</span>
          </button>
        )}
      </div>
    </>
  );
}
