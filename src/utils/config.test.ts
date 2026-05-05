import { describe, expect, test } from 'bun:test'
import { resetTestGlobalConfig, saveGlobalConfig, getGlobalConfig } from './config'

describe('resetTestGlobalConfig', () => {
  test('clears mutations made in test mode', () => {
    saveGlobalConfig(c => ({ ...c, activeProviderProfileId: 'temp-id' }))
    expect(getGlobalConfig().activeProviderProfileId).toBe('temp-id')

    resetTestGlobalConfig()
    expect(getGlobalConfig().activeProviderProfileId).toBeUndefined()
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
