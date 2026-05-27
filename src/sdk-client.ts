import { createClient, createConfig, type ClientOptions } from "@flamecast/sdk/client"
import { readConfig, configBaseUrl } from "./config.ts"

export async function authedClient() {
	const config = await readConfig()
	if (!config?.apiKey) {
		process.stderr.write("Not signed in. Run `flamecast login` first.\n")
		process.exit(1)
	}
	const baseUrl = config.baseUrl ?? configBaseUrl()
	return createClient(createConfig<ClientOptions>({
		baseUrl,
		headers: { authorization: `Bearer ${config.apiKey}` },
	}))
}
