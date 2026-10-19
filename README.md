# Extra Columns

[![Zotero](https://img.shields.io/badge/Zotero-7%20%E2%80%93%2011-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![Licence: AGPL v3](https://img.shields.io/badge/Licence-AGPL%20v3-blue?style=flat-square)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/mrpsharp/zotero-extra-columns/ci.yml?branch=main&style=flat-square)](https://github.com/mrpsharp/zotero-extra-columns/actions/workflows/ci.yml)

A [Zotero](https://www.zotero.org) plugin that shows values stored in an item's
**Extra** field as columns in the item list, along with any Zotero field that
Zotero's own column picker does not offer.

This allows you to keep custom data in Extra as `key: value` lines. This could be a date you finished reading something, a rating, a project name. Extra Columns makes those values visible and sortable
alongside title etc
![The item list showing Finished and Rating columns](doc/screenshot.png)

## Installing

1. Download the latest `extra-columns.xpi` from the
   [Releases page](https://github.com/mrpsharp/zotero-extra-columns/releases).
   In most browsers you will need to right-click the link and choose
   _Save Link As…_, so that the file is saved rather than opened.
2. In Zotero, go to **Tools → Plugins**.
3. Click the gear icon at the top right and choose **Install Plugin From File…**.
4. Select the downloaded `.xpi` and restart Zotero if prompted.

Zotero updates the plugin automatically when a new release is published.

## Using it

1. Open **Edit → Settings → Extra Columns** (**Zotero → Settings** on macOS).
2. Click **Add column** and fill in:
   - **Column header** — what the column is called in the item list. Leave it
     empty to use the Extra key, or the field's name.
   - **Source** — _Extra key_ to show a value from Extra, or one of the Zotero
     fields listed beneath it (see [Zotero fields](#zotero-fields)).
   - **Extra key** — for an Extra column, the key to look for in Extra, for
     example `finished`. For a Zotero field, an optional fallback key (see
     below).
   - **Type** — `Text`, `Date` or `Number`. This only affects sorting.
3. Close settings, then right-click the item list's column headers (or click the
   column picker at the right-hand end of them) and switch on your new column.

Changes take effect immediately; there is no need to restart Zotero. Removing a
definition removes its column.

## The Extra format

Extra Columns reads Extra one line at a time:

```
finished: 2026-08-14
rating: 4
reading group: Tuesday evenings
```

- One `key: value` pair per line. Everything before the first colon is the key.
- Keys are matched without regard to case or surrounding whitespace, and may
  contain spaces.
- Where the same key appears more than once, the first occurrence wins.
- Lines that are not `key: value`, and keys with an empty value, are ignored.
- Items without the key show an empty cell.

### Sorting

Sorting follows the type you chose for the column:

| Type   | Sorts                         | Notes                                                                                                     |
| ------ | ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| Text   | Alphabetically, ignoring case |                                                                                                           |
| Date   | Chronologically               | Accepts `YYYY-MM-DD`, `YYYY-MM` and `YYYY`. A partial date sorts before the more precise dates within it. |
| Number | Numerically                   | Accepts a leading sign, decimals and exponent notation.                                                   |

Values that cannot be read as a date or a number sort after those that can, and
empty cells sort last of all. Date columns for a Zotero field accept any date
Zotero itself understands, not just the formats above.

Because Zotero has no comparison hook for plugin columns, date and number
columns sort on a hidden key rather than on the text you see. One side effect:
while a date or number column is the one you are sorting by, Zotero's
type-to-jump matches that hidden key rather than the displayed value. Text
columns are unaffected.

## Zotero fields

Zotero's column picker offers a fixed list of columns, which has not kept up
with the fields Zotero knows about. Fields added in later Zotero versions, such
as **Original Date**, **Original Place**, **Original Publisher** and **DOI**,
appear in the item pane but cannot be added as columns. Extra Columns can show
them.

The **Source** list offers every Zotero field that does not already have a
column of its own, under the names Zotero uses in your language. It is built
from the running Zotero, so fields added by future Zotero updates appear
automatically. Fields that Zotero already shows in one of its own columns are
left out: a thesis's University appears in the Publisher column, for instance.

- An item whose field is empty, or whose item type does not have the field,
  shows an empty cell. At present, for example, only books and book sections
  have an Original Date.
- Where Zotero maps one field onto another, the column follows the mapping, as
  Zotero's own columns do. An Original Date column shows a patent's Priority
  Date.
- A **Date** column shows the date exactly as entered, but sorts by the date
  Zotero reads from it, using Zotero's own date parser. `March 1850`,
  `12 March 1850` and `1850-03-12` are all understood.

### Fallback Extra key

A field column can name an Extra key to read whenever the field is empty or
does not apply to the item's type. This is useful for Original Date. When Zotero
added the field, it moved `original-date:` lines out of Extra on books and book
sections, but other item types still keep it in Extra. An Original Date column
with the fallback key `original-date` shows both.

The fallback key is matched in the same way as any other Extra key (see below).

## A caveat about keys Zotero uses itself

Zotero does not treat Extra as inert. Some keys it claims for itself, in two
different ways:

- **CSL variables** — `original-date`, `number-of-pages`, `status` and the
  rest. When Zotero builds a citation it hands these to your citation style,
  whatever the item type, so the value can appear in citations and
  bibliographies.
- **Zotero's own field and creator names** — `call number`, `cast member` and
  so on. Zotero matches these when it reads Extra and may take the value out of
  Extra altogether, storing it as that field instead.

You can still make a column for such a key, and it will show what is in Extra.
The settings pane simply tells you which of the two applies, so the choice is a
deliberate one. Citation warnings are highlighted, because those are the ones
with consequences outside Zotero. A field column's fallback key is not checked,
since it is usually Zotero's own key for that field on purpose.

A key can be both. `status` is a CSL variable _and_ a Zotero field on patent
and standard items, so it gets the citation warning, the more serious of the
two.

If you only want somewhere private to keep a note, pick a key Zotero does not
claim — `reading status` rather than `status`, for instance. Both lists are
read from the running Zotero's own schema, so they stay accurate as Zotero
changes.

## Roadmap

- **v0.1.0** — settings pane and read-only columns.
- **v0.2.0** — columns for Zotero fields that have no column of their own, with
  an optional fallback to an Extra key. _(current)_
- **v0.3.0** — an optional item pane section with an edit box per configured
  key, writing changes back into Extra without disturbing the other lines.

## Development

Requires Node.js 20 or later and a local Zotero installation.

```bash
npm install
cp .env.example .env    # then point it at your Zotero binary and dev profile
npm start               # launches Zotero with the plugin, and reloads on save
npm run build           # produces .scaffold/build/extra-columns.xpi
npm run test            # unit tests, in Node
npm run test:zotero     # runs the tests inside Zotero, in a throwaway profile
npm run lint:fix
```

When `npm start` or `npm run test:zotero` finishes, the scaffold shuts Zotero
down. On macOS its default command kills **every** Zotero process, including
any copy of Zotero you are using with your main profile. Set
`ZOTERO_PLUGIN_KILL_COMMAND` in `.env` to something narrower (see
`.env.example`), or quit your main Zotero first.

The version lives in `package.json` alone. The build writes it into
`addon/manifest.json`, and the release workflow uses it for the release and the
update manifest.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/).

### Releasing

Pushing a `vX.Y.Z` tag builds the `.xpi`, creates a GitHub Release with it
attached, and publishes `update.json` so that installed copies update
themselves.

```bash
npm version minor       # or patch / major; commits and tags
git push --follow-tags
```

## Credits

Built on [windingwind/zotero-plugin-template](https://github.com/windingwind/zotero-plugin-template).

Written with the help of [Claude Code](https://claude.com/claude-code); every
change was reviewed and tested by me before release, and I maintain it.

## Licence

[AGPL-3.0-or-later](LICENSE).
