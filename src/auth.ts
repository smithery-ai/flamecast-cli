/**
 * Device-flow login. Mirrors the Smithery CLI handshake:
 *   POST /api/auth/cli/session     → { sessionId, authUrl }
 *   GET  /api/auth/cli/poll/:id    → pending | success(apiKey, organization)
 *
 * Bun's built-in fetch + a 2s poll loop. No external deps.
 */
import { configBaseUrl, writeConfig, type FlamecastConfig } from "./config.ts"

const POLL_INTERVAL_MS = 2000
const TIMEOUT_MS = 5 * 60 * 1000

interface SessionResponse {
	sessionId: string
	authUrl: string
}

type PollResponse =
	| { status: "pending" }
	| { status: "success"; apiKey: string; organization?: { id: string } }
	| { status: "error"; message: string }

async function createSession(baseUrl: string): Promise<SessionResponse> {
	const r = await fetch(`${baseUrl}/api/auth/cli/session`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({}),
	})
	if (!r.ok) throw new Error(`session create: ${r.status} ${r.statusText}`)
	return (await r.json()) as SessionResponse
}

async function poll(baseUrl: string, sessionId: string): Promise<PollResponse> {
	const r = await fetch(`${baseUrl}/api/auth/cli/poll/${sessionId}`)
	if (r.status === 404) {
		return { status: "error", message: "session expired" }
	}
	if (!r.ok) {
		return { status: "error", message: `poll: ${r.status} ${r.statusText}` }
	}
	return (await r.json()) as PollResponse
}

async function openBrowser(url: string): Promise<void> {
	const platform = process.platform
	const cmd =
		platform === "darwin" ? ["open", url] :
		platform === "win32" ? ["cmd", "/c", "start", "", url] :
		["xdg-open", url]
	try {
		const proc = Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" })
		await proc.exited
	} catch {
		// Browser open is best-effort; URL is already printed.
	}
}

export async function login(): Promise<FlamecastConfig> {
	const baseUrl = configBaseUrl()
	process.stderr.write("Preparing authentication…\n")
	const session = await createSession(baseUrl)
	process.stderr.write("\nSign in to authorize the Flamecast CLI:\n")
	process.stderr.write(`  ${session.authUrl}\n\n`)
	await openBrowser(session.authUrl)

	const deadline = Date.now() + TIMEOUT_MS
	let dots = 0
	while (Date.now() < deadline) {
		const result = await poll(baseUrl, session.sessionId)
		if (result.status === "success") {
			process.stderr.write("\nAuthorized.\n")
			const config: FlamecastConfig = {
				baseUrl,
				apiKey: result.apiKey,
				organization: result.organization,
				updatedAt: new Date().toISOString(),
			}
			await writeConfig(config)
			return config
		}
		if (result.status === "error") {
			throw new Error(`Authentication failed: ${result.message}`)
		}
		dots = (dots + 1) % 4
		process.stderr.write(`\rWaiting for authorization${".".repeat(dots).padEnd(3)}`)
		await Bun.sleep(POLL_INTERVAL_MS)
	}
	throw new Error("Authentication timed out after 5 minutes. Re-run `flamecast login`.")
}
