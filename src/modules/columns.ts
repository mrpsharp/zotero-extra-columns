/**
 * Registration of the configured columns with Zotero's item tree.
 *
 * Only `Zotero.ItemTreeManager` is used, so the columns behave like any other:
 * they appear in the column picker, and the user chooses which to show.
 */

import { ColumnDefinition, definitionLabel } from "./definitions";
import {
  buildCellValue,
  buildDateCell,
  cellDisplayValue,
  getExtraValue,
} from "./extra";
import { fieldLabel, isKnownField, isMultipartDateField } from "./fields";
import { getDefinitions } from "./store";

interface RegisteredColumn {
  /** The data key Zotero returned, which is what unregistering expects. */
  dataKey: string;
  /** The definition as registered, to tell an edit from an unchanged row. */
  signature: string;
}

const registered = new Map<string, RegisteredColumn>();

/**
 * Bring the registered columns into line with the stored definitions. Called
 * at startup and whenever the settings change, so that edits take effect
 * without restarting Zotero.
 *
 * Registering and unregistering each prompt a full item tree refresh, so only
 * definitions that have actually changed are touched.
 */
export async function refreshColumns(): Promise<void> {
  const definitions = getDefinitions();
  const wanted = new Map(
    definitions.map((definition) => [definition.id, definition]),
  );

  for (const [id, column] of [...registered]) {
    const definition = wanted.get(id);
    if (definition && signatureOf(definition) === column.signature) {
      continue;
    }
    await unregisterColumn(id);
  }

  for (const definition of definitions) {
    if (!registered.has(definition.id)) {
      await registerColumn(definition);
    }
  }
}

/** Remove every column this plugin has registered. */
export async function unregisterColumns(): Promise<void> {
  for (const id of [...registered.keys()]) {
    await unregisterColumn(id);
  }
}

async function registerColumn(definition: ColumnDefinition): Promise<void> {
  try {
    const dataKey = await register({
      dataKey: `col-${definition.id}`,
      label: definitionLabel(definition, fieldLabel),
      pluginID: addon.data.config.addonID,
      dataProvider: cellProvider(definition),
      renderCell: (
        _index: number,
        data: string,
        column: { className: string },
        _isFirstColumn: boolean,
        doc: Document,
      ) => {
        const cell = doc.createElement("span");
        cell.className = `cell ${column.className}`;
        cell.textContent = cellDisplayValue(data);
        return cell;
      },
      zoteroPersist: ["width", "hidden", "sortDirection"],
    });
    if (typeof dataKey === "string") {
      registered.set(definition.id, {
        dataKey,
        signature: signatureOf(definition),
      });
    }
  } catch (error) {
    ztoolkit.log("Could not register column", definition, error);
  }
}

async function unregisterColumn(id: string): Promise<void> {
  const column = registered.get(id);
  registered.delete(id);
  if (!column) {
    return;
  }
  try {
    await unregister(column.dataKey);
  } catch (error) {
    ztoolkit.log("Could not unregister column", column.dataKey, error);
  }
}

/** Everything about a definition that affects how its column is registered. */
function signatureOf(definition: ColumnDefinition): string {
  return JSON.stringify([
    definitionLabel(definition, fieldLabel),
    definition.source,
    definition.key,
    definition.field,
    definition.fallbackKey,
    definition.type,
  ]);
}

/** Build the function that gives the item tree a cell's value for an item. */
function cellProvider(
  definition: ColumnDefinition,
): (item: Zotero.Item) => string {
  const { key, type } = definition;
  return definition.source === "field"
    ? fieldCellProvider(definition)
    : (item) => buildCellValue(getExtraValue(readExtra(item), key), type);
}

/**
 * A field column shows the field as entered, or else the fallback Extra key.
 * Date columns sort on the date Zotero's own parser reads from that text.
 */
function fieldCellProvider(
  definition: ColumnDefinition,
): (item: Zotero.Item) => string {
  const { field, fallbackKey, type } = definition;
  // Checked once, so that a field this Zotero does not know (one removed in a
  // later version, say) never reaches getField, which would log about it.
  const known = isKnownField(field);
  const multipart = isMultipartDateField(field);

  return (item) => {
    let display = known ? readField(item, field) : "";
    let sql = "";
    if (display && multipart && Zotero.Date.isMultipart(display)) {
      sql = Zotero.Date.multipartToSQL(display);
      display = Zotero.Date.multipartToStr(display);
    }
    if (!display.trim() && fallbackKey) {
      display = getExtraValue(readExtra(item), fallbackKey);
      sql = "";
    }
    if (type !== "date") {
      return buildCellValue(display, type);
    }
    if (display.trim() && !sql) {
      sql = parseDate(display);
    }
    return buildDateCell(display, sql);
  };
}

/**
 * Read a date as entered with Zotero's own parser, returning the SQL date
 * (`YYYY-MM-DD`, with `00` for unknown parts) or "" if it cannot be read.
 */
function parseDate(text: string): string {
  try {
    return Zotero.Date.multipartToSQL(Zotero.Date.strToMultipart(text.trim()));
  } catch {
    return "";
  }
}

/**
 * Read a field, following base-field mappings as Zotero's own columns do (so
 * Original Date shows a patent's Priority Date). Unformatted, so that a
 * multipart date keeps its SQL part for sorting. A field that does not apply
 * to the item's type reads as empty.
 */
function readField(item: Zotero.Item, field: string): string {
  try {
    return String(item.getField(field as any, true, true) ?? "");
  } catch {
    return "";
  }
}

/** Read an item's Extra field, tolerating item types that have none. */
function readExtra(item: Zotero.Item): string {
  try {
    return item.getField("extra") || "";
  } catch {
    return "";
  }
}

/**
 * `registerColumn`/`unregisterColumn` replaced the older plural forms during
 * the Zotero 7 series; fall back to those so the plugin still works on the
 * oldest version it claims to support.
 */
function register(options: object): Promise<string | false> {
  const manager = Zotero.ItemTreeManager as any;
  return manager.registerColumn
    ? Promise.resolve(manager.registerColumn(options))
    : manager.registerColumns(options);
}

function unregister(dataKey: string): Promise<boolean> {
  const manager = Zotero.ItemTreeManager as any;
  return manager.unregisterColumn
    ? Promise.resolve(manager.unregisterColumn(dataKey))
    : manager.unregisterColumns(dataKey);
}
