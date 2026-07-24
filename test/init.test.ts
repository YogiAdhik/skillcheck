import { cp, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { initTestFile } from '../src/init.js'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'skillcheck-init-'))
  await cp('test/fixtures/good-skill', join(dir, 'good-skill'), { recursive: true })
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('init', () => {
  test('scaffolds a starter test file', async () => {
    const out = initTestFile(join(dir, 'good-skill'))
    const text = await readFile(out, 'utf8')
    expect(out.endsWith(join('tests', 'good-skill.test.yaml'))).toBe(true)
    expect(text).toContain('skill: ..')
    expect(text).toContain('skill_invoked: true')
  })

  test('refuses to overwrite', () => {
    initTestFile(join(dir, 'good-skill'))
    expect(() => initTestFile(join(dir, 'good-skill'))).toThrow('already exists')
  })
})
