# flamecast

Command-line client for [Flamecast](https://flamecast.dev). Manage cloud agents and sessions from your terminal.

## Install

```bash
git clone https://github.com/smithery-ai/flamecast-cli
cd flamecast-cli
bun install
bun run build       # compiles dist/flamecast
```

Requires [Bun](https://bun.sh) for source builds. The compiled binary runs standalone.

## Quickstart

```bash
flamecast login     # browser sign-in, stores an API key locally
flamecast whoami
flamecast agents
flamecast sessions
```

## Commands

| Command | What it does |
|---|---|
| `flamecast login` | Sign in via the browser. Stores an API key. |
| `flamecast logout` | Clear the local API key. |
| `flamecast whoami` | Print the currently authed identity. |
| `flamecast config` | Show config file path + base URL. |
| `flamecast agents` | List agents in your workspace. |
| `flamecast sessions` | List recent sessions. |

## Configuration

Credentials live at `~/.config/flamecast/config.json` (respects `$XDG_CONFIG_HOME`). Delete the file or run `flamecast logout` to clear.

| Env var | Default | Notes |
|---|---|---|
| `FLAMECAST_URL` | `https://flamecast.dev` | Point at a different worker. |

## Development

```bash
bun run bin/flamecast.ts <command>     # run from source
bun run typecheck                       # type-check
```
