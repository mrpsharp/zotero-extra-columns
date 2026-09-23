import { assert } from "chai";
import {
  ReservedKeys,
  findReservedConflict,
  normaliseReservedKey,
} from "../../src/modules/reserved";

describe("Reserved Extra keys", function () {
  // A stand-in for the sets built from the running Zotero's schema. "status"
  // appears in both, as it does in Zotero.
  const reserved: ReservedKeys = {
    csl: new Set(["original-date", "number-of-pages", "status", "editor"]),
    field: new Set(["status", "extra", "call-number", "cast-member"]),
  };

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
    it("reports CSL variables as a citation risk", function () {
      assert.deepEqual(findReservedConflict("original-date", reserved), {
        key: "original-date",
        kind: "csl",
      });
      assert.deepEqual(findReservedConflict("Number Of Pages", reserved), {
        key: "number-of-pages",
        kind: "csl",
      });
    });

    it("reports Zotero's own names as a field risk", function () {
      assert.deepEqual(findReservedConflict("call number", reserved), {
        key: "call-number",
        kind: "field",
      });
      assert.deepEqual(findReservedConflict("castMember", reserved), {
        key: "cast-member",
        kind: "field",
      });
    });

    it("prefers the citation risk where a key is both", function () {
      assert.deepEqual(findReservedConflict("Status", reserved), {
        key: "status",
        kind: "csl",
      });
    });

    it("passes over keys Zotero ignores", function () {
      assert.isNull(findReservedConflict("finished", reserved));
      assert.isNull(findReservedConflict("reading status", reserved));
      assert.isNull(findReservedConflict("", reserved));
      assert.isNull(findReservedConflict("   ", reserved));
    });
  });
});
