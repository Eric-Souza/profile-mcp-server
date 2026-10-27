import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { TtlCache } from '../src/cache.js'
import { loadConfig } from '../src/config.js'

describe('TtlCache', () => {
  it('reuses a value until it expires', async () => {
    let now = 0
    const cache = new TtlCache(1000, () => now)
    const load = vi.fn(async () => now)
    expect(await cache.get('k', load)).toBe(0)
    now = 999
    expect(await cache.get('k', load)).toBe(0)
    now = 1000
    expect(await cache.get('k', load)).toBe(1000)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it("doesn't cache failures", async () => {
    const cache = new TtlCache(1000)
    await expect(cache.get('k', async () => Promise.reject(new Error('down')))).rejects.toThrow('down')
    expect(await cache.get('k', async () => 'up')).toBe('up')
  })
})

describe('loadConfig', () => {
  it('resolves the experience path from the repo, not the working directory', () => {
    const config = loadConfig({ PROFILE_EXPERIENCE_PATH: 'data/experience.local.json' })
    expect(config.experiencePath).toBe(resolve(__dirname, '..', 'data', 'experience.local.json'))
    expect(loadConfig({}).experiencePath).toBe(resolve(__dirname, '..', 'data', 'experience.json'))
    expect(loadConfig({}).githubToken).toBeUndefined()
  })
})
