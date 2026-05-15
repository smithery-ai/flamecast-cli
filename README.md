# flamecast-cli

CLI for Flamecast. Drives the device-auth handshake and wraps the public REST API.

## Usage

```bash
bun run bin/flamecast.ts login        # browser sign-in, stores an API key
bun run bin/flamecast.ts whoami       # who is the stored key?
bun run bin/flamecast.ts agents       # list agents
bun run bin/flamecast.ts sessions     # list sessions
bun run bin/flamecast.ts logout       # clear the local key
bun run bin/flamecast.ts config       # show config path + base URL
```

Build a standalone binary:

```bash
bun run build      # writes dist/flamecast
```

## Config

`~/.config/flamecast/config.json` (or `$XDG_CONFIG_HOME/flamecast/config.json`). One profile: `baseUrl`, `apiKey`, `organization`, `updatedAt`. Delete the file or run `flamecast logout` to clear.

Set `FLAMECAST_URL` to point at a different worker (default `https://flamecast.dev`).

## How `login` works

1. `POST /api/auth/cli/session` returns `{ sessionId, authUrl }`.
2. The CLI opens `authUrl` in your browser.
3. WorkOS sign-in lands on the consent page; clicking Authorize POSTs `/api/auth/cli/approve`, which mints a Flamecast API key and flips the KV record.
4. The CLI polls `/api/auth/cli/poll/:sessionId` until the record becomes `{ status: "success", apiKey, organization }`.
5. The key is written to the config file. The KV record is deleted on read so the same key can never be fetched twice.
