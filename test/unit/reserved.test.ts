import { assert } from "chai";
import {
  findReservedConflict,
  normaliseReservedKey,
} from "../../src/modules/reserved";

describe("Reserved Extra keys", function () {
  // A stand-in for the set built from the running Zotero's schema.
  const reserved = new Set([
    "original-date",
    "number-of-pages",
    "pmid",
    "editor",
  ]);

  describe("normaliseReservedKey", function () {
    it("normalises the spellings Zotero accepts in Extra", function () {
      assert.equal(normaliseReservedKey("original-date"), "original-date");
      assert.equal(normaliseReservedKey("originalDate"), "original-date");
      assert.equal(normaliseReservedKey("Original Date"), "original-date");
      assert.equal(normaliseReservedKey("original_date"), "original-date");
      assert.equal(
        normaliseReservedKey("  Original   Date  "),
        "original-date",
      );
    });
  });

  describe("findReservedConflict", function () {
    it("reports keys Zotero interprets itself", function () {
      assert.equal(
        findReservedConflict("original-date", reserved),
        "original-date",
      );
      assert.equal(
        findReservedConflict("originalDate", reserved),
        "original-date",
      );
      assert.equal(
        findReservedConflict("Number Of Pages", reserved),
        "number-of-pages",
      );
    });

    it("passes over keys Zotero ignores", function () {
      assert.isNull(findReservedConflict("finished", reserved));
      assert.isNull(findReservedConflict("reading status", reserved));
      assert.isNull(findReservedConflict("", reserved));
      assert.isNull(findReservedConflict("   ", reserved));
    });
  });
});
