// src/commands/provider-cli.test.ts
//
// File-level note: providerProfiles.test.ts uses mock.module('./config.js', …)
// which is sticky for the rest of the bun:test process (mock.restore does not
// undo module mocks in bun:test). Tests below depend on real config behavior,
// so we use resetTestGlobalConfig() in beforeEach and avoid module mocks.
// If a sibling file pollutes the global-config mock, write tests here to be
// state-independent rather than chasing the mock.
import { describe, expect, test, beforeEach, afterEach, mock } from 'bun:test'
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { runProviderUpdate, runProviderList } from './provider-cli.js'
import { resetTestGlobalConfig } from '../utils/config.js'

type Captured = {
  stdoutBuf: string
  stderrBuf: string
  exitCode: number | null
}

function makeIO(c: Captured) {
  return {
    stdout: (s: string) => { c.stdoutBuf += s },
    stderr: (s: string) => { c.stderrBuf += s },
    exit: (code: number) => { c.exitCode = code },
  }
}

describe('runProviderUpdate', () => {
  let dir: string
  let originalConfigDir: string | undefined
  let originalEnvKey: string | undefined
  let originalFetch: typeof globalThis.fetch
  let captured: Captured

  beforeEach(() => {
    resetTestGlobalConfig()
    originalConfigDir = process.env.CLAUDE_CONFIG_DIR
    originalEnvKey = process.env.OPENROUTER_API_KEY
    delete process.env.OPENROUTER_API_KEY
    dir = mkdtempSync(join(tmpdir(), 'oc-cat-'))
    process.env.CLAUDE_CONFIG_DIR = dir
    originalFetch = globalThis.fetch
    captured = { stdoutBuf: '', stderrBuf: '', exitCode: null }
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    if (originalConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
    else process.env.CLAUDE_CONFIG_DIR = originalConfigDir
    if (originalEnvKey === undefined) delete process.env.OPENROUTER_API_KEY
    else process.env.OPENROUTER_API_KEY = originalEnvKey
    rmSync(dir, { recursive: true, force: true })
  })

  test('writes envelope and prints summary on success', async () => {
    globalThis.fetch = mock(async () =>
      new Response(
        JSON.stringify({
          data: [
            { id: 'a/b', name: 'A B', context_length: 1000 },
            { id: 'c/d', name: 'C D', context_length: 2000 },
          ],
        }),
        { status: 200 },
      ),
    ) as typeof globalThis.fetch

    await runProviderUpdate('openrouter', makeIO(captured))

    const path = join(dir, 'providers', 'openrouter.json')
    expect(existsSync(path)).toBe(true)
    const written = JSON.parse(readFileSync(path, 'utf-8'))
    expect(written.version).toBe(1)
    expect(written.provider).toBe('openrouter')
    expect(written.endpoint).toBe('https://openrouter.ai/api/v1/models')
    expect(written.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    expect(written.raw.data).toHaveLength(2)

    expect(captured.stdoutBuf).toMatch(/Saved 2 models/)
    expect(captured.stdoutBuf).toContain(path)
    expect(captured.exitCode).toBeNull()
  })

  test('errors and exits 1 on unknown adapter id', async () => {
    await runProviderUpdate('does-not-exist', makeIO(captured))
    expect(captured.stderrBuf).toMatch(/unknown provider/i)
    expect(captured.stderrBuf).toMatch(/openrouter/) // lists known ids
    expect(captured.exitCode).toBe(1)
  })

  test('errors and exits 1 on non-2xx response', async () => {
    globalThis.fetch = mock(async () =>
      new Response('upstream boom', { status: 503 }),
    ) as typeof globalThis.fetch

    await runProviderUpdate('openrouter', makeIO(captured))
    expect(captured.stderrBuf).toMatch(/503/)
    expect(captured.exitCode).toBe(1)
  })

  test('errors and exits 1 when fetch throws (network failure)', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('ECONNREFUSED')
    }) as typeof globalThis.fetch

    await runProviderUpdate('openrouter', makeIO(captured))
    expect(captured.stderrBuf).toMatch(/ECONNREFUSED/)
    expect(captured.exitCode).toBe(1)
  })
})

