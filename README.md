# Universal License Notice

Universal License Notice (`uln`) is a CLI for discovering package manager manifests and generating third-party license notice output from package metadata.

Its goal is to provide one tool for generating license notices across multiple package managers, saving you from having to use different tools for each manager.

The first supported package manager is [npm](https://npmjs.com), with additional adapters planned over time.

## Status

The project is currently experimental, but available on npm for early use and feedback.

- Supported package managers:
  - `npm`
- Detected by `uln` but not yet supported:
  - `composer`
  - `pypi`

Current scope:

- scans project root only
- metadata-based notice generation, no network lookups yet
- bundles local dependency license files when available

This tool is best-effort and is not legal advice.

## Install

`uln` requires Node.js 20 or newer.

Install from npm:

```bash
npm install -g universal-license-notice
uln --help
```

For local development:

```bash
npm install
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
- HTML output defaults to `NOTICE.html`
- If you do not specify a format, HTML output is used by default.
- Full dependency license text is included by default when local package license files are available.
- Use `--dont-include-license-text` to disable license text bundling.

Examples:

```bash
uln generate
uln generate --format text
uln generate --output notices.txt
uln generate --format html --output third-party-notices.html
uln generate --stdout
uln generate --stdout --format json
uln generate --config uln.config.json
```

`--stdout` and `--output` cannot be used together.

## Configuration

If `uln.config.json` exists in the project root, `uln generate` loads it automatically.

You can also point to a config file explicitly:

```bash
uln generate --config path/to/uln.config.json
```

Supported fields:

```json
{
  "managers": {
    "npm": {
      "excludePackages": ["example-package", "@author/*"],
      "packageOverrides": {
        "chalk": {
          "licenseExpression": "MIT",
          "repository": "https://github.com/chalk/chalk"
        },
        "@scope/*": {
          "licenseExpression": "MIT"
        }
      }
    }
  }
}
```

- `managers.<manager>.excludePackages`: removes named packages from generated output; `*` is supported, for example `@ckeditor/*`
- `managers.<manager>.packageOverrides.<name>.exclude`: excludes a specific package
- `managers.<manager>.packageOverrides.<name>.licenseExpression`: replaces detected license metadata
- `managers.<manager>.packageOverrides.<name>.homepage`, `repository`, `author`: replace detected package metadata
- exact override keys win over wildcard keys when both match the same package
- `output.html.title`: overrides the default HTML page title
- `output.html.description`: overrides the default HTML page description and supports inline HTML tags
- `output.html.templatePath`: path to a custom EJS template file (relative to the config file location when not absolute)

## Output

### Text output

The text renderer includes:

- package manager
- package name and version
- whether the dependency is direct
- license expression when available
- repository, homepage, and author when available
- bundled license file path and license text when available
- warnings for missing or non-normalized license metadata

### JSON output

The JSON renderer returns normalized dependency records and warnings suitable for later tooling or CI integration.

When license text bundling is enabled (default), dependency records also include `licenseText` and `licenseSourcePath` when available.

### HTML output

The HTML renderer outputs a clean, GitHub Pages-style notice page with collapsible dependency sections.

Both the default template and custom templates are rendered with EJS.

- each dependency is rendered as a section labeled `package@version (SPDX code)`
- expanded sections include author, homepage, repository, direct dependency status, and package manager information
- full license text is rendered inside `<pre>` when available
- description content is rendered as HTML in the default template

You can configure HTML output metadata in `uln.config.json`. **All of these settings are optional**:

```json
{
  "output": {
    "html": {
      "title": "Third-Party Notices",
      "description": "Generated using Universal License Notice from discovered package metadata.",
      "templatePath": "templates/custom-notice.ejs"
    }
  }
}
```

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

- Composer adapter
- PyPI adapter
- monorepo and manually provided manifest-path support
- expand configuration support beyond excludes and per-package overrides
- better output summaries and integration tests

## License

MIT
