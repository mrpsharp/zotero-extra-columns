/**
 * Runs inside Zotero (`npm run test:zotero`), in the scaffold's throwaway
 * profile. The column definitions come from `test.prefs` in
 * zotero-plugin.config.ts.
 */

import { assert } from "chai";
import { config } from "../package.json";
import { collectAvailableFields } from "../src/modules/fields";

const PREF = `${config.prefsPrefix}.columns`;
const SEPARATOR = "\u001F";

function dataKeyFor(id: string): string {
  const column = (Zotero.ItemTreeManager as any)
    .getCustomColumns()
    .find(
      (column: { pluginID: string; dataKey: string }) =>
        column.pluginID === config.addonID &&
        column.dataKey.endsWith(`col-${id}`),
    );
  assert.exists(column, `column ${id} is registered`);
  return column.dataKey;
}

function cellData(item: Zotero.Item, id: string): string {
  return (Zotero.ItemTreeManager as any).getCustomCellData(
    item,
    dataKeyFor(id),
  );
}

function shown(item: Zotero.Item, id: string): string {
  const data = cellData(item, id);
  const separator = data.indexOf(SEPARATOR);
  return separator === -1 ? data : data.slice(separator + 1);
}

async function createItem(
  type: string,
  fields: Record<string, string> = {},
): Promise<Zotero.Item> {
  const item = new Zotero.Item(type as any);
  item.libraryID = Zotero.Libraries.userLibraryID;
  for (const [field, value] of Object.entries(fields)) {
    item.setField(field as any, value);
  }
  await item.saveTx();
  return item;
}

/** Record anything Zotero warns or logs as an error while `run` runs. */
function captureWarnings(run: () => void): string[] {
  const warnings: string[] = [];
  const zotero = Zotero as any;
  const original = {
    debug: zotero.debug,
    warn: zotero.warn,
    logError: zotero.logError,
  };
  zotero.debug = (message: unknown, level?: number, ...rest: unknown[]) => {
    if (level !== undefined && level <= 2) {
      warnings.push(String(message));
    }
    return original.debug.call(zotero, message, level, ...rest);
  };
  zotero.warn = (message: unknown) => warnings.push(String(message));
  zotero.logError = (message: unknown) => warnings.push(String(message));
  try {
    run();
  } finally {
    Object.assign(zotero, original);
  }
  return warnings;
}

