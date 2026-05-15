import { login } from "./auth.ts"
import { clearConfig, configBaseUrl, configPath, readConfig } from "./config.ts"
import { sessions } from "./sessions.ts"
import { whoami } from "./whoami.ts"

const USAGE = `flamecast — programmable cloud agents

Usage:
  flamecast login                          Sign in via your browser, store an API key
  flamecast logout                         Clear the local API key
  flamecast whoami                         Print the currently authed identity
  flamecast config                         Show the local config file path + base URL
  flamecast agents                         List agents in your workspace
  flamecast sessions                       List recent sessions
  flamecast sessions create --input <text> Launch a Think session
  flamecast sessions get <sessionId>       Show one session
  flamecast sessions events <sessionId>    Dump the event log

Environment:
  FLAMECAST_URL         Override the API base URL (default: https://flamecast.dev)
  AI_GATEWAY_API_KEY    Required for inline-runtime session create
`

async function requireAuth() {
	const config = await readConfig()
	if (!config?.apiKey) {
		process.stderr.write("Not signed in. Run `flamecast login` first.\n")
		process.exit(1)
	}
	return config
}

export async function dispatch(argv: string[]): Promise<number> {
	const cmd = argv[0]
	switch (cmd) {
		case undefined:
		case "help":
		case "--help":
		case "-h":
			process.stdout.write(USAGE)
			return 0

		case "login": {
			await login()
			return 0
		}

		case "logout": {
			const removed = await clearConfig()
			process.stderr.write(
				removed ? "Signed out.\n" : "No active session.\n",
			)
			return removed ? 0 : 1
		}

		case "whoami": {
			const me = await whoami()
			if (!me.authed) {
				process.stderr.write("Not signed in.\n")
				return 1
			}
			process.stdout.write(`${me.email ?? me.name ?? me.workosUserId}\n`)
			if (me.orgId) process.stdout.write(`org: ${me.orgId}\n`)
			return 0
		}

		case "config": {
			process.stdout.write(`baseUrl: ${configBaseUrl()}\n`)
			process.stdout.write(`config:  ${configPath()}\n`)
			const config = await readConfig()
			process.stdout.write(`status:  ${config?.apiKey ? "signed in" : "signed out"}\n`)
			return 0
		}

		case "agents": {
			const config = await requireAuth()
			const r = await fetch(`${config.baseUrl}/agents`, {
				headers: { authorization: `Bearer ${config.apiKey}` },
			})
			if (!r.ok) {
				process.stderr.write(`list agents: ${r.status} ${r.statusText}\n`)
				return 1
			}
			process.stdout.write(`${JSON.stringify(await r.json(), null, 2)}\n`)
			return 0
		}

		case "sessions": {
			return sessions(argv.slice(1))
		}

		default: {
			process.stderr.write(`Unknown command: ${cmd}\n\n${USAGE}`)
			return 2
		}
	}
}
