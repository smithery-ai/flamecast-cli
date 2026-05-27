import { Command, Options, Args } from "@effect/cli"
import { Effect, Option } from "effect"
import {
	sessionsList,
	sessionsCreate,
	sessionsGet,
	eventsBySession,
} from "@flamecast/sdk"
import { authedClient } from "./sdk-client.ts"

function printJson(data: unknown) {
	process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
}

// --- sessions list ---

const listCmd = Command.make("list").pipe(
	Command.withDescription("List recent sessions"),
	Command.withHandler(() =>
		Effect.tryPromise({
			try: async () => {
				const client = await authedClient()
				const { data, error } = await sessionsList({ client })
				if (error) throw new Error(`list sessions: ${JSON.stringify(error)}`)
				printJson(data)
			},
			catch: (e) => e as Error,
		})
	),
)

// --- sessions create ---

const createCmd = Command.make("create", {
	input: Options.text("input").pipe(Options.withDescription("Message text")),
	config: Options.text("config").pipe(
		Options.withDescription("Path to JSON config file"),
		Options.optional,
	),
	model: Options.text("model").pipe(
		Options.withDescription("Model identifier"),
		Options.withDefault("anthropic/claude-opus-4-7"),
	),
	agentId: Options.text("agent-id").pipe(
		Options.withDescription("Existing agent ID"),
		Options.optional,
	),
	async: Options.boolean("async").pipe(
		Options.withDescription("Run asynchronously"),
	),
}).pipe(
	Command.withDescription("Launch a Think session"),
	Command.withHandler(({ input, config: configOpt, model, agentId: agentIdOpt, async: asyncFlag }) =>
		Effect.tryPromise({
			try: async () => {
				const configPath = Option.getOrUndefined(configOpt)
				const agentId = Option.getOrUndefined(agentIdOpt)
				const gatewayKey = process.env.AI_GATEWAY_API_KEY

				if (configPath && agentId) {
					throw new Error("--config and --agent-id are mutually exclusive")
				}

				const body: Record<string, unknown> = { input, async: asyncFlag }
				if (agentId) {
					body.agentId = agentId
				} else if (configPath) {
					let parsed: unknown
					const raw = await Bun.file(configPath).text()
					parsed = JSON.parse(raw)
					if (!parsed || typeof parsed !== "object" || !("runtime" in parsed)) {
						throw new Error(`--config ${configPath}: missing top-level "runtime"`)
					}
					const agentSpec = parsed as Record<string, unknown>
					const runtime = agentSpec.runtime as Record<string, unknown> | undefined
					if (runtime && gatewayKey && !("auth" in runtime)) {
						runtime.auth = { type: "api_key", key: gatewayKey }
					}
					body.agent = agentSpec
				} else {
					const runtime: Record<string, unknown> = {
						id: "think",
						config: { model, toolMode: "mcp" },
					}
					if (gatewayKey) {
						runtime.auth = { type: "api_key", key: gatewayKey }
					}
					body.agent = { runtime }
				}

				const client = await authedClient()
				const { data, error } = await sessionsCreate({
					client,
					body: body as never,
				})
				if (error) throw new Error(`create session: ${JSON.stringify(error)}`)
				printJson(data)
			},
			catch: (e) => e as Error,
		})
	),
)

// --- sessions get ---

const getCmd = Command.make("get", {
	sessionId: Args.text({ name: "sessionId" }),
}).pipe(
	Command.withDescription("Show one session"),
	Command.withHandler(({ sessionId }) =>
		Effect.tryPromise({
			try: async () => {
				const client = await authedClient()
				const { data, error } = await sessionsGet({ client, path: { id: sessionId } })
				if (error) throw new Error(`get session: ${JSON.stringify(error)}`)
				printJson(data)
			},
			catch: (e) => e as Error,
		})
	),
)

// --- sessions events ---

const eventsCmd = Command.make("events", {
	sessionId: Args.text({ name: "sessionId" }),
}).pipe(
	Command.withDescription("Dump the event log"),
	Command.withHandler(({ sessionId }) =>
		Effect.tryPromise({
			try: async () => {
				const client = await authedClient()
				const { data, error } = await eventsBySession({
					client,
					path: { id: sessionId },
					query: { limit: "500" },
				})
				if (error) throw new Error(`events: ${JSON.stringify(error)}`)
				printJson(data)
			},
			catch: (e) => e as Error,
		})
	),
)

// --- sessions (parent) ---

export const sessionsCmd = Command.make("sessions").pipe(
	Command.withDescription("Manage sessions"),
	Command.withSubcommands([listCmd, createCmd, getCmd, eventsCmd]),
)
