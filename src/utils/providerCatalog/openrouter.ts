// src/utils/providerCatalog/openrouter.ts
import gatewayOpenrouter from '../../integrations/gateways/openrouter.js'
import type {
  ProviderCatalogAdapter,
  SummaryRow,
} from './types.js'

const ENDPOINT = 'https://openrouter.ai/api/v1/models'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export const openrouterAdapter: ProviderCatalogAdapter = {
  id: 'openrouter',
  routeId: 'openrouter',
  endpoint: ENDPOINT,
  auth: {
    required: false,
    scheme: 'bearer',
    envVars:
      gatewayOpenrouter.setup.credentialEnvVars ?? ['OPENROUTER_API_KEY'],
  },
  fetch: async ({ apiKey, signal }) => {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`
    }
    const response = await globalThis.fetch(ENDPOINT, { headers, signal })
    if (!response.ok) {
      throw new Error(
        `openrouter /models returned HTTP ${response.status} ${response.statusText}`,
      )
    }
    return await response.json()
  },
  toSummary: (raw: unknown): SummaryRow[] => {
    const wrapper = asRecord(raw)
    const data = wrapper && Array.isArray(wrapper.data) ? wrapper.data : []
    const rows: SummaryRow[] = []
    for (const entry of data) {
      const m = asRecord(entry)
      if (!m) continue
      const id = asString(m.id)
      if (!id) continue
      const pricingRecord = asRecord(m.pricing)
      const pricing = pricingRecord
        ? {
            prompt: asString(pricingRecord.prompt),
            completion: asString(pricingRecord.completion),
          }
        : undefined
      rows.push({
        id,
        name: asString(m.name) ?? id,
        contextLength: asFiniteNumber(m.context_length),
        pricing,
      })
    }
    rows.sort((a, b) => a.id.localeCompare(b.id))
    return rows
  },
}
