import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json";

export default defineConfig({
  source: ["src", "addon"],
  dist: ".scaffold/build",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  updateURL: `https://github.com/{{owner}}/{{repo}}/releases/download/release/${
    pkg.version.includes("-") ? "update-beta.json" : "update.json"
  }`,
  xpiDownloadLink:
    "https://github.com/{{owner}}/{{repo}}/releases/download/v{{version}}/{{xpiName}}.xpi",

  build: {
    assets: ["addon/**/*.*"],
    define: {
      ...pkg.config,
      author: pkg.author,
      description: pkg.description,
      homepage: pkg.homepage,
      buildVersion: pkg.version,
      buildTime: "{{buildTime}}",
    },
    prefs: {
      prefix: pkg.config.prefsPrefix,
    },
    esbuildOptions: [
      {
        entryPoints: ["src/index.ts"],
        define: {
          __env__: `"${process.env.NODE_ENV}"`,
        },
        bundle: true,
        target: "firefox115",
        outfile: `.scaffold/build/addon/content/scripts/${pkg.config.addonRef}.js`,
      },
    ],
  },

  test: {
    waitForPlugin: `() => Zotero.${pkg.config.addonInstance}.data.initialized`,
    // Column definitions for the in-Zotero tests (see test/columns.test.ts).
    // The first is in the format stored before field columns existed, so that
    // the migration runs at startup.
    prefs: {
      [`${pkg.config.prefsPrefix}.columns`]: JSON.stringify([
        { id: "finished", label: "Finished", key: "finished", type: "date" },
        {
          id: "origdate",
          label: "",
          source: "field",
          field: "originalDate",
          fallbackKey: "original-date",
          type: "date",
        },
        {
          id: "origonly",
          label: "Original Date (no fallback)",
          source: "field",
          field: "originalDate",
          type: "date",
        },
        { id: "doi", label: "", source: "field", field: "DOI", type: "text" },
        {
          id: "gone",
          label: "Gone",
          source: "field",
          field: "noSuchField",
          fallbackKey: "gone",
          type: "text",
        },
      ]),
    },
  },

  // If you need to see a more detailed log, uncomment the following line:
  // logLevel: "trace",
});
