// src/utils/providerCatalog/resolveAuth.test.ts
//
// File-level note: providerProfiles.test.ts uses mock.module('./config.js', …)
// which is sticky for the rest of the bun:test process. We use
// resetTestGlobalConfig() in beforeEach and avoid module mocks. If a sibling
// file pollutes the global-config mock, prefer making tests state-independent
// over chasing the mock.
//
// Profile-shape note: tests below use `provider: 'openrouter'` (the route id)
// because that is what the in-app `/provider` flow saves —
// `providerUiMetadata.ts` sets `profile.provider = route.routeId`. The
// alias-cli.test.ts fixture uses `provider: 'openai'` with an OpenRouter
// baseUrl as a test convenience, not the real UI shape.
import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { resolveApiKey } from './resolveAuth.js'
import {
  addProviderProfile,
} from '../providerProfiles.js'
import { resetTestGlobalConfig } from '../config.js'
import type { ProviderCatalogAdapter } from './types.js'

const baseAdapter: ProviderCatalogAdapter = {
  id: 'openrouter',
  routeId: 'openrouter',
  endpoint: 'https://example/v1/models',
  auth: {
    required: false,
    scheme: 'bearer',
    envVars: ['OPENROUTER_API_KEY'],
  },
  fetch: async () => ({}),
  toSummary: () => [],
}

describe('resolveApiKey', () => {
  let originalEnv: string | undefined

  beforeEach(() => {
    resetTestGlobalConfig()
    originalEnv = process.env.OPENROUTER_API_KEY
    delete process.env.OPENROUTER_API_KEY
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.OPENROUTER_API_KEY
    } else {
      process.env.OPENROUTER_API_KEY = originalEnv
    }
  })

  test('returns the apiKey of the first saved profile with matching routeId', () => {
    addProviderProfile({
      provider: 'openrouter',
      name: 'OR',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-5-mini',
      apiKey: 'sk-or-profile',
    })
    expect(resolveApiKey(baseAdapter)).toBe('sk-or-profile')
  })

  test('falls back to env var when no matching profile is saved', () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-env'
    expect(resolveApiKey(baseAdapter)).toBe('sk-or-env')
  })

  test('returns undefined when neither profile nor env var is set', () => {
    expect(resolveApiKey(baseAdapter)).toBeUndefined()
  })

  test('profile takes priority over env var', () => {
    process.env.OPENROUTER_API_KEY = 'sk-or-env'
    addProviderProfile({
      provider: 'openrouter',
      name: 'OR',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-5-mini',
      apiKey: 'sk-or-profile',
    })
    expect(resolveApiKey(baseAdapter)).toBe('sk-or-profile')
  })

  test('ignores profiles whose provider does not match adapter.routeId', () => {
    addProviderProfile({
      provider: 'openai',
      name: 'OAI',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o',
      apiKey: 'sk-oai',
    })
    expect(resolveApiKey(baseAdapter)).toBeUndefined()
  })
})
