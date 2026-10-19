/**
 * Zotero's own item fields, for columns that show a field directly.
 *
 * Zotero's column picker offers a fixed list of columns, so fields added in
 * later Zotero versions (Original Date, DOI and the like) appear in the item
 * pane but cannot be shown as columns. The fields offered here are worked out
 * at run time, as every field minus those that already have a column, so that
 * fields added by future versions appear without any change to the plugin.
 *
 * `selectAvailableFields` is pure so that it can be unit tested; the rest reads
 * the running Zotero.
 */

import { ColumnType } from "./extra";

export interface FieldOption {
  /** Zotero's internal field name, e.g. `originalDate`. */
  name: string;
  /** The field's label in the user's language, e.g. "Original Date". */
  label: string;
}

/**
 * The data keys of Zotero's built-in item tree columns, copied from
 * `chrome/content/zotero/itemTreeColumns.jsx` in Zotero 10.0.6. Only used if
 * that module cannot be read from the running Zotero (see `builtInColumnKeys`).
 */
const BUILT_IN_COLUMNS_FALLBACK = [
  "title",
  "firstCreator",
  "itemType",
  "date",
  "year",
  "publisher",
  "publicationTitle",
  "journalAbbreviation",
  "language",
  "accessDate",
  "libraryCatalog",
  "callNumber",
  "rights",
  "dateAdded",
  "dateModified",
  "lastRead",
  "archive",
  "archiveLocation",
  "place",
  "volume",
  "edition",
  "number",
  "pages",
  "issue",
  "series",
  "seriesTitle",
  "court",
  "medium",
  "type",
  "system",
  "shortTitle",
  "citationKey",
  "extra",
  "hasAttachment",
  "numNotes",
  "addedBy",
  "lastModifiedBy",
  "feed",
];

/**
 * Pick out the fields that have no column of their own, keeping their order.
 *
 * A field is covered if it has a built-in column, or if it is mapped to a base
 * field that has one: built-in columns read base-mapped values, so the
 * Publisher column already shows a thesis's University, for instance.
 */
export function selectAvailableFields(
  fields: readonly string[],
  builtIn: ReadonlySet<string>,
  mappedFields: (baseField: string) => readonly string[],
): string[] {
  const covered = new Set(builtIn);
  for (const column of builtIn) {
    for (const field of mappedFields(column)) {
      covered.add(field);
    }
  }
  return fields.filter((field) => !covered.has(field));
}

/**
 * Every field without a column of its own, labelled in the user's language
 * and sorted by label.
 */
export function collectAvailableFields(): FieldOption[] {
  try {
    const names = (Zotero.ItemFields.getAll() as { name: string }[]).map(
      (field) => field.name,
    );
    return selectAvailableFields(names, builtInColumnKeys(), typeFieldsOfBase)
      .map((name) => ({ name, label: fieldLabel(name) }))
      .sort((a, b) => Zotero.localeCompare(a.label, b.label));
  } catch (error) {
    ztoolkit.log("Could not list Zotero's item fields", error);
    return [];
  }
}

/** Whether the running Zotero knows a field by this name. */
export function isKnownField(name: string): boolean {
  try {
    return !!name && !!Zotero.ItemFields.getID(name);
  } catch {
    return false;
  }
}

/**
 * A field's label in the user's language, or its internal name if the
 * running Zotero does not know it (a field removed in a later version, say).
 */
export function fieldLabel(name: string): string {
  if (!isKnownField(name)) {
    return name;
  }
  try {
    return Zotero.ItemFields.getLocalizedString(name) || name;
  } catch {
    return name;
  }
}

/**
 * Whether Zotero stores a field as a multipart date (`YYYY-MM-DD as entered`).
 * Not every date-like field is one: Original Date, for example, is plain text.
 */
export function isMultipartDateField(name: string): boolean {
  try {
    return isKnownField(name) && !!Zotero.ItemFields.isDate(name);
  } catch {
    return false;
  }
}

/**
 * The column type to start a field column with. Zotero only marks some date
 * fields as dates, so a field whose name mentions a date is treated as one
 * too. The user can change the type afterwards.
 */
export function suggestedType(name: string): ColumnType {
  return isMultipartDateField(name) || /date/i.test(name) ? "date" : "text";
}

/**
 * The data keys of Zotero's built-in columns, read from the running Zotero.
 *
 * Zotero has no public API for this. The list is the `COLUMNS` export of its
 * `zotero/itemTreeColumns` module, which the main window's module loader can
 * provide. If that fails, the copy above is used.
 */
function builtInColumnKeys(): Set<string> {
  try {
    const win = Zotero.getMainWindow() as any;
    const columns: unknown = win?.require?.("zotero/itemTreeColumns")?.COLUMNS;
    if (Array.isArray(columns) && columns.length) {
      return new Set(
        columns
          .map((column) => column?.dataKey)
          .filter((key): key is string => typeof key === "string"),
      );
    }
  } catch (error) {
    ztoolkit.log("Could not read Zotero's built-in columns", error);
  }
  return new Set(BUILT_IN_COLUMNS_FALLBACK);
}

/** The type-specific fields mapped to a base field, e.g. publisher → label. */
function typeFieldsOfBase(name: string): string[] {
  try {
    if (!isKnownField(name) || !Zotero.ItemFields.isBaseField(name)) {
      return [];
    }
    return Zotero.ItemFields.getTypeFieldsFromBase(name, true) || [];
  } catch {
    return [];
  }
}
