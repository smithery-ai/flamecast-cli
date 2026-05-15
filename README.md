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
| `flamecast sessions create --input <text>` | Launch a Think session. |
| `flamecast sessions get <sessionId>` | Show one session. |
| `flamecast sessions events <sessionId>` | Dump the event log. |

### Launching a session

```bash
export AI_GATEWAY_API_KEY=vck_...
flamecast sessions create --input "summarize my open Linear tickets"
```

Flags on `sessions create`:

| Flag | Default | Notes |
|---|---|---|
| `--input <text>` | _(required)_ | First message to the agent. |
| `--model <id>` | `anthropic/claude-haiku-4-5` | Any Think-supported model. |
| `--agent-id <id>` | _none_ | Launch a saved agent instead of an inline runtime. |
| `--async` | off | Return immediately; poll `sessions get` / `sessions events` for progress. |

## Configuration

Credentials live at `~/.config/flamecast/config.json` (respects `$XDG_CONFIG_HOME`). Delete the file or run `flamecast logout` to clear.

| Env var | Default | Notes |
|---|---|---|
| `FLAMECAST_URL` | `https://flamecast.dev` | Point at a different worker. |
| `AI_GATEWAY_API_KEY` | _none_ | Required for `sessions create` with inline runtime. Flamecast does not supply one. |

## Development

```bash
bun run bin/flamecast.ts <command>     # run from source
bun run typecheck                       # type-check
```
