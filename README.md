<div align="center">

# stela

**Manage your GitHub starred repositories from the terminal.**

[![npm version](https://img.shields.io/npm/v/@tukuyomil032/stela)](https://www.npmjs.com/package/@tukuyomil032/stela) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![CI](https://github.com/tukuyomil032/stela/actions/workflows/ci.yml/badge.svg)](https://github.com/tukuyomil032/stela/actions/workflows/ci.yml)

</div>

---

Browse, filter, star, unstar, and search GitHub repositories — all without leaving your terminal. Stela provides an interactive TUI with fuzzy selection, language filtering, and clipboard/browser integration, backed by a local cache for fast repeated queries.

## Features

- **Interactive list** — paginated fuzzy picker with multi-select; open in browser or copy URL directly
- **Star & unstar** — star any `owner/repo` or GitHub URL; bulk-unstar from the interactive list
- **Search** — query GitHub with full search syntax, filter by language, and star results interactively
- **Caching** — JSON cache with configurable TTL so repeated `list` calls are instant
- **Language breakdown** — color-coded language stats using GitHub Linguist colors
- **i18n** — English and Japanese UI (`config set lang ja`)
- **Secure authentication** — GitHub OAuth Device Flow (`stela auth login`); the token is stored only in your OS keychain, never in a plaintext file

## Prerequisites

- Node.js 20+
- A GitHub account (no other CLI tools required — `stela auth login` handles authentication)

## Installation

```bash
npm install -g @tukuyomil032/stela
```

## Quick Start

```bash
# Log in via GitHub OAuth Device Flow (one-time)
stela auth login

# Browse your starred repos interactively
stela list

# Filter by language
stela list --lang typescript

# Search GitHub and star results
stela search "awesome cli tools" --lang go
```

## Commands

### `stela auth`

Manage GitHub authentication.

```bash
stela auth login    # start the OAuth Device Flow
stela auth status   # show who you're logged in as
stela auth logout   # remove the stored token from the OS keychain
```

### `stela list`

Browse your starred repositories in an interactive picker.

```
stela list [options]

Options:
  --lang <language>   Filter by programming language
  --sort <field>      Sort by: stars | updated  (default: stars)
  --refresh           Bypass cache and fetch from GitHub API
  --no-interactive    Print as a plain table (useful for scripts)
```

From the interactive picker you can:
- Open a repository in your browser
- Copy the URL to clipboard
- Unstar one or more repositories

### `stela star`

Star a repository by `owner/repo` slug or GitHub URL.

```bash
stela star cli/cli
stela star https://github.com/cli/cli
```

### `stela unstar`

Remove a star from a repository.

```bash
stela unstar cli/cli        # prompts for confirmation
stela unstar cli/cli -y     # skip confirmation
```

### `stela search`

Search GitHub and interactively star results.

```
stela search [query] [options]

Options:
  --lang <language>   Filter results by language
  --sort <field>      Sort by: stars | forks | updated  (default: stars)
  --limit <n>         Number of results (max 100, default 30)
  --no-interactive    Print table only; no starring via pipes
```

```bash
stela search "react state management" --lang typescript --limit 10
stela search --no-interactive "rust cli" | head -5
```

### `stela cache`

Inspect or clear the local starred-repo cache.

```bash
stela cache status   # show timestamp, TTL remaining, and repo count
stela cache clear    # delete the cache file
```

### `stela config`

View and edit persistent settings.

```bash
stela config show
stela config set <key> <value>
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `cacheTTL` | number (minutes) | `30` | How long the cache is considered fresh |
| `pageSize` | number | `30` | Items shown per page in interactive mode |
| `defaultLanguageFilter` | string[] | `[]` | Language pre-filter applied to `list` |
| `lang` | `en` \| `ja` | `en` | UI language |

```bash
stela config set cacheTTL 60
stela config set lang ja
stela config set pageSize 50
```

## Non-interactive Mode

All commands that produce output support `--no-interactive` for use in scripts or pipes. In this mode no prompts are shown and no side effects (starring/unstarring) are performed.

```bash
stela list --no-interactive --lang rust | grep "tokio"
```

## Global Options

```
--no-interactive   Output as plain table
--no-color         Disable colored output (also respects NO_COLOR env var)
--version          Show version number
--help             Show help
```

## Development

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Type-check
bun run typecheck

# Lint and format
bun run biome:fix

# Run tests
bun test

# Build
bun run build
```

> [!NOTE]
> Run `bun run dev auth login` once to authenticate locally before exercising commands that hit the GitHub API.

## How It Works

Stela authenticates via the GitHub OAuth Device Flow (`@octokit/oauth-methods`, scopes `public_repo` + `offline_access`) and stores the resulting session — access token, refresh token, and expiry — only in your OS keychain (`@napi-rs/keyring` — macOS Keychain, Windows Credential Manager, or Linux Secret Service), never in a plaintext file. When the access token is near expiry, stela transparently refreshes it before running a command; only once the refresh token itself expires do you need to run `stela auth login` again. All GitHub API operations go through an authenticated Octokit client (`@octokit/rest` with `@octokit/plugin-throttling` for automatic rate-limit handling). Starred repositories are cached at `~/.stela/cache/starred.json` with a configurable TTL (default 30 minutes).

## License

MIT
