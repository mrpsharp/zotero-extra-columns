import { assert } from "chai";
import {
  buildCellValue,
  cellDisplayValue,
  dateSortKey,
  getExtraValue,
  normaliseKey,
  numberSortKey,
  parseExtra,
} from "../../src/modules/extra";

describe("Extra field parsing and sorting", function () {
  /** Order a set of raw values the way Zotero's collation would order the keys. */
  function sortByKey(
    values: string[],
    key: (value: string) => string,
  ): string[] {
    return [...values].sort((a, b) => {
      const [keyA, keyB] = [key(a), key(b)];
      return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
    });
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
      assert.deepEqual([...cells].sort().map(cellDisplayValue), [
        "2019-12-31",
        "2026-08-14",
        "later",
      ]);
    });

    it("sorts number cells numerically end to end", function () {
      const cells = ["9", "10", "-1"].map((value) =>
        buildCellValue(value, "number"),
      );
      assert.deepEqual([...cells].sort().map(cellDisplayValue), [
        "-1",
        "9",
        "10",
      ]);
    });
  });
});