describe("Field columns", function () {
  let book: Zotero.Item;
  let article: Zotero.Item;
  let articleWithExtra: Zotero.Item;
  let bookWithExtra: Zotero.Item;
  let patent: Zotero.Item;
  let note: Zotero.Item;

  before(async function () {
    book = await createItem("book", {
      title: "A book with an Original Date",
      originalDate: "March 1850",
      extra: "finished: 2026-08-14",
    });
    article = await createItem("journalArticle", {
      title: "An article",
      DOI: "10.1000/xyz123",
    });
    articleWithExtra = await createItem("journalArticle", {
      title: "An article with original-date in Extra",
      extra: "original-date: 1860\ngone: still here",
    });
    bookWithExtra = await createItem("book", {
      title: "A book with original-date in Extra",
      extra: "original-date: 1855",
    });
    patent = await createItem("patent", {
      title: "A patent",
      priorityDate: "2001-05-06",
    });
    note = new Zotero.Item("note");
    note.libraryID = Zotero.Libraries.userLibraryID;
    note.setNote("<p>A note</p>");
    await note.saveTx();
  });

  describe("stored settings", function () {
    it("migrates definitions stored without a source, keeping their ids", function () {
      const stored = JSON.parse(Zotero.Prefs.get(PREF, true) as string);
      assert.isTrue(
        stored.every((entry: { source?: string }) => !!entry.source),
      );
      assert.deepInclude(stored, {
        id: "finished",
        label: "Finished",
        source: "extra",
        key: "finished",
        type: "date",
      });
    });

    it("registers every column under a data key built from its id", function () {
      for (const id of ["finished", "origdate", "origonly", "doi", "gone"]) {
        assert.match(dataKeyFor(id), new RegExp(`col-${id}$`));
      }
    });

    it("labels a field column with Zotero's label for the field", function () {
      const column = (Zotero.ItemTreeManager as any)
        .getCustomColumns()
        .find((column: { dataKey: string }) =>
          column.dataKey.endsWith("col-origdate"),
        );
      assert.equal(
        column.label,
        Zotero.ItemFields.getLocalizedString("originalDate"),
      );
    });
  });

  describe("available fields", function () {
    it("reads the built-in columns from Zotero itself", function () {
      const columns = (Zotero.getMainWindow() as any).require(
        "zotero/itemTreeColumns",
      ).COLUMNS;
      assert.isArray(columns);
      assert.includeMembers(
        columns.map((column: { dataKey: string }) => column.dataKey),
        ["title", "publisher", "extra"],
      );
    });

    it("offers fields without a column of their own, by label", function () {
      const fields = collectAvailableFields();
      const names = fields.map(({ name }) => name);
      assert.includeMembers(names, [
        "originalDate",
        "originalPlace",
        "originalPublisher",
        "DOI",
        "url",
      ]);
      assert.deepInclude(fields, {
        name: "originalDate",
        label: Zotero.ItemFields.getLocalizedString("originalDate"),
      });
      const labels = fields.map(({ label }) => label);
      assert.deepEqual(labels, [...labels].sort(Zotero.localeCompare));
    });

    it("leaves out fields Zotero already has columns for", function () {
      const names = collectAvailableFields().map(({ name }) => name);
      for (const name of ["title", "publisher", "extra", "date", "place"]) {
        assert.notInclude(names, name);
      }
      // Shown in the Publisher and Medium columns through their base fields.
      for (const name of ["university", "label", "format"]) {
        assert.notInclude(names, name);
      }
    });
  });

  describe("cell values", function () {
    it("shows a field as entered", function () {
      assert.equal(shown(book, "origdate"), "March 1850");
      assert.equal(shown(article, "doi"), "10.1000/xyz123");
    });

    it("is empty where the field does not apply and there is no fallback", function () {
      assert.equal(cellData(article, "origdate"), "");
      assert.equal(cellData(articleWithExtra, "origonly"), "");
      assert.equal(cellData(book, "doi"), "");
    });

    it("falls back to the Extra key", function () {
      assert.equal(shown(articleWithExtra, "origdate"), "1860");
      assert.equal(shown(bookWithExtra, "origdate"), "1855");
    });

    it("prefers the field to the fallback", function () {
      assert.equal(shown(book, "origdate"), "March 1850");
    });

    it("follows base-field mappings", function () {
      assert.equal(shown(patent, "origdate"), "2001-05-06");
    });

    it("tolerates a field this Zotero does not know", function () {
      assert.equal(shown(articleWithExtra, "gone"), "still here");
      assert.equal(cellData(book, "gone"), "");
    });

    it("leaves Extra columns as they were", function () {
      assert.equal(shown(book, "finished"), "2026-08-14");
      assert.equal(cellData(article, "finished"), "");
    });

    it("never throws or logs, whatever the item", function () {
      const items = [book, article, articleWithExtra, bookWithExtra, patent];
      const warnings = captureWarnings(() => {
        for (const item of [...items, note]) {
          for (const id of [
            "finished",
            "origdate",
            "origonly",
            "doi",
            "gone",
          ]) {
            cellData(item, id);
          }
        }
      });
      assert.deepEqual(warnings, []);
    });
  });

  describe("sorting", function () {
    /** Poll until `check` passes, or fail after `timeout` ms. */
    async function waitFor(check: () => boolean, timeout = 3000) {
      const start = Date.now();
      while (!check()) {
        if (Date.now() - start > timeout) {
          return false;
        }
        await Zotero.Promise.delay(50);
      }
      return true;
    }

    it("re-sorts the list when the column it is sorted by is registered", async function () {
      const pane = (Zotero.getMainWindow() as any).ZoteroPane;
      await pane.collectionsView.selectLibrary(Zotero.Libraries.userLibraryID);
      const view = pane.itemsView;
      await view.waitForLoad();

      // Titles in one order, Original Dates in another.
      const [aardvark, badger, coypu] = await Promise.all(
        [
          ["Aardvark", "1900"],
          ["Badger", "1800"],
          ["Coypu", "1850"],
        ].map(([title, originalDate]) =>
          createItem("book", { title, originalDate }),
        ),
      );
      const byDate = [badger, coypu, aardvark];
      const byTitle = [aardvark, badger, coypu];
      /** Whether the items are listed in this order (or its reverse). */
      const listed = (items: Zotero.Item[], direction: number) => {
        const rows = items.map((item) => view.getRowIndexByID(item.id));
        if (rows.some((row) => row === undefined || row < 0)) {
          return false;
        }
        return rows.every(
          (row, i) => i === 0 || (row - rows[i - 1]) * direction > 0,
        );
      };

      // Sort by the column, as the user had before restarting.
      const dataKey = dataKeyFor("origonly");
      const index = view
        ._getColumns()
        .findIndex((column: { dataKey: string }) => column.dataKey === dataKey);
      view.toggleSort(index);
      const direction = view.getSortDirection();
      assert.isTrue(
        await waitFor(() => listed(byDate, direction)),
        "sorted by date",
      );

      // The state startup leaves behind: the list was loaded and sorted by
      // title before the plugin's columns existed, but the saved sort column
      // is ours.
      const sortedColumn = view._sortedColumn;
      view._sortedColumn = view
        ._getColumns()
        .find((column: { dataKey: string }) => column.dataKey === "title");
      await view.sort();
      view._sortedColumn = sortedColumn;
      assert.equal(view.getSortField(), dataKey);
      assert.isTrue(await waitFor(() => listed(byTitle, 1)), "listed by title");

      // Registering a column sends this notification; the list should then
      // be sorted by our column again.
      (Zotero.ItemTreeManager as any).refreshColumns();
      assert.isTrue(
        await waitFor(() => listed(byDate, direction)),
        "sorted by date again after the columns are refreshed",
      );
    });

    it("sorts a date column by date, using Zotero's own collation", async function () {
      const values = [
        "1850",
        "12 March 1850",
        "n.d.",
        "March 1850",
        "1849",
        "1 March 1850",
      ];
      const items = await Promise.all(
        values.map((originalDate) =>
          createItem("book", { title: originalDate, originalDate }),
        ),
      );
      const collation = Zotero.getLocaleCollation() as any;
      const sorted = items
        .map((item) => cellData(item, "origdate"))
        .sort((a, b) => collation.compareString(1, a, b))
        .map((data) => data.slice(data.indexOf(SEPARATOR) + 1));
      assert.deepEqual(sorted, [
        "1849",
        "1850",
        "March 1850",
        "1 March 1850",
        "12 March 1850",
        "n.d.",
      ]);
    });
  });
});
