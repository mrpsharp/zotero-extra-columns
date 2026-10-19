/**
 * Parsing of Zotero's Extra field, and the sort keys used to make the
 * resulting values sort sensibly in the item tree.
 *
 * Everything in this module is pure: no Zotero globals are touched, so it can
 * be unit tested in plain Node.
 */

export type ColumnType = "text" | "date" | "number";

export const COLUMN_TYPES: readonly ColumnType[] = ["text", "date", "number"];

/**
 * Separator between a cell's sort key and its display value.
 *
 * Zotero has no compare hook for plugin columns: it sorts on whatever string
 * the column's `dataProvider` returns. For dates and numbers that string has
 * to be a sort key rather than the value itself, so we return both, separated
 * by an ASCII unit separator, and pull the display value back out in
 * `renderCell`. Text columns need no key and are returned unencoded.
 */
export const SORT_SEPARATOR = "\u001F";

/*
 * Zotero compares those strings with its locale collation, which by default
 * (the `naturalSorting` preference) compares runs of digits by their numeric
 * value, and which ignores control characters such as the separator. Sort
 * keys are built to survive that:
 *
 * - The ranks are letters, not digits, so that a rank is never read as part
 *   of a number.
 * - Every key's digits have a fixed width, so numeric and character order
 *   agree.
 * - Every key ends in punctuation the collation does not ignore, so that a
 *   display value starting with digits cannot run on into the key's digits.
 */

/** Sort rank for values that could be interpreted as the column's type. */
const RANK_SORTABLE = "a";

/** Sort rank for values that could not, so that they sort after the rest. */
const RANK_UNSORTABLE = "b";

/** Closes a sort key; see above. */
const KEY_END = "|";

/** Widest integer part we can pad to without losing double precision. */
const NUMBER_LIMIT = 1e9;
const NUMBER_INTEGER_DIGITS = 10;
const NUMBER_FRACTION_DIGITS = 6;

const ISO_DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:[T ].*)?)?)?$/;

const SQL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const NUMERIC = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Normalise an Extra key for matching: case-insensitive, insensitive to
 * surrounding whitespace, and tolerant of repeated whitespace within a key.
 */
export function normaliseKey(key: string): string {
  return key.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Parse an Extra field into its `key: value` pairs.
 *
 * Lines that are not `key: value` are ignored, as are keys with an empty
 * value. Where a key appears more than once the first occurrence wins.
 */
export function parseExtra(extra: string): Map<string, string> {
  const fields = new Map<string, string>();
  if (!extra) {
    return fields;
  }
  for (const line of extra.split(/\r\n|\r|\n/)) {
    const separator = line.indexOf(":");
    if (separator <= 0) {
      continue;
    }
    const key = normaliseKey(line.slice(0, separator));
    const value = line.slice(separator + 1).trim();
    if (!key || !value || fields.has(key)) {
      continue;
    }
    fields.set(key, value);
  }
  return fields;
}

/** Look up a single key in an Extra field, returning "" if it is absent. */
export function getExtraValue(extra: string, key: string): string {
  return parseExtra(extra).get(normaliseKey(key)) ?? "";
}

/**
 * Sort key for a date value.
 *
 * ISO dates and partial ISO dates (`YYYY-MM-DD`, `YYYY-MM`, `YYYY`) become a
 * zero-padded `YYYYMMDD` string, so they compare chronologically and a partial
 * date sorts before any more precise date within it. Anything else keeps its
 * own text but is ranked after every date.
 */
export function dateSortKey(value: string): string {
  const match = ISO_DATE.exec(value.trim());
  if (!match) {
    return RANK_UNSORTABLE + value.trim().toLowerCase() + KEY_END;
  }
  const [, year, month = "00", day = "00"] = match;
  if (Number(month) > 12 || Number(day) > 31) {
    return RANK_UNSORTABLE + value.trim().toLowerCase() + KEY_END;
  }
  return RANK_SORTABLE + year + month + day + KEY_END;
}

/**
 * Sort key for a date Zotero has already parsed, given as the SQL date
 * (`YYYY-MM-DD`, with `00` for unknown parts) that `Zotero.Date.multipartToSQL`
 * returns. A partial date sorts before any more precise date within it, as
 * with `dateSortKey`. A date with no year (`0000-00-00`, which is what Zotero
 * returns for text it cannot read) keeps the displayed text but is ranked
 * after every date.
 */
export function sqlDateSortKey(sql: string, display: string): string {
  const match = SQL_DATE.exec(sql);
  if (!match || match[1] === "0000") {
    return RANK_UNSORTABLE + display.trim().toLowerCase() + KEY_END;
  }
  return RANK_SORTABLE + match[1] + match[2] + match[3] + KEY_END;
}

/**
 * Build a date cell from the text to display and the SQL date to sort it by.
 * Used for field columns, whose dates are read with Zotero's own parser.
 */
export function buildDateCell(display: string, sql: string): string {
  const shown = display.trim();
  return shown ? sqlDateSortKey(sql, shown) + SORT_SEPARATOR + shown : "";
}

/**
 * Sort key for a numeric value.
 *
 * The number is shifted into a positive range and written as a fixed-width
 * decimal string so that a plain string comparison matches numeric order.
 * Values that are not numbers, or that fall outside the supported range, keep
 * their own text but are ranked after every number.
 */
export function numberSortKey(value: string): string {
  const trimmed = value.trim();
  const parsed = NUMERIC.test(trimmed) ? Number(trimmed) : Number.NaN;
  if (!Number.isFinite(parsed) || Math.abs(parsed) >= NUMBER_LIMIT) {
    return RANK_UNSORTABLE + trimmed.toLowerCase() + KEY_END;
  }
  const [integer, fraction] = (parsed + NUMBER_LIMIT)
    .toFixed(NUMBER_FRACTION_DIGITS)
    .split(".");
  return (
    RANK_SORTABLE +
    integer.padStart(NUMBER_INTEGER_DIGITS, "0") +
    fraction +
    KEY_END
  );
}

/**
 * Build the string a column's `dataProvider` should return for a given raw
 * Extra value: the display value for text columns, and a sort key plus the
 * display value for date and number columns.
 */
export function buildCellValue(raw: string, type: ColumnType): string {
  const display = raw.trim();
  if (!display) {
    return "";
  }
  switch (type) {
    case "date":
      return dateSortKey(display) + SORT_SEPARATOR + display;
    case "number":
      return numberSortKey(display) + SORT_SEPARATOR + display;
    // Zotero compares plugin columns with a case-insensitive collation, so
    // text needs no key of its own.
    default:
      return display;
  }
}

/** Recover the display value from whatever `buildCellValue` produced. */
export function cellDisplayValue(data: string): string {
  const separator = data.indexOf(SORT_SEPARATOR);
  return separator === -1 ? data : data.slice(separator + 1);
}
