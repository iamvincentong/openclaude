// src/utils/providerCatalog/openrouter.test.ts
import { describe, expect, test } from 'bun:test'
import { openrouterAdapter } from './openrouter.js'

describe('openrouterAdapter.toSummary', () => {
  test('flattens response and sorts by id', () => {
    const raw = {
      data: [
        {
          id: 'openai/gpt-chat-latest',
          name: 'OpenAI: GPT Chat Latest',
          context_length: 400000,
          pricing: { prompt: '0.000005', completion: '0.00003' },
        },
        {
          id: 'baidu/cobuddy:free',
          name: 'Baidu Qianfan: CoBuddy (free)',
          context_length: 131072,
          pricing: { prompt: '0', completion: '0' },
        },
      ],
    }

    const rows = openrouterAdapter.toSummary(raw)
    expect(rows).toHaveLength(2)
    expect(rows[0]!.id).toBe('baidu/cobuddy:free')
    expect(rows[0]!.name).toBe('Baidu Qianfan: CoBuddy (free)')
    expect(rows[0]!.contextLength).toBe(131072)
    expect(rows[0]!.pricing).toEqual({ prompt: '0', completion: '0' })
    expect(rows[1]!.id).toBe('openai/gpt-chat-latest')
    expect(rows[1]!.contextLength).toBe(400000)
  })

  test('falls back to id when name is missing', () => {
    const raw = { data: [{ id: 'a/b' }] }
    const rows = openrouterAdapter.toSummary(raw)
    expect(rows[0]!.name).toBe('a/b')
  })

  test('drops entries without an id', () => {
    const raw = { data: [{ name: 'no id here' }, { id: 'real/model' }] }
    const rows = openrouterAdapter.toSummary(raw)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.id).toBe('real/model')
  })

  test('returns empty array when data is missing', () => {
    expect(openrouterAdapter.toSummary({})).toEqual([])
    expect(openrouterAdapter.toSummary(null)).toEqual([])
  })

  test('sets contextLength to null when not numeric', () => {
    const raw = { data: [{ id: 'a/b', context_length: 'not-a-number' }] }
    const rows = openrouterAdapter.toSummary(raw)
    expect(rows[0]!.contextLength).toBeNull()
  })
})

describe('openrouterAdapter metadata', () => {
  test('endpoint targets the public models route', () => {
    expect(openrouterAdapter.endpoint).toBe('https://openrouter.ai/api/v1/models')
  })

  test('auth is not required (public endpoint)', () => {
    expect(openrouterAdapter.auth.required).toBe(false)
  })

  test('declares OPENROUTER_API_KEY among env vars', () => {
    expect(openrouterAdapter.auth.envVars).toContain('OPENROUTER_API_KEY')
  })

  test('routeId is openrouter (matches integration registry)', () => {
    expect(openrouterAdapter.routeId).toBe('openrouter')
  })
})
