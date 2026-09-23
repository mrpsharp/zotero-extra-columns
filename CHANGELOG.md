# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- A warning in the settings pane when a key is one Zotero itself interprets in
  Extra, such as a CSL variable, since those values feed citations.
- British English interface text, localised with Fluent.

[Unreleased]: https://github.com/mrpsharp/zotero-extra-columns/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/mrpsharp/zotero-extra-columns/releases/tag/v0.1.0
