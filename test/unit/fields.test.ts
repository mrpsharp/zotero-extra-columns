import { assert } from "chai";
import { selectAvailableFields } from "../../src/modules/fields";

describe("Zotero fields", function () {
  describe("selectAvailableFields", function () {
    // A stand-in for the running Zotero's schema.
    const fields = [
      "title",
      "publisher",
      "university",
      "label",
      "originalDate",
      "priorityDate",
      "DOI",
      "authority",
      "organization",
    ];
    const mapped: Record<string, string[]> = {
      publisher: ["university", "label"],
      originalDate: ["priorityDate"],
      authority: ["organization"],
    };
    const mappedFields = (base: string) => mapped[base] ?? [];

    it("leaves out fields that have a built-in column", function () {
      const available = selectAvailableFields(
        fields,
        new Set(["title", "publisher", "firstCreator"]),
        mappedFields,
      );
      assert.notInclude(available, "title");
      assert.notInclude(available, "publisher");
    });

    it("leaves out fields a built-in column already shows through their base field", function () {
      const available = selectAvailableFields(
        fields,
        new Set(["publisher"]),
        mappedFields,
      );
      assert.notInclude(available, "university");
      assert.notInclude(available, "label");
    });

    it("offers every other field, in order, including base fields and their mapped fields", function () {
      assert.deepEqual(
        selectAvailableFields(
          fields,
          new Set(["title", "publisher"]),
          mappedFields,
        ),
        ["originalDate", "priorityDate", "DOI", "authority", "organization"],
      );
    });

    it("offers fields it has never heard of", function () {
      assert.include(
        selectAvailableFields(
          [...fields, "someFutureField"],
          new Set(["title"]),
          mappedFields,
        ),
        "someFutureField",
      );
    });
  });
});
