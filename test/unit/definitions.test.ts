import { assert } from "chai";
import {
  createDefinition,
  definitionLabel,
  needsMigration,
  parseDefinitions,
  serialiseDefinitions,
} from "../../src/modules/definitions";

describe("Column definitions", function () {
  describe("parseDefinitions", function () {
    it("reads definitions stored before field columns as Extra columns", function () {
      const definitions = parseDefinitions(
        '[{"id":"a1","label":"Finished","key":"finished","type":"date"}]',
      );
      assert.deepEqual(definitions, [
        {
          id: "a1",
          label: "Finished",
          source: "extra",
          key: "finished",
          field: "",
          fallbackKey: "",
          type: "date",
        },
      ]);
    });

    it("reads field definitions", function () {
      const definitions = parseDefinitions(
        '[{"id":"b2","label":"","source":"field","field":"originalDate",' +
          '"fallbackKey":"original-date","type":"date"}]',
      );
      assert.deepEqual(definitions, [
        {
          id: "b2",
          label: "",
          source: "field",
          key: "",
          field: "originalDate",
          fallbackKey: "original-date",
          type: "date",
        },
      ]);
    });

    it("discards field definitions without a field", function () {
      assert.deepEqual(
        parseDefinitions('[{"id":"a","source":"field","key":"finished"}]'),
        [],
      );
    });

    it("reads an unknown source as an Extra column", function () {
      const [definition] = parseDefinitions(
        '[{"source":"elsewhere","key":"finished"}]',
      );
      assert.equal(definition.source, "extra");
    });

    it("returns nothing for empty or malformed storage", function () {
      assert.deepEqual(parseDefinitions(""), []);
      assert.deepEqual(parseDefinitions("not json"), []);
      assert.deepEqual(parseDefinitions('{"key":"finished"}'), []);
    });

    it("discards entries without an Extra key", function () {
      assert.deepEqual(parseDefinitions('[{"id":"a","label":"Finished"}]'), []);
      assert.deepEqual(parseDefinitions('[{"id":"a","key":"  "}]'), []);
    });

    it("falls back to a text column for an unknown type", function () {
      const [definition] = parseDefinitions(
        '[{"key":"finished","type":"colour"}]',
      );
      assert.equal(definition.type, "text");
    });

    it("gives every definition a unique identifier", function () {
      const definitions = parseDefinitions(
        '[{"id":"a","key":"one"},{"id":"a","key":"two"},{"key":"three"}]',
      );
      assert.equal(new Set(definitions.map((d) => d.id)).size, 3);
    });

    it("round-trips through serialisation", function () {
      const definitions = parseDefinitions(
        '[{"id":"a1","label":" Finished ","key":" finished ","type":"date"}]',
      );
      assert.deepEqual(parseDefinitions(serialiseDefinitions(definitions)), [
        {
          id: "a1",
          label: "Finished",
          source: "extra",
          key: "finished",
          field: "",
          fallbackKey: "",
          type: "date",
        },
      ]);
    });

    it("round-trips field definitions", function () {
      const definitions = [
        createDefinition({
          id: "b2",
          source: "field",
          field: " DOI ",
          fallbackKey: " doi ",
        }),
        createDefinition({ id: "c3", source: "field", field: "originalDate" }),
      ];
      assert.deepEqual(parseDefinitions(serialiseDefinitions(definitions)), [
        { ...definitions[0], field: "DOI", fallbackKey: "doi" },
        definitions[1],
      ]);
    });
  });

  describe("serialiseDefinitions", function () {
    it("leaves out rows that have no key yet", function () {
      const stored = serialiseDefinitions([
        createDefinition({ key: "finished", label: "Finished" }),
        createDefinition(),
      ]);
      assert.equal(parseDefinitions(stored).length, 1);
    });

    it("names the source of every definition", function () {
      const stored = JSON.parse(
        serialiseDefinitions([
          createDefinition({ id: "a", key: "finished" }),
          createDefinition({ id: "b", source: "field", field: "DOI" }),
        ]),
      );
      assert.deepEqual(
        stored.map((entry: { source: string }) => entry.source),
        ["extra", "field"],
      );
    });

    it("stores only what the source needs", function () {
      const [extra, field] = JSON.parse(
        serialiseDefinitions([
          createDefinition({ id: "a", key: "finished", field: "DOI" }),
          createDefinition({
            id: "b",
            source: "field",
            field: "DOI",
            key: "finished",
          }),
        ]),
      );
      assert.deepEqual(extra, {
        id: "a",
        label: "",
        source: "extra",
        key: "finished",
        type: "text",
      });
      // No key, so that older versions of the plugin discard the entry.
      assert.deepEqual(field, {
        id: "b",
        label: "",
        source: "field",
        field: "DOI",
        type: "text",
      });
    });
  });

  describe("needsMigration", function () {
    it("is needed for definitions without a source", function () {
      assert.isTrue(
        needsMigration('[{"id":"a1","key":"finished","type":"date"}]'),
      );
      assert.isTrue(
        needsMigration(
          '[{"id":"a","source":"extra","key":"x"},{"id":"b","key":"y"}]',
        ),
      );
    });

    it("is not needed once every definition names its source", function () {
      assert.isFalse(
        needsMigration(
          serialiseDefinitions(
            parseDefinitions('[{"id":"a1","key":"finished","type":"date"}]'),
          ),
        ),
      );
    });

    it("keeps identifiers, so column widths and positions survive", function () {
      const stored = '[{"id":"fgj8emxa","label":"Finished","key":"finished"}]';
      assert.equal(
        parseDefinitions(serialiseDefinitions(parseDefinitions(stored)))[0].id,
        "fgj8emxa",
      );
    });

    it("leaves empty or malformed storage alone", function () {
      assert.isFalse(needsMigration(""));
      assert.isFalse(needsMigration("[]"));
      assert.isFalse(needsMigration("not json"));
      assert.isFalse(needsMigration('{"key":"finished"}'));
    });
  });

  describe("definitionLabel", function () {
    it("falls back to the Extra key when no header is given", function () {
      assert.equal(
        definitionLabel(createDefinition({ key: "finished" })),
        "finished",
      );
      assert.equal(
        definitionLabel(
          createDefinition({ key: "finished", label: "Finished" }),
        ),
        "Finished",
      );
    });

    it("falls back to the field's label for a field column", function () {
      const labels: Record<string, string> = { originalDate: "Original Date" };
      const definition = createDefinition({
        source: "field",
        field: "originalDate",
      });
      assert.equal(
        definitionLabel(definition, (field) => labels[field]),
        "Original Date",
      );
      assert.equal(definitionLabel(definition), "originalDate");
    });
  });
});
