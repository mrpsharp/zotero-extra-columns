/**
 * Detection of Extra keys that Zotero itself interprets.
 *
 * Zotero reads CSL variables, item fields and creator types out of Extra when
 * it builds citations. A column can still be configured for one of those keys,
 * but the user should know that the value is not inert. The matching rules
 * here mirror `Zotero.Utilities.Internal.extractExtraFields`.
 *
 * The pure helpers live here; `collectReservedKeys` reads the live Zotero
 * schema so that the list never drifts from whatever Zotero actually supports.
 */

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
 * Return the normalised form of `key` if Zotero would interpret it in Extra,
 * or null if the key is safe to use.
 */
export function findReservedConflict(
  key: string,
  reserved: ReadonlySet<string>,
): string | null {
  const normalised = normaliseReservedKey(key);
  return normalised && reserved.has(normalised) ? normalised : null;
}

/**
 * Build the set of keys Zotero interprets in Extra, from the running Zotero's
 * own schema. Falls back to an empty set if the schema is not available, in
 * which case no warnings are shown.
 */
export function collectReservedKeys(): Set<string> {
  const reserved = new Set<string>();
  const add = (key: string) => {
    const normalised = normaliseReservedKey(key);
    if (normalised) {
      reserved.add(normalised);
    }
  };

  try {
    // Zotero's schema tables are not covered by zotero-types.
    const schema = (Zotero as any).Schema;
    for (const mapping of [
      schema?.CSL_TEXT_MAPPINGS,
      schema?.CSL_DATE_MAPPINGS,
    ]) {
      for (const variable of Object.keys(mapping ?? {})) {
        add(variable);
      }
    }
    for (const type of Object.values<string>(schema?.CSL_NAME_MAPPINGS ?? {})) {
      add(type);
    }
    for (const field of Zotero.ItemFields.getAll()) {
      add(field.name);
    }
    for (const type of Zotero.CreatorTypes.getAll()) {
      add(type.name);
    }
  } catch (error) {
    ztoolkit.log("Could not read Zotero's reserved Extra keys", error);
  }

  return reserved;
}
