/**
 * Local credential store. Plain JSON at $XDG_CONFIG_HOME/flamecast/config.json
 * (falling back to ~/.config/flamecast/config.json). Same shape Stripe and
 * gh use — a single file with the active profile, easy to inspect and rm.
 */
import { mkdir } from "node:fs/promises"
import { homedir } from "node:os"
import { dirname, join } from "node:path"

export interface FlamecastConfig {
	baseUrl: string
	apiKey?: string
	organization?: { id: string }
	updatedAt: string
}

const DEFAULT_BASE_URL = "https://api.flamecast.dev"

export function configBaseUrl(): string {
	return process.env.FLAMECAST_URL ?? DEFAULT_BASE_URL
}

export function configPath(): string {
	const xdg = process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config")
	return join(xdg, "flamecast", "config.json")
}

export async function readConfig(): Promise<FlamecastConfig | null> {
	const path = configPath()
	const file = Bun.file(path)
	if (!(await file.exists())) return null
	try {
		return (await file.json()) as FlamecastConfig
	} catch {
		return null
	}
}

export async function writeConfig(config: FlamecastConfig): Promise<void> {
	const path = configPath()
	await mkdir(dirname(path), { recursive: true })
	await Bun.write(path, `${JSON.stringify(config, null, 2)}\n`)
}

export async function clearConfig(): Promise<boolean> {
	const path = configPath()
	const file = Bun.file(path)
	if (!(await file.exists())) return false
	await Bun.write(path, "")
	// Bun.write with empty string truncates but leaves the file. Remove
	// fully so a stale empty config can't confuse readConfig.
	const fs = await import("node:fs/promises")
	await fs.unlink(path).catch(() => undefined)
	return true
}
