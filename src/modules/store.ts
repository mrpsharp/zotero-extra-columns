/**
 * Persistence for the column definitions. They live in a single JSON
 * preference so that the whole configuration is one value to read, write,
 * back up or sync.
 */

import {
  ColumnDefinition,
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
