// src/utils/providerCatalog/resolveAuth.ts
import { getProviderProfiles } from '../providerProfiles.js'
import type { ProviderCatalogAdapter } from './types.js'

// v1 match is by `profile.provider === adapter.routeId`. That is what the
// in-app `/provider` flow saves (providerUiMetadata sets `provider = routeId`).
// Hand-edited or legacy profiles with `provider:'openai'` + an OpenRouter
// baseUrl will not match here — those users hit the env-var fallback below.
// If the env var also isn't set, the handler emits a clear error naming
// `$OPENROUTER_API_KEY`, so the failure mode is explicit, not silent.
export function resolveApiKey(
  adapter: ProviderCatalogAdapter,
  processEnv: NodeJS.ProcessEnv = process.env,
): string | undefined {
  for (const profile of getProviderProfiles()) {
    if (profile.provider === adapter.routeId && profile.apiKey) {
      return profile.apiKey
    }
  }

  for (const name of adapter.auth.envVars) {
    const value = processEnv[name]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  return undefined
}
