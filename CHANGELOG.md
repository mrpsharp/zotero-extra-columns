# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - Unreleased

### Added

- Columns for Zotero's own fields, for the many that Zotero's column picker
  does not offer, such as Original Date, Original Place, Original Publisher and
  DOI. Each column definition now has a source: an Extra key, as before, or a
  Zotero field chosen by its label in your language.
- The fields on offer are worked out from the running Zotero, as every field
  without a column of its own, so fields added in future Zotero versions appear
  automatically. Fields Zotero already shows through a base field (a thesis's
  University in the Publisher column, say) are left out.
- Field columns follow Zotero's base-field mappings, as its own columns do, and
  show an empty cell where an item's type does not have the field.
- Date columns for a field show the date as entered and sort by the date
  Zotero's own parser reads from it.
- An optional fallback Extra key for each field column, read when the field is
  empty or does not apply, so that an Original Date column can also show
  `original-date:` from Extra on other item types.
- Tests that run inside Zotero, in the scaffold's throwaway profile.

### Changed

- Stored column definitions now record their source. Definitions saved by
  earlier versions are read as Extra columns and rewritten once at startup,
  keeping their identifiers, so column widths and positions are kept.

### Fixed

- After a restart, an item list sorted by one of the plugin's columns showed
  that column as sorted but listed the items in title order. Zotero loads and
  sorts the list before plugin columns exist, and does not re-sort existing
  rows when they appear, so the plugin now sorts the list again once its
  columns are registered, and whenever they change.
- Values that cannot be read as a date or a number now sort after those that
  can, as documented. With Zotero's natural sorting (on by default) they sorted
  first, and a value beginning with digits could sort out of place.

## [0.1.1] - 2026-09-23

### Changed

- The settings pane's placeholders no longer suggest a particular use. They
  name the field instead of showing a worked example, and the empty-state line
  follows suit.

## [0.1.0] - 2026-09-23

### Added

- Settings pane listing column definitions, each with a header, an Extra key and
  a type (text, date or number). Definitions are stored in a single JSON
  preference.
- Item tree columns registered from those definitions via
  `Zotero.ItemTreeManager`, so they appear in Zotero's own column picker.
  Adding, editing or removing a definition re-registers the columns without a
  restart.
- Type-aware sorting: dates chronologically (including the partial dates
  `YYYY-MM` and `YYYY`), numbers numerically, and text ignoring case. Values
  that cannot be read as a date or number sort after those that can.
- Warnings in the settings pane for keys Zotero itself interprets in Extra,
  distinguishing CSL variables, which reach the citation processor, from
  Zotero's own field and creator names, which it may take out of Extra and
  store as that field.
- British English interface text, localised with Fluent.

[Unreleased]: https://github.com/mrpsharp/zotero-extra-columns/compare/v0.1.1...HEAD
[0.2.0]: https://github.com/mrpsharp/zotero-extra-columns/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/mrpsharp/zotero-extra-columns/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/mrpsharp/zotero-extra-columns/releases/tag/v0.1.0
