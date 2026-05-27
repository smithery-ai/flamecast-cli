import { Command, Options, Args } from "@effect/cli"
import { Effect, Console, Option } from "effect"
import {
	agentsList,
	agentsCreate,
	agentsUpdate,
} from "@flamecast/sdk"
import type {
	CreateAgentBody,
	AgentConfig,
	AgentMeta,
	UpdateAgentBody,
} from "@flamecast/sdk"
import { authedClient } from "./sdk-client.ts"
import { configBaseUrl, readConfig } from "./config.ts"

const DEFAULT_MODEL = "anthropic/claude-opus-4-7"
const DEFAULT_HARNESS = "think" as const

function printJson(data: unknown) {
	process.stdout.write(`${JSON.stringify(data, null, 2)}\n`)
}

// --- agents list ---

const listCmd = Command.make("list").pipe(
	Command.withDescription("List agents"),
	Command.withHandler(() =>
		Effect.tryPromise({
			try: async () => {
				const client = await authedClient()
				const { data, error } = await agentsList({ client })
				if (error) throw new Error(`list agents: ${JSON.stringify(error)}`)
				printJson(data)
			},
			catch: (e) => e as Error,
		})
	),
)

// --- agents create ---

const createCmd = Command.make("create", {
	name: Options.text("name").pipe(Options.withDescription("Agent name")),
	system: Options.text("system").pipe(
		Options.withDescription("System prompt"),
		Options.optional,
	),
	model: Options.text("model").pipe(
		Options.withDescription("Model identifier"),
		Options.withDefault(DEFAULT_MODEL),
	),
	config: Options.text("config").pipe(
		Options.withDescription("Path to JSON config file"),
		Options.optional,
	),
}).pipe(
	Command.withDescription("Create an agent"),
	Command.withHandler(({ name, system, model, config: configOpt }) =>
		Effect.tryPromise({
			try: async () => {
				const configPath = Option.getOrUndefined(configOpt)
				const systemText = Option.getOrUndefined(system)

				let agent: AgentConfig
				if (configPath) {
					const raw = await Bun.file(configPath).text()
					agent = JSON.parse(raw) as AgentConfig
				} else {
					agent = { harness: DEFAULT_HARNESS, model }
					if (systemText) agent.system = systemText
				}

				const body: CreateAgentBody = { name, agent }
				const client = await authedClient()
				const { data, error } = await agentsCreate({ client, body })
				if (error) throw new Error(`create agent: ${JSON.stringify(error)}`)
				const meta = data as AgentMeta
				process.stdout.write(`${meta.id}  ${meta.name}\n`)
			},
			catch: (e) => e as Error,
		})
	),
)

// --- agents update ---

const updateCmd = Command.make("update", {
	agentId: Args.text({ name: "agentId" }),
	name: Options.text("name").pipe(
		Options.withDescription("New agent name"),
		Options.optional,
	),
	system: Options.text("system").pipe(
		Options.withDescription("System prompt"),
		Options.optional,
	),
	model: Options.text("model").pipe(
		Options.withDescription("Model identifier"),
		Options.optional,
	),
	config: Options.text("config").pipe(
		Options.withDescription("Path to JSON config file"),
		Options.optional,
	),
}).pipe(
	Command.withDescription("Update an agent"),
	Command.withHandler(({ agentId, name: nameOpt, system: systemOpt, model: modelOpt, config: configOpt }) =>
		Effect.tryPromise({
			try: async () => {
				const name = Option.getOrUndefined(nameOpt)
				const system = Option.getOrUndefined(systemOpt)
				const model = Option.getOrUndefined(modelOpt)
				const configPath = Option.getOrUndefined(configOpt)

				const body: UpdateAgentBody = {}
				if (name) body.name = name

				if (configPath) {
					const raw = await Bun.file(configPath).text()
					body.agent = JSON.parse(raw) as UpdateAgentBody["agent"]
				} else if (system || model) {
					const patch: Record<string, unknown> = {}
					if (system) patch.system = system
					if (model) patch.model = model
					body.agent = patch as UpdateAgentBody["agent"]
				}

				if (!body.name && !body.agent) {
					throw new Error("nothing to update (pass --name, --system, --model, or --config)")
				}

				const client = await authedClient()
				const { data, error } = await agentsUpdate({
					client,
					path: { id: agentId },
					body,
				})
				if (error) throw new Error(`update agent: ${JSON.stringify(error)}`)
				const meta = data as AgentMeta
				process.stdout.write(`updated ${meta.id}  ${meta.name}\n`)
			},
			catch: (e) => e as Error,
		})
	),
)

// --- agents skills upload ---

const skillsUploadCmd = Command.make("upload", {
	agentId: Args.text({ name: "agentId" }),
	skillName: Args.text({ name: "name" }),
	skillPath: Args.text({ name: "path" }),
}).pipe(
	Command.withDescription("Upload a skill bundle"),
	Command.withHandler(({ agentId, skillName, skillPath }) =>
		Effect.tryPromise({
			try: async () => {
				const config = await readConfig()
				if (!config?.apiKey) throw new Error("Not signed in. Run `flamecast login` first.")
				const baseUrl = config.baseUrl ?? configBaseUrl()

				const fs = await import("node:fs/promises")
				const pathStat = await fs.stat(skillPath)

				if (pathStat.isFile()) {
					const content = await Bun.file(skillPath).text()
					const fileName = skillPath.split("/").pop() ?? "SKILL.md"
					const body = { files: { [fileName]: content } }
					const r = await fetch(
						`${baseUrl}/agents/${agentId}/skills/${skillName}`,
						{
							method: "PUT",
							headers: {
								"content-type": "application/json",
								authorization: `Bearer ${config.apiKey}`,
							},
							body: JSON.stringify(body),
						},
					)
					if (!r.ok) {
						const text = await r.text()
						throw new Error(`upload skill: ${r.status} ${text}`)
					}
					process.stdout.write(`uploaded skill "${skillName}" (1 file)\n`)
					return
				}

				const path = await import("node:path")
				const files: Record<string, string> = {}

				async function walk(dir: string, prefix: string) {
					const entries = await fs.readdir(dir, { withFileTypes: true })
					for (const entry of entries) {
						const fullPath = path.join(dir, entry.name)
						const relPath = prefix ? `${prefix}/${entry.name}` : entry.name
						if (entry.isDirectory()) {
							await walk(fullPath, relPath)
						} else {
							const content = await Bun.file(fullPath).text()
							files[relPath] = content
						}
					}
				}

				await walk(skillPath, "")
				const fileCount = Object.keys(files).length
				if (fileCount === 0) throw new Error(`no files found in ${skillPath}`)

				const r = await fetch(
					`${baseUrl}/agents/${agentId}/skills/${skillName}`,
					{
						method: "PUT",
						headers: {
							"content-type": "application/json",
							authorization: `Bearer ${config.apiKey}`,
						},
						body: JSON.stringify({ files }),
					},
				)
				if (!r.ok) {
					const text = await r.text()
					throw new Error(`upload skill: ${r.status} ${text}`)
				}
				process.stdout.write(`uploaded skill "${skillName}" (${fileCount} files)\n`)
			},
			catch: (e) => e as Error,
		})
	),
)

const skillsCmd = Command.make("skills").pipe(
	Command.withDescription("Manage agent skills"),
	Command.withSubcommands([skillsUploadCmd]),
)

// --- agents (parent) ---

export const agentsCmd = Command.make("agents").pipe(
	Command.withDescription("Manage agents"),
	Command.withSubcommands([listCmd, createCmd, updateCmd, skillsCmd]),
)
