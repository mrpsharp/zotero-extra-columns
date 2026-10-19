/**
 * The Zotero settings pane: a list of column definitions the user can add to,
 * edit and remove. Each column shows either an Extra key or one of Zotero's
 * own fields. Changes are saved as they are made and the item tree columns are
 * re-registered, so no restart is needed.
 */

import { COLUMN_TYPES, ColumnType } from "./extra";
import {
  ColumnDefinition,
  createDefinition,
  newDefinitionID,
} from "./definitions";
import {
  FieldOption,
  collectAvailableFields,
  fieldLabel,
  suggestedType,
} from "./fields";
import {
  ReservedKeys,
  ReservedKind,
  collectReservedKeys,
  findReservedConflict,
} from "./reserved";
import { getDefinitions, setDefinitions } from "./store";
import { refreshColumns } from "./columns";
import { getString } from "../utils/locale";

const HTML_NS = "http://www.w3.org/1999/xhtml";

/** The source picker's value for an Extra column; field names are never empty. */
const EXTRA_SOURCE = "";

let paneID: string | undefined;

/**
 * The definitions being edited. Rows without an Extra key are not stored, but
 * have to survive in memory while the user is still filling them in.
 */
let working: ColumnDefinition[] = [];

let reservedKeys: ReservedKeys = { csl: new Set(), field: new Set() };

/** Zotero's fields that have no column of their own, sorted by label. */
let availableFields: FieldOption[] = [];

export async function registerSettingsPane(): Promise<void> {
  paneID = await Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: `${rootURI}content/preferences.xhtml`,
    label: getString("prefs-title"),
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
    stylesheets: [`${rootURI}content/preferences.css`],
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
  availableFields = collectAvailableFields();

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
  const isField = definition.source === "field";

  // An empty header falls back to the field's label, so show that.
  const label = textInput(
    doc,
    definition.label,
    isField
      ? fieldLabel(definition.field)
      : getString("pref-placeholder-label"),
    (value) => {
      definition.label = value;
    },
  );
  // An Extra column needs its key; a field column may name a fallback key.
  const key = isField
    ? textInput(
        doc,
        definition.fallbackKey,
        getString("pref-placeholder-fallback"),
        (value) => {
          definition.fallbackKey = value;
        },
      )
    : textInput(
        doc,
        definition.key,
        getString("pref-placeholder-key"),
        (value) => {
          definition.key = value;
        },
      );

  const source = sourceSelect(doc, definition, () => {
    // The key box and type change with the source, so rebuild the row.
    const replacement = buildRow(doc, definition);
    row.replaceWith(replacement);
    replacement.querySelector("select")?.focus();
    save(doc);
  });

  row.append(
    cell(doc, label),
    cell(doc, source),
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

/**
 * Choose between an Extra key and one of Zotero's fields, listed by their
 * labels. Choosing a field sets the type to suit it.
 */
function sourceSelect(
  doc: Document,
  definition: ColumnDefinition,
  onChange: () => void,
): Element {
  const select = create(doc, "select") as HTMLSelectElement;
  select.append(
    option(
      doc,
      EXTRA_SOURCE,
      getString("pref-source-extra"),
      definition.source === "extra",
    ),
  );

  // A field configured earlier may no longer be on offer, if Zotero has since
  // given it a column of its own; keep it selectable so the row still reads
  // correctly.
  const fields = [...availableFields];
  if (
    definition.source === "field" &&
    !fields.some(({ name }) => name === definition.field)
  ) {
    fields.push({
      name: definition.field,
      label: fieldLabel(definition.field),
    });
  }
  const group = create(doc, "optgroup") as HTMLOptGroupElement;
  group.label = getString("pref-source-fields");
  group.append(
    ...fields.map(({ name, label }) =>
      option(
        doc,
        name,
        label,
        definition.source === "field" && name === definition.field,
      ),
    ),
  );
  select.append(group);

  select.addEventListener("change", () => {
    if (select.value === EXTRA_SOURCE) {
      definition.source = "extra";
    } else {
      definition.source = "field";
      definition.field = select.value;
      definition.type = suggestedType(select.value);
    }
    onChange();
  });
  return select;
}

function option(
  doc: Document,
  value: string,
  label: string,
  selected: boolean,
): Element {
  const element = create(doc, "option") as HTMLOptionElement;
  element.value = value;
  element.textContent = label;
  element.selected = selected;
  return element;
}

function typeSelect(
  doc: Document,
  definition: ColumnDefinition,
  onChange: () => void,
): Element {
  const select = create(doc, "select") as HTMLSelectElement;
  for (const type of COLUMN_TYPES) {
    select.append(option(doc, type, typeLabel(type), type === definition.type));
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
 * Warn about keys Zotero interprets in Extra itself. The two risks are
 * different, so they get different wording: a CSL variable reaches the
 * citation processor, whereas one of Zotero's own field names can be taken out
 * of Extra and stored as that field.
 *
 * A field column's fallback key is not checked: it is usually Zotero's own
 * key for that field (`original-date`, say), chosen precisely because Zotero
 * uses it.
 */
function renderWarnings(doc: Document): void {
  const container = doc.getElementById(
    elementID("warnings"),
  ) as HTMLElement | null;
  if (!container) {
    return;
  }

  const conflicts = new Map<string, ReservedKind>();
  for (const definition of working) {
    if (definition.source !== "extra") {
      continue;
    }
    const conflict = findReservedConflict(definition.key, reservedKeys);
    if (conflict) {
      conflicts.set(conflict.key, conflict.kind);
    }
  }

  // Citation warnings first: they are the ones with consequences outside
  // Zotero.
  const ordered = [...conflicts].sort(
    ([, a], [, b]) => Number(a !== "csl") - Number(b !== "csl"),
  );

  container.replaceChildren(
    ...ordered.map(([key, kind]) => {
      const warning = create(doc, "p");
      warning.className = `extra-columns-warning extra-columns-warning-${kind}`;
      warning.textContent = getString(
        kind === "csl" ? "pref-warning-csl" : "pref-warning-field",
        { args: { key } },
      );
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
