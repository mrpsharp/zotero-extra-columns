/**
 * Registration of the configured columns with Zotero's item tree.
 *
 * Only `Zotero.ItemTreeManager` is used, so the columns behave like any other:
 * they appear in the column picker, and the user chooses which to show.
 */

import { ColumnDefinition, definitionLabel } from "./definitions";
import { buildCellValue, cellDisplayValue, getExtraValue } from "./extra";
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
  const { key, type } = definition;
  try {
    const dataKey = await register({
      dataKey: `col-${definition.id}`,
      label: definitionLabel(definition),
      pluginID: addon.data.config.addonID,
      dataProvider: (item: Zotero.Item) =>
        buildCellValue(getExtraValue(readExtra(item), key), type),
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
    definitionLabel(definition),
    definition.key,
    definition.type,
  ]);
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
