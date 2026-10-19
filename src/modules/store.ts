/**
 * Persistence for the column definitions. They live in a single JSON
 * preference so that the whole configuration is one value to read, write,
 * back up or sync.
 */

import {
  ColumnDefinition,
  needsMigration,
  parseDefinitions,
  serialiseDefinitions,
} from "./definitions";
import { getPref, setPref } from "../utils/prefs";

export function getDefinitions(): ColumnDefinition[] {
  return parseDefinitions(getPref("columns") ?? "[]");
}

export function setDefinitions(definitions: readonly ColumnDefinition[]): void {
  setPref("columns", serialiseDefinitions(definitions));
}

/**
 * Rewrite definitions stored before field columns existed, so that each one
 * names its source. Identifiers are kept, so the columns' widths and positions
 * are unaffected.
 */
export function migrateDefinitions(): void {
  const stored = getPref("columns") ?? "[]";
  if (needsMigration(stored)) {
    setDefinitions(parseDefinitions(stored));
  }
}
