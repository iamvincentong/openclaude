// src/utils/providerCatalog/storage.ts
import { open } from 'fs/promises'
import { randomBytes } from 'crypto'
import { join } from 'path'
import { getClaudeConfigHomeDir } from '../envUtils.js'
import { getFsImplementation } from '../fsOperations.js'
import { logError } from '../log.js'
import { jsonParse, jsonStringify } from '../slowOperations.js'
import {
  ENVELOPE_VERSION,
  type CatalogEnvelope,
} from './types.js'

const PROVIDERS_DIRNAME = 'providers'

function isValidEnvelope(value: unknown): value is CatalogEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const v = value as Record<string, unknown>
  if (typeof v.version !== 'number' || !Number.isFinite(v.version)) return false
  if (typeof v.provider !== 'string' || v.provider.length === 0) return false
  if (typeof v.endpoint !== 'string' || v.endpoint.length === 0) return false
  if (typeof v.fetchedAt !== 'string' || v.fetchedAt.length === 0) return false
  if (!('raw' in v)) return false
  return true
}

export function getProvidersDir(): string {
  return join(getClaudeConfigHomeDir(), PROVIDERS_DIRNAME)
}

export function getProviderCatalogPath(adapterId: string): string {
  return join(getProvidersDir(), `${adapterId}.json`)
}

export async function saveCatalog(
  adapterId: string,
  envelope: CatalogEnvelope,
): Promise<string> {
  const fs = getFsImplementation()
  const dir = getProvidersDir()
  const finalPath = getProviderCatalogPath(adapterId)
  const tempPath = `${finalPath}.${randomBytes(8).toString('hex')}.tmp`

  try {
    await fs.mkdir(dir)

    const content = jsonStringify(envelope, null, 2)
    const handle = await open(tempPath, 'w', 0o600)
    try {
      await handle.writeFile(content, { encoding: 'utf-8' })
      await handle.sync()
    } finally {
      await handle.close()
    }

    await fs.rename(tempPath, finalPath)
  } catch (error) {
    logError(error)
    try {
      await fs.unlink(tempPath)
    } catch {
      // Ignore cleanup errors.
    }
    throw error
  }

  return finalPath
}

export async function loadCatalog(
  adapterId: string,
): Promise<CatalogEnvelope | null> {
  const fs = getFsImplementation()
  const path = getProviderCatalogPath(adapterId)

  if (!fs.existsSync(path)) {
    return null
  }

  const content = await fs.readFile(path, { encoding: 'utf-8' })
  let parsed: unknown
  try {
    parsed = jsonParse(content)
  } catch (err) {
    throw new Error(`failed to parse catalog at ${path}: ${(err as Error).message}`)
  }

  if (!isValidEnvelope(parsed)) {
    throw new Error(`corrupt catalog at ${path}: missing or invalid envelope fields (version contract violation)`)
  }
  return parsed
}

export { ENVELOPE_VERSION }
