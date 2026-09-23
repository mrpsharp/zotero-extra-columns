import { assert } from "chai";
import {
  createDefinition,
  definitionLabel,
  parseDefinitions,
  serialiseDefinitions,
} from "../../src/modules/definitions";

describe("Column definitions", function () {
  describe("parseDefinitions", function () {
    it("reads stored definitions", function () {
      const definitions = parseDefinitions(
        '[{"id":"a1","label":"Finished","key":"finished","type":"date"}]',
      );
      assert.deepEqual(definitions, [
        { id: "a1", label: "Finished", key: "finished", type: "date" },
      ]);
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
        { id: "a1", label: "Finished", key: "finished", type: "date" },
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
  });
});
