import { LibraryView } from "@/components/LibraryView";
import { SetupError } from "@/components/SetupError";
import { getLibrary } from "@/lib/library";
import { summarize } from "@/lib/summary";
import type { ShowSummary } from "@/lib/types";

// Public showcase: re-read Notion at most every 15 min (owner actions refresh it right away).
export const revalidate = 900;

export default async function Home() {
  let shows: ShowSummary[];
  try {
    const library = await getLibrary();
    shows = summarize(library);
  } catch (error) {
    return <SetupError error={error} />;
  }
  return <LibraryView shows={shows} />;
}
