import { describe, expect, test } from 'bun:test'
import { resetTestGlobalConfig } from './config'

// NOTE: providerProfiles.test.ts uses mock.module('./config.js', …) which
// is sticky for the rest of the bun:test process (mock.restore does not
// undo module mocks in bun:test 1.3.11). The "clears mutations" test
// below cache-busts the import to get a fresh, unmocked module instance;
// the "throws when not in test mode" test does not depend on global
// state so it runs against the canonical (possibly-mocked) module fine.

describe('resetTestGlobalConfig', () => {
  test('clears mutations made in test mode', async () => {
    // Cache-bust the import to get a fresh ./config.js module instance,
    // bypassing any sticky mock.module('./config.js', …) left by sibling
    // test files (notably providerProfiles.test.ts). Bun:test does not
    // undo module mocks via mock.restore(), so we work around by routing
    // through a different specifier the mock wasn't registered against.
    const fresh = await import(`./config.js?fresh=${Date.now()}-${Math.random()}`)

    fresh.saveGlobalConfig((c: any) => ({ ...c, activeProviderProfileId: 'temp-id' }))
    expect(fresh.getGlobalConfig().activeProviderProfileId).toBe('temp-id')

    fresh.resetTestGlobalConfig()
    expect(fresh.getGlobalConfig().activeProviderProfileId).toBeUndefined()
  })

  test('throws when called outside NODE_ENV=test', () => {
    const original = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      expect(() => resetTestGlobalConfig()).toThrow(/NODE_ENV/)
    } finally {
      process.env.NODE_ENV = original
    }
  })
})
