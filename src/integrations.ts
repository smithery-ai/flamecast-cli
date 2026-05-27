import { Command, Options, Args } from "@effect/cli"
import { Effect, Option } from "effect"
import {
	agentsGet,
	integrationsInstall,
	integrationsStatus,
	integrationsUninstall,
} from "@flamecast/sdk"
import { authedClient } from "./sdk-client.ts"

type Provider = "telegram" | "slack" | "discord" | "github" | "linear" | "whatsapp" | "messenger"

const VALID_PROVIDERS = new Set<string>([
	"telegram", "slack", "discord", "github", "linear", "whatsapp", "messenger",
])

function printJson(data: unknown) {
	process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
}

function validateProvider(raw: string): Provider {
	if (!VALID_PROVIDERS.has(raw)) {
		throw new Error(
			`invalid provider "${raw}". valid: ${[...VALID_PROVIDERS].join(", ")}`,
		)
	}
	return raw as Provider
}

// --- integrations install ---

const installCmd = Command.make("install", {
	agentId: Args.text({ name: "agentId" }),
	providerRaw: Args.text({ name: "provider" }),
	botToken: Options.text("bot-token").pipe(
		Options.withDescription("Bot token (required for telegram)"),
		Options.optional,
	),
}).pipe(
	Command.withDescription("Install an integration"),
	Command.withHandler(({ agentId, providerRaw, botToken: botTokenOpt }) =>
		Effect.tryPromise({
			try: async () => {
				const provider = validateProvider(providerRaw)
				const client = await authedClient()

				// Pre-flight: verify the agent has a model configured
				const { data: agent, error: agentErr } = await agentsGet({
					client,
					path: { id: agentId },
				})
				if (agentErr) throw new Error(`agent ${agentId}: ${JSON.stringify(agentErr)}`)
				const spec = (agent as { agent?: { model?: string } })?.agent
				if (!spec?.model) {
					throw new Error(
						`agent ${agentId} has no model configured. Run:\n  flamecast agents update ${agentId} --model anthropic/claude-opus-4-7`,
					)
				}

				const body: Record<string, unknown> = {}
				if (provider === "telegram") {
					const botToken = Option.getOrUndefined(botTokenOpt)
					if (!botToken) throw new Error("telegram requires --bot-token <token>")
					body.botToken = botToken
				}

				const { data, error } = await integrationsInstall({
					client,
					path: { id: agentId, provider },
					body,
				})
				if (error) throw new Error(`install integration: ${JSON.stringify(error)}`)
				printJson(data)
			},
			catch: (e) => e as Error,
		})
	),
)

// --- integrations status ---

const statusCmd = Command.make("status", {
	agentId: Args.text({ name: "agentId" }),
	providerRaw: Args.text({ name: "provider" }),
}).pipe(
	Command.withDescription("Check integration status"),
	Command.withHandler(({ agentId, providerRaw }) =>
		Effect.tryPromise({
			try: async () => {
				const provider = validateProvider(providerRaw)
				const client = await authedClient()
				const { data, error } = await integrationsStatus({
					client,
					path: { id: agentId, provider },
				})
				if (error) throw new Error(`integration status: ${JSON.stringify(error)}`)
				printJson(data)
			},
			catch: (e) => e as Error,
		})
	),
)

// --- integrations remove ---

const removeCmd = Command.make("remove", {
	agentId: Args.text({ name: "agentId" }),
	providerRaw: Args.text({ name: "provider" }),
}).pipe(
	Command.withDescription("Remove an integration"),
	Command.withHandler(({ agentId, providerRaw }) =>
		Effect.tryPromise({
			try: async () => {
				const provider = validateProvider(providerRaw)
				const client = await authedClient()
				const { data, error } = await integrationsUninstall({
					client,
					path: { id: agentId, provider },
				})
				if (error) throw new Error(`remove integration: ${JSON.stringify(error)}`)
				printJson(data)
			},
			catch: (e) => e as Error,
		})
	),
)

// --- integrations (parent) ---

export const integrationsCmd = Command.make("integrations").pipe(
	Command.withDescription("Manage integrations (telegram, slack, discord, github, linear, whatsapp, messenger)"),
	Command.withSubcommands([installCmd, statusCmd, removeCmd]),
)
