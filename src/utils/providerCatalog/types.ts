// src/utils/providerCatalog/types.ts

export const ENVELOPE_VERSION = 1 as const

export type SummaryRow = {
  id: string
  name: string
  contextLength: number | null
  pricing?: {
    prompt?: string
    completion?: string
  }
}

export type CatalogEnvelope = {
  version: typeof ENVELOPE_VERSION
  provider: string
  endpoint: string
  fetchedAt: string // ISO-8601
  raw: unknown
}

export type ProviderCatalogAdapter = {
  id: string
  routeId: string
  endpoint: string
  auth: {
    required: boolean
    scheme: 'bearer' | 'x-api-key' | 'query'
    envVars: readonly string[]
  }
  fetch: (opts: { apiKey?: string; signal: AbortSignal }) => Promise<unknown>
  toSummary: (raw: unknown) => SummaryRow[]
}
