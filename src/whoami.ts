/**
 * Calls /auth/me on the configured base URL using the stored API key.
 * Used by `flamecast whoami` and as a probe before mutating commands.
 */
import { readConfig } from "./config.ts"

export interface WhoamiResult {
	authed: boolean
	email?: string | null
	name?: string | null
	workosUserId?: string
	orgId?: string
}

export async function whoami(): Promise<WhoamiResult> {
	const config = await readConfig()
	if (!config?.apiKey) return { authed: false }
	const r = await fetch(`${config.baseUrl}/auth/me`, {
		headers: { authorization: `Bearer ${config.apiKey}` },
	})
	if (!r.ok) return { authed: false }
	return (await r.json()) as WhoamiResult
}
