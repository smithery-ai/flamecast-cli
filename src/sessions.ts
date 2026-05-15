/**
 * `flamecast sessions` subcommands: list, create, get, events.
 */
import { readConfig } from "./config.ts"

interface ParsedFlags {
	positional: string[]
	flags: Record<string, string | boolean>
}

function parseFlags(argv: string[]): ParsedFlags {
	const positional: string[] = []
	const flags: Record<string, string | boolean> = {}
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i]
		if (a.startsWith("--")) {
			const key = a.slice(2)
			const next = argv[i + 1]
			if (next && !next.startsWith("--")) {
				flags[key] = next
				i++
			} else {
				flags[key] = true
			}
		} else {
			positional.push(a)
		}
	}
	return { positional, flags }
}

async function authed() {
	const config = await readConfig()
	if (!config?.apiKey) {
		process.stderr.write("Not signed in. Run `flamecast login` first.\n")
		process.exit(1)
	}
	return config
}

function printJson(data: unknown) {
	process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
}

async function list(): Promise<number> {
	const config = await authed()
	const r = await fetch(`${config.baseUrl}/sessions`, {
		headers: { authorization: `Bearer ${config.apiKey}` },
	})
	if (!r.ok) {
		process.stderr.write(`list sessions: ${r.status} ${r.statusText}\n`)
		return 1
	}
	printJson(await r.json())
	return 0
}

async function get(id: string | undefined): Promise<number> {
	if (!id) {
		process.stderr.write("usage: flamecast sessions get <sessionId>\n")
		return 2
	}
	const config = await authed()
	const r = await fetch(`${config.baseUrl}/sessions/${id}`, {
		headers: { authorization: `Bearer ${config.apiKey}` },
	})
	if (r.status === 404) {
		process.stderr.write("session not found\n")
		return 1
	}
	if (!r.ok) {
		process.stderr.write(`get session: ${r.status} ${r.statusText}\n`)
		return 1
	}
	printJson(await r.json())
	return 0
}

async function events(id: string | undefined): Promise<number> {
	if (!id) {
		process.stderr.write("usage: flamecast sessions events <sessionId>\n")
		return 2
	}
	const config = await authed()
	const r = await fetch(
		`${config.baseUrl}/sessions/${id}/events?limit=500`,
		{ headers: { authorization: `Bearer ${config.apiKey}` } },
	)
	if (!r.ok) {
		process.stderr.write(`events: ${r.status} ${r.statusText}\n`)
		return 1
	}
	printJson(await r.json())
	return 0
}

async function create(flags: Record<string, string | boolean>): Promise<number> {
	const input = typeof flags.input === "string" ? flags.input : undefined
	if (!input) {
		process.stderr.write(
			"usage: flamecast sessions create --input <text> [--model <id>] [--agent-id <id>] [--async]\n",
		)
		return 2
	}
	const model = typeof flags.model === "string" ? flags.model : "anthropic/claude-haiku-4-5"
	const agentId = typeof flags["agent-id"] === "string" ? flags["agent-id"] : undefined
	const asyncFlag = flags.async === true || flags.async === "true"
	const gatewayKey = process.env.AI_GATEWAY_API_KEY
	const config = await authed()

	const body: Record<string, unknown> = { input, async: asyncFlag }
	if (agentId) {
		body.agentId = agentId
	} else {
		if (!gatewayKey) {
			process.stderr.write(
				"AI_GATEWAY_API_KEY env var required for inline runtime auth. " +
				"Set it, or use --agent-id to launch a saved agent.\n",
			)
			return 1
		}
		body.agent = {
			runtime: {
				id: "think",
				auth: { type: "api_key", key: gatewayKey },
				config: { model, toolMode: "mcp" },
			},
		}
	}

	const r = await fetch(`${config.baseUrl}/sessions`, {
		method: "POST",
		headers: {
			authorization: `Bearer ${config.apiKey}`,
			"content-type": "application/json",
		},
		body: JSON.stringify(body),
	})
	if (!r.ok) {
		const text = await r.text().catch(() => r.statusText)
		process.stderr.write(`create session: ${r.status} ${text}\n`)
		return 1
	}
	printJson(await r.json())
	return 0
}

const SESSIONS_USAGE = `flamecast sessions <verb>

Verbs:
  list                                List recent sessions
  create --input <text> [--model M]   Launch a Think session
         [--agent-id ID] [--async]
  get <sessionId>                     Show one session
  events <sessionId>                  Dump the event log

Env:
  AI_GATEWAY_API_KEY    Required for inline-runtime create (Think provider auth)
`

export async function sessions(argv: string[]): Promise<number> {
	const { positional, flags } = parseFlags(argv)
	const verb = positional[0] ?? "list"
	switch (verb) {
		case "list":
			return list()
		case "create":
			return create(flags)
		case "get":
			return get(positional[1])
		case "events":
			return events(positional[1])
		case "help":
		case "--help":
		case "-h":
			process.stdout.write(SESSIONS_USAGE)
			return 0
		default:
			process.stderr.write(`Unknown sessions verb: ${verb}\n\n${SESSIONS_USAGE}`)
			return 2
	}
}
