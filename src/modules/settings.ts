/**
 * The Zotero settings pane: a list of column definitions the user can add to,
 * edit and remove. Changes are saved as they are made and the item tree
 * columns are re-registered, so no restart is needed.
 */

import { COLUMN_TYPES, ColumnType } from "./extra";
import {
  ColumnDefinition,
  createDefinition,
  newDefinitionID,
} from "./definitions";
import { collectReservedKeys, findReservedConflict } from "./reserved";
import { getDefinitions, setDefinitions } from "./store";
import { refreshColumns } from "./columns";
import { getString } from "../utils/locale";

const HTML_NS = "http://www.w3.org/1999/xhtml";

let paneID: string | undefined;

/**
 * The definitions being edited. Rows without an Extra key are not stored, but
 * have to survive in memory while the user is still filling them in.
 */
let working: ColumnDefinition[] = [];

let reservedKeys: Set<string> = new Set();

export async function registerSettingsPane(): Promise<void> {
  paneID = await Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: `${rootURI}content/preferences.xhtml`,
    label: getString("prefs-title"),
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
  });
}

export function unregisterSettingsPane(): void {
  if (paneID) {
    Zotero.PreferencePanes.unregister(paneID);
    paneID = undefined;
  }
}

/** Called when the settings pane document is loaded. */
export function onSettingsLoad(win: Window): void {
  const doc = win.document;
  working = getDefinitions();
  reservedKeys = collectReservedKeys();

  doc.getElementById(elementID("add"))?.addEventListener("command", () => {
    working.push(createDefinition());
    renderRows(doc);
    focusLastRow(doc);
  });

  renderRows(doc);
}

function renderRows(doc: Document): void {
  const body = doc.getElementById(elementID("rows"));
  if (!body) {
    return;
  }
  body.replaceChildren(
    ...working.map((definition) => buildRow(doc, definition)),
  );

  const empty = doc.getElementById(elementID("empty")) as HTMLElement | null;
  if (empty) {
    empty.hidden = working.length > 0;
  }
  renderWarnings(doc);
}

function buildRow(doc: Document, definition: ColumnDefinition): Element {
  const row = create(doc, "tr");

  const label = textInput(
    doc,
    definition.label,
    getString("pref-placeholder-label"),
    (value) => {
      definition.label = value;
    },
  );
  const key = textInput(
    doc,
    definition.key,
    getString("pref-placeholder-key"),
    (value) => {
      definition.key = value;
    },
  );

  row.append(
    cell(doc, label),
    cell(doc, key),
    cell(
      doc,
      typeSelect(doc, definition, () => save(doc)),
    ),
    cell(
      doc,
      removeButton(doc, () => {
        working = working.filter((other) => other !== definition);
        renderRows(doc);
        save(doc);
      }),
    ),
  );
  return row;
}

function cell(doc: Document, child: Element): Element {
  const td = create(doc, "td");
  td.append(child);
  return td;
}

/**
 * A text field that keeps the in-memory definition and the warnings in step
 * with every keystroke, but only saves and re-registers columns once the field
 * is committed, on blur or Enter.
 */
function textInput(
  doc: Document,
  value: string,
  placeholder: string,
  apply: (value: string) => void,
): Element {
  const input = create(doc, "input") as HTMLInputElement;
  input.type = "text";
  input.value = value;
  input.placeholder = placeholder;
  input.addEventListener("input", () => {
    apply(input.value);
    renderWarnings(doc);
  });
  input.addEventListener("change", () => {
    apply(input.value);
    save(doc);
  });
  return input;
}

function typeSelect(
  doc: Document,
  definition: ColumnDefinition,
  onChange: () => void,
): Element {
  const select = create(doc, "select") as HTMLSelectElement;
  for (const type of COLUMN_TYPES) {
    const option = create(doc, "option") as HTMLOptionElement;
    option.value = type;
    option.textContent = typeLabel(type);
    option.selected = type === definition.type;
    select.append(option);
  }
  select.addEventListener("change", () => {
    definition.type = select.value as ColumnType;
    onChange();
  });
  return select;
}

function typeLabel(type: ColumnType): string {
  switch (type) {
    case "date":
      return getString("pref-type-date");
    case "number":
      return getString("pref-type-number");
    default:
      return getString("pref-type-text");
  }
}

function removeButton(doc: Document, onClick: () => void): Element {
  const button = create(doc, "button") as HTMLButtonElement;
  button.type = "button";
  button.textContent = getString("pref-remove");
  button.addEventListener("click", onClick);
  return button;
}

function focusLastRow(doc: Document): void {
  const rows = doc.getElementById(elementID("rows"))?.lastElementChild;
  rows?.querySelector("input")?.focus();
}

function save(doc: Document): void {
  // Give every row an identifier before storing, so that persisted column
  // widths and sort order survive a restart.
  for (const definition of working) {
    if (!definition.id) {
      definition.id = newDefinitionID();
    }
  }
  setDefinitions(working);
  renderWarnings(doc);
  refreshColumns().catch((error) =>
    ztoolkit.log("Could not refresh columns", error),
  );
}

/**
 * Warn about keys Zotero interprets in Extra itself, since a column on such a
 * key is showing a value that also feeds citations.
 */
function renderWarnings(doc: Document): void {
  const container = doc.getElementById(
    elementID("warnings"),
  ) as HTMLElement | null;
  if (!container) {
    return;
  }
  const conflicts = new Set<string>();
  for (const definition of working) {
    const conflict = findReservedConflict(definition.key, reservedKeys);
    if (conflict) {
      conflicts.add(conflict);
    }
  }
  container.replaceChildren(
    ...[...conflicts].map((key) => {
      const warning = create(doc, "p");
      warning.className = "extra-columns-warning";
      warning.textContent = getString("pref-warning-reserved", {
        args: { key },
      });
      return warning;
    }),
  );
  container.hidden = conflicts.size === 0;
}

function create(doc: Document, tag: string): HTMLElement {
  return doc.createElementNS(HTML_NS, tag) as HTMLElement;
}

function elementID(suffix: string): string {
  return `${addon.data.config.addonRef}-${suffix}`;
}
