// src/commands/provider-cli.ts
import {
  getAdapter,
  listAdapterIds,
  ENVELOPE_VERSION,
  type CatalogEnvelope,
  type ProviderCatalogAdapter,
} from '../utils/providerCatalog/index.js'
import { resolveApiKey } from '../utils/providerCatalog/resolveAuth.js'
import {
  saveCatalog,
  loadCatalog,
  getProviderCatalogPath,
} from '../utils/providerCatalog/storage.js'

const FETCH_TIMEOUT_MS = 15_000

export type ProviderCliIO = {
  stdout: (s: string) => void
  stderr: (s: string) => void
  exit: (code: number) => void
}

const realIO: ProviderCliIO = {
  stdout: s => process.stdout.write(s),
  stderr: s => process.stderr.write(s),
  exit: code => process.exit(code),
}

function unknownAdapterError(id: string): string {
  const known = listAdapterIds().join(', ')
  return `error: unknown provider "${id}". known: ${known}\n`
}

function requireAdapter(
  id: string,
  io: ProviderCliIO,
): ProviderCatalogAdapter | null {
  const adapter = getAdapter(id)
  if (!adapter) {
    io.stderr(unknownAdapterError(id))
    io.exit(1)
    return null
  }
  return adapter
}

export async function runProviderUpdate(
  id: string,
  io: ProviderCliIO = realIO,
): Promise<void> {
  const adapter = requireAdapter(id, io)
  if (!adapter) return

  const apiKey = resolveApiKey(adapter)
  if (adapter.auth.required && !apiKey) {
    const envList = adapter.auth.envVars.map(n => `$${n}`).join(' or ')
    io.stderr(
      `error: no API key found for "${id}". set ${envList} or save a profile via /provider in-app.\n`,
    )
    io.exit(1)
    return
  }

  io.stdout(`Fetching ${id} catalog…\n`)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  let raw: unknown
  try {
    raw = await adapter.fetch({ apiKey, signal: controller.signal })
  } catch (err) {
    io.stderr(`error: fetch failed: ${(err as Error).message}\n`)
    io.exit(1)
    return
  } finally {
    clearTimeout(timeout)
  }

  const envelope: CatalogEnvelope = {
    version: ENVELOPE_VERSION,
    provider: adapter.id,
    endpoint: adapter.endpoint,
    fetchedAt: new Date().toISOString(),
    raw,
  }

  let savedPath: string
  try {
    savedPath = await saveCatalog(adapter.id, envelope)
  } catch (err) {
    io.stderr(`error: failed to save catalog: ${(err as Error).message}\n`)
    io.exit(1)
    return
  }

  const count = adapter.toSummary(raw).length
  io.stdout(`Saved ${count} models → ${savedPath}\n`)
}

export async function runProviderList(
  id: string,
  opts: { full?: boolean; json?: boolean },
  io: ProviderCliIO = realIO,
): Promise<void> {
  const adapter = requireAdapter(id, io)
  if (!adapter) return

  let envelope: CatalogEnvelope | null
  try {
    envelope = await loadCatalog(adapter.id)
  } catch (err) {
    io.stderr(`error: ${(err as Error).message}\n`)
    io.exit(1)
    return
  }

  if (!envelope) {
    io.stdout(
      `(no catalog yet — run: openclaude provider update ${adapter.id})\n`,
    )
    return
  }

  if (envelope.version !== ENVELOPE_VERSION) {
    io.stderr(
      `error: catalog format version ${String(envelope.version)} unsupported (expected ${ENVELOPE_VERSION}). re-run: openclaude provider update ${adapter.id}\n`,
    )
    io.exit(1)
    return
  }

  if (opts.json) {
    io.stdout(JSON.stringify(envelope.raw, null, 2) + '\n')
    return
  }

  const rows = adapter.toSummary(envelope.raw)
  for (const row of rows) {
    const cols = [
      row.id,
      row.name,
      row.contextLength === null ? '' : String(row.contextLength),
    ]
    if (opts.full) {
      cols.push(row.pricing?.prompt ?? '')
      cols.push(row.pricing?.completion ?? '')
    }
    io.stdout(cols.join('\t') + '\n')
  }
}
