import { required } from "../env";
import { notionStore } from "./notion";
import type { Store } from "./types";

/** The Notion-backed store. A missing variable surfaces as a setup error on the page instead of an empty library. */
export function getStore(): Store {
  required("NOTION_TOKEN");
  required("SHOWS_DATABASE_ID");
  return notionStore;
}
