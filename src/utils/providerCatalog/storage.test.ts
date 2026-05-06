// src/utils/providerCatalog/storage.test.ts
import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, readFileSync, statSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  ENVELOPE_VERSION,
  type CatalogEnvelope,
} from './types.js'
import {
  getProviderCatalogPath,
  saveCatalog,
  loadCatalog,
} from './storage.js'

describe('provider catalog storage', () => {
  let originalConfigDir: string | undefined
  let dir: string

  beforeEach(() => {
    originalConfigDir = process.env.CLAUDE_CONFIG_DIR
    dir = mkdtempSync(join(tmpdir(), 'oc-cat-'))
    process.env.CLAUDE_CONFIG_DIR = dir
  })

  afterEach(() => {
    if (originalConfigDir === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR
    } else {
      process.env.CLAUDE_CONFIG_DIR = originalConfigDir
    }
    rmSync(dir, { recursive: true, force: true })
  })

  test('getProviderCatalogPath returns ~/.openclaude/providers/<id>.json', () => {
    const path = getProviderCatalogPath('openrouter')
    expect(path).toBe(join(dir, 'providers', 'openrouter.json'))
  })

  test('saveCatalog writes the envelope, loadCatalog round-trips it', async () => {
    const envelope: CatalogEnvelope = {
      version: ENVELOPE_VERSION,
      provider: 'openrouter',
      endpoint: 'https://example/api/v1/models',
      fetchedAt: '2026-05-06T00:00:00.000Z',
      raw: { data: [{ id: 'a/b', name: 'A B' }] },
    }
    const written = await saveCatalog('openrouter', envelope)
    expect(written).toBe(getProviderCatalogPath('openrouter'))

    const onDisk = JSON.parse(readFileSync(written, 'utf-8'))
    expect(onDisk).toEqual(envelope)

    const loaded = await loadCatalog('openrouter')
    expect(loaded).toEqual(envelope)
  })

  test('saveCatalog writes file with mode 0o600', async () => {
    const envelope: CatalogEnvelope = {
      version: ENVELOPE_VERSION,
      provider: 'openrouter',
      endpoint: 'https://example',
      fetchedAt: '2026-05-06T00:00:00.000Z',
      raw: {},
    }
    const path = await saveCatalog('openrouter', envelope)
    const mode = statSync(path).mode & 0o777
    expect(mode).toBe(0o600)
  })

  test('loadCatalog returns null when file is missing', async () => {
    const loaded = await loadCatalog('openrouter')
    expect(loaded).toBeNull()
  })

  test('loadCatalog throws on corrupt JSON', async () => {
    const { writeFileSync, mkdirSync } = await import('fs')
    mkdirSync(join(dir, 'providers'), { recursive: true })
    writeFileSync(join(dir, 'providers', 'openrouter.json'), 'not json{', 'utf-8')
    await expect(loadCatalog('openrouter')).rejects.toThrow(/parse/i)
  })

  test('loadCatalog throws on structurally invalid envelope', async () => {
    const { writeFileSync, mkdirSync } = await import('fs')
    mkdirSync(join(dir, 'providers'), { recursive: true })
    // version present, but other required envelope fields missing
    writeFileSync(
      join(dir, 'providers', 'openrouter.json'),
      JSON.stringify({ version: 1 }),
      'utf-8',
    )
    await expect(loadCatalog('openrouter')).rejects.toThrow(/corrupt catalog/i)
  })
})