describe('runProviderList', () => {
  let dir: string
  let originalConfigDir: string | undefined
  let captured: Captured

  beforeEach(() => {
    resetTestGlobalConfig()
    originalConfigDir = process.env.CLAUDE_CONFIG_DIR
    dir = mkdtempSync(join(tmpdir(), 'oc-cat-'))
    process.env.CLAUDE_CONFIG_DIR = dir
    captured = { stdoutBuf: '', stderrBuf: '', exitCode: null }
  })

  afterEach(() => {
    if (originalConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
    else process.env.CLAUDE_CONFIG_DIR = originalConfigDir
    rmSync(dir, { recursive: true, force: true })
  })

  function seedCatalog() {
    mkdirSync(join(dir, 'providers'), { recursive: true })
    const envelope = {
      version: 1,
      provider: 'openrouter',
      endpoint: 'https://openrouter.ai/api/v1/models',
      fetchedAt: '2026-05-06T00:00:00.000Z',
      raw: {
        data: [
          {
            id: 'zzz/last',
            name: 'Z Last',
            context_length: 100,
            pricing: { prompt: '0.001', completion: '0.002' },
          },
          {
            id: 'aaa/first',
            name: 'A First',
            context_length: 200,
            pricing: { prompt: '0.000005', completion: '0.00003' },
          },
        ],
      },
    }
    writeFileSync(
      join(dir, 'providers', 'openrouter.json'),
      JSON.stringify(envelope),
      'utf-8',
    )
  }

  test('default text output is alphabetized and has 3 tab-separated columns', async () => {
    seedCatalog()
    await runProviderList('openrouter', {}, makeIO(captured))
    const lines = captured.stdoutBuf.trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe('aaa/first\tA First\t200')
    expect(lines[1]).toBe('zzz/last\tZ Last\t100')
    expect(captured.exitCode).toBeNull()
  })

  test('--full appends two pricing columns', async () => {
    seedCatalog()
    await runProviderList('openrouter', { full: true }, makeIO(captured))
    const lines = captured.stdoutBuf.trim().split('\n')
    expect(lines[0]).toBe('aaa/first\tA First\t200\t0.000005\t0.00003')
    expect(lines[1]).toBe('zzz/last\tZ Last\t100\t0.001\t0.002')
  })

  test('--json prints the raw response verbatim', async () => {
    seedCatalog()
    await runProviderList('openrouter', { json: true }, makeIO(captured))
    const parsed = JSON.parse(captured.stdoutBuf)
    expect(parsed.data).toHaveLength(2)
    expect(parsed.data[0].id).toBe('zzz/last') // raw is unsorted by design
  })

  test('missing file → friendly stdout, exit 0', async () => {
    await runProviderList('openrouter', {}, makeIO(captured))
    expect(captured.stdoutBuf).toMatch(/no catalog yet/i)
    expect(captured.stdoutBuf).toMatch(/openclaude provider update openrouter/)
    expect(captured.exitCode).toBeNull()
  })

  test('unknown adapter → stderr + exit 1', async () => {
    await runProviderList('nope', {}, makeIO(captured))
    expect(captured.stderrBuf).toMatch(/unknown provider/i)
    expect(captured.exitCode).toBe(1)
  })

  test('wrong envelope version → stderr + exit 1', async () => {
    mkdirSync(join(dir, 'providers'), { recursive: true })
    writeFileSync(
      join(dir, 'providers', 'openrouter.json'),
      JSON.stringify({ version: 999, provider: 'openrouter', raw: {} }),
      'utf-8',
    )
    await runProviderList('openrouter', {}, makeIO(captured))
    expect(captured.stderrBuf).toMatch(/version/i)
    expect(captured.exitCode).toBe(1)
  })

  test('corrupt JSON → stderr + exit 1', async () => {
    mkdirSync(join(dir, 'providers'), { recursive: true })
    writeFileSync(
      join(dir, 'providers', 'openrouter.json'),
      '{not valid',
      'utf-8',
    )
    await runProviderList('openrouter', {}, makeIO(captured))
    expect(captured.stderrBuf).toMatch(/parse/i)
    expect(captured.exitCode).toBe(1)
  })
})
