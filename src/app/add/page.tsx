import type { Metadata } from "next";
import { AddFromSearch } from "@/components/AddFromSearch";
import { AddShowForm } from "@/components/AddShowForm";
import { SetupError } from "@/components/SetupError";
import { getStore } from "@/lib/store";

export const metadata: Metadata = { title: "Add a show" };
export const dynamic = "force-dynamic";

export default async function Add({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const { q } = await searchParams;
  const initialQuery = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 100) ?? "";
  let statusOptions: string[];
  try {
    statusOptions = await getStore().statusOptions();
  } catch (error) {
    return <SetupError error={error} />;
  }
  return (
    <div>
      <h1 className="page-title">Add a show</h1>
      <AddFromSearch key={initialQuery} statusOptions={statusOptions} initialQuery={initialQuery} />
      <details className="mt-10 max-w-xl">
        <summary className="cursor-pointer text-sm text-muted transition-colors select-none hover:text-text">Can&apos;t find it? Add it by hand</summary>
        <div className="mt-5">
          <AddShowForm statusOptions={statusOptions} />
        </div>
      </details>
    </div>
  );
}
