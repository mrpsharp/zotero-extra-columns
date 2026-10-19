/**
 * The column definitions the user configures in the settings pane.
 *
 * This module is pure so that it can be unit tested in plain Node; reading and
 * writing the preference itself lives in `store.ts`.
 */

import { COLUMN_TYPES, ColumnType } from "./extra";

/**
 * Where a column's value comes from: a `key: value` line in Extra, or one of
 * Zotero's own item fields.
 */
export type ColumnSource = "extra" | "field";

export interface ColumnDefinition {
  /** Stable identifier, used to build the item tree's data key. */
  id: string;
  /** Column header shown in the item list. */
  label: string;
  source: ColumnSource;
  /** The Extra key whose value the column shows, for an Extra column. */
  key: string;
  /** Zotero's internal field name (e.g. `originalDate`), for a field column. */
  field: string;
  /**
   * For a field column, an Extra key to read when the field is empty or does
   * not apply to the item's type. Optional.
   */
  fallbackKey: string;
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
    source: partial.source ?? "extra",
    key: partial.key ?? "",
    field: partial.field ?? "",
    fallbackKey: partial.fallbackKey ?? "",
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
 *
 * Definitions stored before field columns existed have no `source`, and are
 * read as Extra columns. A definition is usable once it has an Extra key or a
 * field, according to its source; an empty label falls back to the key or the
 * field's name when the column is registered.
 */
export function parseDefinitions(json: string): ColumnDefinition[] {
  const raw = parseStored(json);
  if (!raw) {
    return [];
  }

  const seen = new Set<string>();
  const definitions: ColumnDefinition[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const candidate = entry as Partial<Record<keyof ColumnDefinition, unknown>>;
    const source: ColumnSource =
      candidate.source === "field" ? "field" : "extra";
    const key = trimmed(candidate.key);
    const field = trimmed(candidate.field);
    if (source === "extra" ? !key : !field) {
      continue;
    }
    let id = trimmed(candidate.id);
    if (!id || seen.has(id)) {
      id = newDefinitionID();
    }
    seen.add(id);
    definitions.push({
      id,
      label: trimmed(candidate.label),
      source,
      key: source === "extra" ? key : "",
      field: source === "field" ? field : "",
      fallbackKey: source === "field" ? trimmed(candidate.fallbackKey) : "",
      type: isColumnType(candidate.type) ? candidate.type : "text",
    });
  }
  return definitions;
}

/**
 * Serialise definitions for storage, keeping only usable entries.
 *
 * Field columns are stored without a `key`, so that an older version of the
 * plugin, which requires one, discards them rather than misreading them.
 */
export function serialiseDefinitions(
  definitions: readonly ColumnDefinition[],
): string {
  return JSON.stringify(
    definitions.filter(isUsable).map((definition) => {
      const { id, label, source, type } = definition;
      if (source === "field") {
        const fallbackKey = definition.fallbackKey.trim();
        return {
          id,
          label: label.trim(),
          source,
          field: definition.field.trim(),
          ...(fallbackKey ? { fallbackKey } : {}),
          type,
        };
      }
      return {
        id,
        label: label.trim(),
        source,
        key: definition.key.trim(),
        type,
      };
    }),
  );
}

/**
 * Whether the stored JSON predates the `source` property and should be
 * rewritten. Malformed storage is left alone rather than overwritten.
 */
export function needsMigration(json: string): boolean {
  const raw = parseStored(json);
  return (
    !!raw &&
    raw.some(
      (entry) => !!entry && typeof entry === "object" && !("source" in entry),
    )
  );
}

/**
 * The header to show for a definition. An empty header falls back to the
 * Extra key, or to the field's label, which `fieldLabel` supplies.
 */
export function definitionLabel(
  definition: ColumnDefinition,
  fieldLabel: (field: string) => string = (field) => field,
): string {
  const label = definition.label.trim();
  if (label) {
    return label;
  }
  return definition.source === "field"
    ? fieldLabel(definition.field.trim())
    : definition.key.trim();
}

function isUsable(definition: ColumnDefinition): boolean {
  return definition.source === "field"
    ? !!definition.field.trim()
    : !!definition.key.trim();
}

function parseStored(json: string): unknown[] | null {
  try {
    const raw: unknown = JSON.parse(json || "[]");
    return Array.isArray(raw) ? raw : null;
  } catch {
    return null;
  }
}

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isColumnType(value: unknown): value is ColumnType {
  return COLUMN_TYPES.includes(value as ColumnType);
}
