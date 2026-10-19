import { assert } from "chai";
import {
  buildCellValue,
  buildDateCell,
  cellDisplayValue,
  dateSortKey,
  getExtraValue,
  normaliseKey,
  numberSortKey,
  parseExtra,
  sqlDateSortKey,
} from "../../src/modules/extra";

/**
 * Zotero's item tree collation (`Zotero.Intl`): case-insensitive, and by
 * default comparing runs of digits by value (the `naturalSorting`
 * preference). Like Zotero's, it ignores control characters.
 */
const naturalCollator = new Intl.Collator(["en-GB"], {
  numeric: true,
  sensitivity: "base",
});
const plainCollator = new Intl.Collator(["en-GB"], {
  numeric: false,
  sensitivity: "base",
});

describe("Extra field parsing and sorting", function () {
  /** Order a set of raw values the way Zotero's collation would order the keys. */
  function sortByKey(
    values: string[],
    key: (value: string) => string,
    collator = naturalCollator,
  ): string[] {
    return [...values].sort((a, b) => collator.compare(key(a), key(b)));
  }

  /** Order cells the way the item tree would, and return what they show. */
  function sortCells(cells: string[], collator = naturalCollator): string[] {
    return [...cells]
      .sort((a, b) => collator.compare(a, b))
      .map(cellDisplayValue);
  }

  describe("parseExtra", function () {
    it("reads key: value lines", function () {
      const fields = parseExtra("finished: 2026-08-14\nrating: 4");
      assert.equal(fields.get("finished"), "2026-08-14");
      assert.equal(fields.get("rating"), "4");
    });

    it("matches keys without regard to case or surrounding whitespace", function () {
      assert.equal(
        getExtraValue("  Finished :  2026-08-14  ", "finished"),
        "2026-08-14",
      );
      assert.equal(
        getExtraValue("finished: 2026-08-14", "  FINISHED "),
        "2026-08-14",
      );
    });

    it("allows spaces inside keys", function () {
      assert.equal(
        getExtraValue("date finished: 2026-08-14", "Date Finished"),
        "2026-08-14",
      );
    });

    it("collapses repeated whitespace inside keys", function () {
      assert.equal(
        getExtraValue("date  finished: yes", "date finished"),
        "yes",
      );
    });

    it("keeps the first occurrence of a repeated key", function () {
      assert.equal(getExtraValue("rating: 4\nrating: 2", "rating"), "4");
    });

    it("keeps colons inside values", function () {
      assert.equal(
        getExtraValue("source: https://example.com/a", "source"),
        "https://example.com/a",
      );
    });

    it("ignores lines that are not key: value", function () {
      const fields = parseExtra(
        "just a note\n\n: no key\nfinished: 2026-08-14",
      );
      assert.deepEqual([...fields.keys()], ["finished"]);
    });

    it("ignores keys with an empty value", function () {
      assert.equal(
        getExtraValue("finished:\nfinished: 2026-08-14", "finished"),
        "2026-08-14",
      );
    });

    it("handles Windows line endings", function () {
      assert.equal(
        getExtraValue("a: 1\r\nfinished: 2026-08-14", "finished"),
        "2026-08-14",
      );
    });

    it("returns an empty value for a key that is absent", function () {
      assert.equal(getExtraValue("finished: 2026-08-14", "started"), "");
      assert.equal(getExtraValue("", "finished"), "");
    });

    it("normalises keys consistently", function () {
      assert.equal(normaliseKey("  Date   Finished  "), "date finished");
    });
  });

  describe("dateSortKey", function () {
    it("sorts full ISO dates chronologically", function () {
      assert.deepEqual(
        sortByKey(["2026-08-14", "2019-12-31", "2026-01-02"], dateSortKey),
        ["2019-12-31", "2026-01-02", "2026-08-14"],
      );
    });

    it("places a partial date before the dates within it", function () {
      assert.deepEqual(
        sortByKey(["2026-08-14", "2026", "2026-08", "2025-06-01"], dateSortKey),
        ["2025-06-01", "2026", "2026-08", "2026-08-14"],
      );
    });

    it("ignores a time after a full date", function () {
      assert.equal(
        dateSortKey("2026-08-14T09:30:00"),
        dateSortKey("2026-08-14"),
      );
    });

    it("sorts unparseable values after every date", function () {
      assert.deepEqual(
        sortByKey(["forthcoming", "2026-08-14", "n.d.", "1900"], dateSortKey),
        ["1900", "2026-08-14", "forthcoming", "n.d."],
      );
    });

    it("rejects impossible months and days", function () {
      assert.deepEqual(sortByKey(["2026-13-01", "2026-12-01"], dateSortKey), [
        "2026-12-01",
        "2026-13-01",
      ]);
      assert.deepEqual(sortByKey(["2026-01-32", "2026-01-31"], dateSortKey), [
        "2026-01-31",
        "2026-01-32",
      ]);
    });

    it("rejects non-ISO date formats", function () {
      assert.deepEqual(sortByKey(["14/08/2026", "2026-08-14"], dateSortKey), [
        "2026-08-14",
        "14/08/2026",
      ]);
    });
  });

  describe("sqlDateSortKey", function () {
    it("sorts Zotero's SQL dates chronologically, partial dates first", function () {
      const sql: Record<string, string> = {
        "14 August 1860": "1860-08-14",
        "August 1860": "1860-08-00",
        "1860": "1860-00-00",
        "1859": "1859-00-00",
      };
      assert.deepEqual(
        sortByKey(Object.keys(sql), (display) =>
          sqlDateSortKey(sql[display], display),
        ),
        ["1859", "1860", "August 1860", "14 August 1860"],
      );
    });

    it("sorts text Zotero could not read as a date after every date", function () {
      const sql: Record<string, string> = {
        "n.d.": "0000-00-00",
        forthcoming: "",
        "1066": "1066-00-00",
      };
      assert.deepEqual(
        sortByKey(Object.keys(sql), (display) =>
          sqlDateSortKey(sql[display], display),
        ),
        ["1066", "forthcoming", "n.d."],
      );
    });
  });

  describe("buildDateCell", function () {
    it("shows the date as entered and sorts by the parsed date", function () {
      const cells = [
        buildDateCell("March 1850", "1850-03-00"),
        buildDateCell("1849", "1849-00-00"),
        buildDateCell("1 April 1850", "1850-04-01"),
      ];
      assert.deepEqual(sortCells(cells), [
        "1849",
        "March 1850",
        "1 April 1850",
      ]);
    });

    it("returns an empty string for an absent value", function () {
      assert.equal(buildDateCell("", ""), "");
      assert.equal(buildDateCell("  ", "0000-00-00"), "");
    });
  });

  describe("numberSortKey", function () {
    it("sorts numerically rather than lexicographically", function () {
      assert.deepEqual(sortByKey(["9", "10", "100", "2"], numberSortKey), [
        "2",
        "9",
        "10",
        "100",
      ]);
    });

    it("sorts negative numbers before positive ones", function () {
      assert.deepEqual(sortByKey(["3", "-10", "0", "-2"], numberSortKey), [
        "-10",
        "-2",
        "0",
        "3",
      ]);
    });

    it("sorts decimals correctly", function () {
      assert.deepEqual(
        sortByKey(["1.5", "1.25", "1.05", "-1.5"], numberSortKey),
        ["-1.5", "1.05", "1.25", "1.5"],
      );
    });

    it("accepts a leading sign and exponent notation", function () {
      assert.deepEqual(sortByKey(["+4", "1e2", "30"], numberSortKey), [
        "+4",
        "30",
        "1e2",
      ]);
    });

    it("sorts unparseable and out-of-range values after every number", function () {
      assert.deepEqual(sortByKey(["many", "7", "1e12", "-3"], numberSortKey), [
        "-3",
        "7",
        "1e12",
        "many",
      ]);
    });
  });

  describe("sorting under Zotero's collation", function () {
    for (const [setting, collator] of [
      ["on", naturalCollator],
      ["off", plainCollator],
    ] as const) {
      describe(`with natural sorting ${setting}`, function () {
        it("sorts values that are not dates after every date", function () {
          assert.deepEqual(
            sortCells(
              ["forthcoming", "2026-08-14", "1999", "14/08/2026"].map((value) =>
                buildCellValue(value, "date"),
              ),
              collator,
            ),
            ["1999", "2026-08-14", "14/08/2026", "forthcoming"],
          );
          assert.deepEqual(
            sortCells(
              [
                buildDateCell("n.d.", "0000-00-00"),
                buildDateCell("1850", "1850-00-00"),
              ],
              collator,
            ),
            ["1850", "n.d."],
          );
        });

        it("keeps a display value starting with digits out of the date", function () {
          assert.deepEqual(
            sortCells(
              [
                buildDateCell("1850", "1850-00-00"),
                buildDateCell("12 March 1850", "1850-03-12"),
                buildDateCell("1 March 1850", "1850-03-01"),
                buildDateCell("March 1850", "1850-03-00"),
              ],
              collator,
            ),
            ["1850", "March 1850", "1 March 1850", "12 March 1850"],
          );
        });

        it("sorts values that are not numbers after every number", function () {
          assert.deepEqual(
            sortCells(
              ["many", "1e2", "99", "10", "9", "-3"].map((value) =>
                buildCellValue(value, "number"),
              ),
              collator,
            ),
            ["-3", "9", "10", "99", "1e2", "many"],
          );
        });
      });
    }
  });

  describe("buildCellValue", function () {
    it("returns text unencoded, for Zotero's case-insensitive collation", function () {
      assert.equal(buildCellValue("Reviewed", "text"), "Reviewed");
    });

    it("returns an empty string for an absent value", function () {
      assert.equal(buildCellValue("", "text"), "");
      assert.equal(buildCellValue("   ", "date"), "");
      assert.equal(buildCellValue("", "number"), "");
    });

    it("keeps the display value recoverable for every type", function () {
      for (const [raw, type] of [
        ["Reviewed", "text"],
        ["2026-08-14", "date"],
        ["forthcoming", "date"],
        ["10", "number"],
        ["many", "number"],
      ] as const) {
        assert.equal(cellDisplayValue(buildCellValue(raw, type)), raw);
      }
    });

    it("sorts date cells chronologically end to end", function () {
      const cells = ["2026-08-14", "2019-12-31", "later"].map((value) =>
        buildCellValue(value, "date"),
      );
      assert.deepEqual(sortCells(cells), ["2019-12-31", "2026-08-14", "later"]);
    });

    it("sorts number cells numerically end to end", function () {
      const cells = ["9", "10", "-1"].map((value) =>
        buildCellValue(value, "number"),
      );
      assert.deepEqual(sortCells(cells), ["-1", "9", "10"]);
    });
  });
});
