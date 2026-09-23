/**
 * The column definitions the user configures in the settings pane.
 *
 * This module is pure so that it can be unit tested in plain Node; reading and
 * writing the preference itself lives in `store.ts`.
 */

import { COLUMN_TYPES, ColumnType } from "./extra";

export interface ColumnDefinition {
  /** Stable identifier, used to build the item tree's data key. */
  id: string;
  /** Column header shown in the item list. */
  label: string;
  /** The Extra key whose value the column shows. */
  key: string;
  /** How the value is interpreted for sorting. */
  type: ColumnType;
}

/** Create a definition with a fresh identifier. */
export function createDefinition(
  partial: Partial<ColumnDefinition> = {},
): ColumnDefinition {
  return {
    id: partial.id ?? newDefinitionID(),
    label: partial.label ?? "",
    key: partial.key ?? "",
    type: partial.type ?? "text",
  };
}

/**
 * Identifiers must survive a restart, because Zotero persists a column's
 * width, visibility and sort direction against its data key.
 */
export function newDefinitionID(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Read definitions out of the stored JSON, discarding anything malformed.
 * A definition is usable once it has an Extra key; an empty label falls back
 * to the key when the column is registered.
 */
export function parseDefinitions(json: string): ColumnDefinition[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) {
    return [];
  }

  const seen = new Set<string>();
  const definitions: ColumnDefinition[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const candidate = entry as Partial<ColumnDefinition>;
    const key = typeof candidate.key === "string" ? candidate.key.trim() : "";
    if (!key) {
      continue;
    }
    let id = typeof candidate.id === "string" ? candidate.id.trim() : "";
    if (!id || seen.has(id)) {
      id = newDefinitionID();
    }
    seen.add(id);
    definitions.push({
      id,
      key,
      label: typeof candidate.label === "string" ? candidate.label.trim() : "",
      type: isColumnType(candidate.type) ? candidate.type : "text",
    });
  }
  return definitions;
}

/** Serialise definitions for storage, keeping only entries with a key. */
export function serialiseDefinitions(
  definitions: readonly ColumnDefinition[],
): string {
  return JSON.stringify(
    definitions
      .filter((definition) => definition.key.trim())
      .map(({ id, label, key, type }) => ({
        id,
        label: label.trim(),
        key: key.trim(),
        type,
      })),
  );
}

/** The header to show for a definition, falling back to its Extra key. */
export function definitionLabel(definition: ColumnDefinition): string {
  return definition.label.trim() || definition.key.trim();
}

function isColumnType(value: unknown): value is ColumnType {
  return COLUMN_TYPES.includes(value as ColumnType);
}
