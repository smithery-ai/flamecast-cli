import { Command } from "@effect/cli"
import { BunContext } from "@effect/platform-bun"
import { Effect } from "effect"
import { login } from "./auth.ts"
import { clearConfig, configBaseUrl, configPath, readConfig } from "./config.ts"
import { whoami } from "./whoami.ts"
import { agentsCmd } from "./agents.ts"
import { sessionsCmd } from "./sessions.ts"
import { integrationsCmd } from "./integrations.ts"

// --- login ---

const loginCmd = Command.make("login").pipe(
	Command.withDescription("Sign in via your browser"),
	Command.withHandler(() =>
		Effect.tryPromise({
			try: () => login(),
			catch: (e) => e as Error,
		}).pipe(Effect.asVoid)
	),
)

// --- logout ---

const logoutCmd = Command.make("logout").pipe(
	Command.withDescription("Clear the local API key"),
	Command.withHandler(() =>
		Effect.tryPromise({
			try: async () => {
				const removed = await clearConfig()
				process.stderr.write(
					removed ? "Signed out.\n" : "No active session.\n",
				)
			},
			catch: (e) => e as Error,
		})
	),
)

// --- whoami ---

const whoamiCmd = Command.make("whoami").pipe(
	Command.withDescription("Print the authed identity"),
	Command.withHandler(() =>
		Effect.tryPromise({
			try: async () => {
				const me = await whoami()
				if (!me.authed) {
					process.stderr.write("Not signed in.\n")
					return
				}
				process.stdout.write(`${me.email ?? me.name ?? me.workosUserId}\n`)
				if (me.orgId) process.stdout.write(`org: ${me.orgId}\n`)
			},
			catch: (e) => e as Error,
		})
	),
)

// --- config ---

const configCmd = Command.make("config").pipe(
	Command.withDescription("Show config file and base URL"),
	Command.withHandler(() =>
		Effect.tryPromise({
			try: async () => {
				process.stdout.write(`baseUrl: ${configBaseUrl()}\n`)
				process.stdout.write(`config:  ${configPath()}\n`)
				const config = await readConfig()
				process.stdout.write(`status:  ${config?.apiKey ? "signed in" : "signed out"}\n`)
			},
			catch: (e) => e as Error,
		})
	),
)

// --- top-level command ---

const flamecast = Command.make("flamecast").pipe(
	Command.withDescription("Programmable cloud agents"),
	Command.withSubcommands([
		loginCmd,
		logoutCmd,
		whoamiCmd,
		configCmd,
		agentsCmd,
		sessionsCmd,
		integrationsCmd,
	]),
)

const cli = Command.run(flamecast, {
	name: "flamecast",
	version: "0.3.0",
})

export const run = cli(process.argv).pipe(
	Effect.provide(BunContext.layer),
)
