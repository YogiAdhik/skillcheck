import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { ResultCache, hashInputs } from '../src/cache.js'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'skillcheck-cache-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('cache', () => {
  test('hash changes when skill content changes', async () => {
    const skill = join(dir, 'skill')
    await rm(skill, { recursive: true, force: true })
    const { mkdir } = await import('node:fs/promises')
    await mkdir(skill)
    await writeFile(join(skill, 'SKILL.md'), 'v1')
    const h1 = hashInputs(skill, 'case: a')
    await writeFile(join(skill, 'SKILL.md'), 'v2')
    const h2 = hashInputs(skill, 'case: a')
    const h3 = hashInputs(skill, 'case: b')
    expect(h1).not.toBe(h2)
    expect(h2).not.toBe(h3)
  })

  test('round-trips values and survives reload', () => {
    const path = join(dir, 'nested', 'cache.json')
    const c1 = new ResultCache(path)
    expect(c1.get('k')).toBeUndefined()
    c1.set('k', { pass: true })
    const c2 = new ResultCache(path)
    expect(c2.get('k')).toEqual({ pass: true })
  })
})
