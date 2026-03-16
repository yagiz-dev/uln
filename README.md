# Universal License Notice

Universal License Notice (`uln`) is a CLI for discovering package manager manifests and generating third-party license notice output from package metadata.

Its goal is to provide one tool for generating license notices across multiple package managers, saving you from having to use different tools for each manager.

The first supported package manager is [npm](https://npmjs.com), with additional adapters planned over time.

## Status

This project is currently experimental.

- Supported package managers:
  - `npm`
- Detected by `uln` but not yet supported:
  - `composer`
  - `pypi`

Current scope:

- scans project root only
- metadata-based notice generation, no network lookups yet
- no full license text bundling yet

This tool is best-effort and is not legal advice.

## Install

`uln` requires Node.js 20 or newer. Until the first npm release is published, use the local development workflow below:

```bash
npm run build
node dist/index.js --help
npm link # If you want to directly call the binary as `uln`
```

## Commands

### `scan`

Reports which package managers were discovered in the current project root and whether they are currently supported.

```bash
uln scan
```

Example output:

```text
Project root: /path/to/project

Package manager | Support     | Manifest files
----------------+-------------+--------------------------------
composer        | unsupported | composer.json, composer.lock
npm             | supported   | package.json, package-lock.json

Notes:
- composer (info): composer manifests were found, but this adapter has not been implemented yet.
```

### `generate`

Generates third-party notice output for supported package managers in the current project root.

```bash
uln generate
```

- Text output defaults to `THIRD_PARTY_NOTICES.txt`
- JSON output defaults to `NOTICE.json`
- If you do not specify a format, text output is used by default.

Examples:

```bash
uln generate
uln generate --format json
uln generate --output notices.txt
uln generate --stdout
uln generate --stdout --format json
```

`--stdout` and `--output` cannot be used together.

## Output

### Text output

The text renderer includes:

- package manager
- package name and version
- whether the dependency is direct
- license expression when available
- repository, homepage, and author when available
- warnings for missing or non-normalized license metadata

### JSON output

The JSON renderer returns normalized dependency records and warnings suitable for later tooling or CI integration.

## npm support

The current npm adapter:

- detects `package.json` and `package-lock.json`
- prefers `package-lock.json` for resolved dependency metadata
- uses `package.json` and lockfile metadata to identify direct dependencies
- supports modern npm lockfiles first (`lockfileVersion` 2 and 3)
- emits warnings when license metadata is missing or could not be normalized cleanly

If `package.json` exists without `package-lock.json`, generation falls back to direct dependencies with incomplete metadata and emits warnings.

## License normalization

The current normalization layer handles a few common cases:

- common variants like `Apache License 2.0` -> `Apache-2.0`
- array license values joined as `OR`
- slash-delimited values like `MIT/Apache 2.0`
- file-reference values like `SEE LICENSE IN LICENSE.md`, with warnings

Normalization is intentionally conservative. If a value cannot be normalized confidently, it is preserved and surfaced with a warning.

## Development

Useful commands:

```bash
npm test
npm run lint
npm run build
```

## Roadmap

Planned next steps:

- configuration for excludes and per-package overrides
- Composer adapter
- PyPI adapter
- monorepo and manually provided manifest-path support
- better output summaries and integration tests

## License

MIT
