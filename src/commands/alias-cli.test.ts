import { describe, expect, test, beforeEach } from 'bun:test'
import { runAliasAdd, runAliasRm, runAliasList } from './alias-cli.js'
import { addProviderProfile, addAlias } from '../utils/providerProfiles.js'
import { resetTestGlobalConfig } from '../utils/config.js'

// File-level reset of in-memory global config between every test.
beforeEach(() => {
  resetTestGlobalConfig()
})

describe('runAliasAdd', () => {
  let stdoutBuf: string
  let stderrBuf: string
  let exitCode: number | null

  beforeEach(() => {
    // Per-describe: reset only the I/O capture state.
    stdoutBuf = ''
    stderrBuf = ''
    exitCode = null
  })

  const io = () => ({
    stdout: (s: string) => { stdoutBuf += s },
    stderr: (s: string) => { stderrBuf += s },
    exit: (code: number) => { exitCode = code },
  })

  test('adds alias and prints confirmation', () => {
    addProviderProfile({
      provider: 'openai',
      name: 'OR',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-5-mini',
      apiKey: 'sk-or-x',
    })

    runAliasAdd('gemini-flash', 'google/gemini-3-flash-preview', io())
    expect(stdoutBuf).toMatch(/added/i)
    expect(stdoutBuf).toContain('gemini-flash')
    expect(exitCode).toBeNull()
  })

  test('errors and exits non-zero when no active profile', () => {
    runAliasAdd('foo', 'bar', io())
    expect(stderrBuf).toMatch(/no active provider profile/i)
    expect(exitCode).toBe(1)
  })

  test('errors on invalid alias name', () => {
    addProviderProfile({
      provider: 'openai',
      name: 'OR',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-5-mini',
      apiKey: 'sk-or-x',
    })
    runAliasAdd('bad name', 'a/b', io())
    expect(stderrBuf).toMatch(/invalid alias name/i)
    expect(exitCode).toBe(1)
  })
})

describe('runAliasList', () => {
  let stdoutBuf: string
  beforeEach(() => { stdoutBuf = '' })
  const io = () => ({
    stdout: (s: string) => { stdoutBuf += s },
    stderr: () => {},
    exit: () => {},
  })

  test('plain text output, alphabetized', () => {
    addProviderProfile({
      provider: 'openai',
      name: 'OR',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-5-mini',
      apiKey: 'sk-or-x',
    })
    addAlias('opus-47', 'anthropic/claude-opus-4.7')
    addAlias('alpha', 'a/b')
    runAliasList({ json: false }, io())
    const lines = stdoutBuf.trim().split('\n')
    expect(lines[0]).toContain('alpha')
    expect(lines[1]).toContain('opus-47')
  })

  test('--json output is parseable', () => {
    addProviderProfile({
      provider: 'openai',
      name: 'OR',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-5-mini',
      apiKey: 'sk-or-x',
    })
    addAlias('m', 'a/b')
    runAliasList({ json: true }, io())
    const parsed = JSON.parse(stdoutBuf)
    expect(parsed).toEqual([{ name: 'm', model: 'a/b' }])
  })
})

describe('runAliasRm', () => {
  let stdoutBuf: string
  let stderrBuf: string
  beforeEach(() => { stdoutBuf = ''; stderrBuf = '' })
  const io = () => ({
    stdout: (s: string) => { stdoutBuf += s },
    stderr: (s: string) => { stderrBuf += s },
    exit: () => {},
  })

  test('removes existing alias', () => {
    addProviderProfile({
      provider: 'openai',
      name: 'OR',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-5-mini',
      apiKey: 'sk-or-x',
    })
    addAlias('m', 'a/b')
    runAliasRm('m', io())
    expect(stdoutBuf).toMatch(/removed/i)
  })

  test('reports no-op for missing alias on stderr (exit 0)', () => {
    addProviderProfile({
      provider: 'openai',
      name: 'OR',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-5-mini',
      apiKey: 'sk-or-x',
    })
    runAliasRm('nope', io())
    expect(stderrBuf).toMatch(/no alias named/i)
  })
})
