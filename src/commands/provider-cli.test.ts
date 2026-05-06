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
