import { openrouterAdapter } from './openrouter.js'
import type { ProviderCatalogAdapter } from './types.js'

const ADAPTERS: Record<string, ProviderCatalogAdapter> = {
  [openrouterAdapter.id]: openrouterAdapter,
}

export function getAdapter(id: string): ProviderCatalogAdapter | null {
  return ADAPTERS[id] ?? null
}

export function listAdapterIds(): string[] {
  return Object.keys(ADAPTERS).sort()
}

export type {
  ProviderCatalogAdapter,
  SummaryRow,
  CatalogEnvelope,
} from './types.js'
export { ENVELOPE_VERSION } from './types.js'
