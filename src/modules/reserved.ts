/**
 * Detection of Extra keys that Zotero itself interprets.
 *
 * There are two different risks, so they are reported separately:
 *
 * - CSL variables are handed to the citation processor by
 *   `Zotero.Utilities.Item.extraToCSL`, whatever the item type, so the value
 *   can appear in citations and bibliographies.
 * - Zotero's own field and creator names are matched by
 *   `Zotero.Utilities.Internal.extractExtraFields`, which can take the value
 *   out of Extra and store it as that field instead.
 *
 * A key can be both, as `status` is; the citation risk is reported then.
 *
 * The pure helpers live here; `collectReservedKeys` reads the live Zotero
 * schema so that the lists never drift from whatever Zotero actually supports.
 */

/** Which of Zotero's own vocabularies a key collides with. */
export type ReservedKind = "csl" | "field";

export interface ReservedKeys {
  /** CSL variable names, which reach the citation processor. */
  csl: Set<string>;
  /** Zotero field and creator names, which can be lifted out of Extra. */
  field: Set<string>;
}

export interface ReservedConflict {
  /** The normalised key, as Zotero would match it. */
  key: string;
  kind: ReservedKind;
}

/**
 * Normalise a key the way Zotero does before matching it against its own
 * vocabulary: `originalDate`, `Original Date` and `original_date` all become
 * `original-date`.
 */
export function normaliseReservedKey(key: string): string {
  return key
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[\s\-_]+/g, "-");
}

/**
 * Report how Zotero would interpret `key` in Extra, or null if the key is safe
 * to use. Where a key is both a CSL variable and a Zotero field, the citation
 * risk is the one worth reporting.
 */
export function findReservedConflict(
  key: string,
  reserved: ReservedKeys,
): ReservedConflict | null {
  const normalised = normaliseReservedKey(key);
  if (!normalised) {
    return null;
  }
  if (reserved.csl.has(normalised)) {
    return { key: normalised, kind: "csl" };
  }
  if (reserved.field.has(normalised)) {
    return { key: normalised, kind: "field" };
  }
  return null;
}

/**
 * Build the sets of keys Zotero interprets in Extra, from the running Zotero's
 * own schema. Falls back to empty sets if the schema is not available, in
 * which case no warnings are shown.
 */
export function collectReservedKeys(): ReservedKeys {
  const reserved: ReservedKeys = { csl: new Set(), field: new Set() };
  const add = (into: Set<string>, key: string) => {
    const normalised = normaliseReservedKey(key);
    if (normalised) {
      into.add(normalised);
    }
  };

  try {
    // Zotero's schema tables are not covered by zotero-types.
    const schema = (Zotero as any).Schema;
    // Text and date variables are keyed by CSL name; name variables are the
    // values, keyed by Zotero's creator type.
    for (const mapping of [
      schema?.CSL_TEXT_MAPPINGS,
      schema?.CSL_DATE_MAPPINGS,
    ]) {
      for (const variable of Object.keys(mapping ?? {})) {
        add(reserved.csl, variable);
      }
    }
    for (const variable of Object.values<string>(
      schema?.CSL_NAME_MAPPINGS ?? {},
    )) {
      add(reserved.csl, variable);
    }
    for (const field of Zotero.ItemFields.getAll()) {
      add(reserved.field, field.name);
    }
    for (const type of Zotero.CreatorTypes.getAll()) {
      add(reserved.field, type.name);
    }
  } catch (error) {
    ztoolkit.log("Could not read Zotero's reserved Extra keys", error);
  }

  return reserved;
}
