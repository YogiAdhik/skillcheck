import { spawn } from 'node:child_process'
import { parseStreamJson, type Transcript } from '../transcript.js'
import type { Adapter, RunOptions } from './types.js'

export function buildArgs(opts: RunOptions): string[] {
  const args = [
    '-p',
    opts.prompt,
    '--output-format',
    'stream-json',
    '--verbose',
    '--dangerously-skip-permissions',
    '--max-turns',
    String(opts.maxTurns ?? 30),
  ]
  if (opts.model) args.push('--model', opts.model)
  return args
}

export const claudeCode: Adapter = {
  name: 'claude-code',
  run(opts: RunOptions): Promise<Transcript> {
    return new Promise((done, fail) => {
      const child = spawn('claude', buildArgs(opts), {
        cwd: opts.cwd,
        env: process.env,
        detached: process.platform !== 'win32',
      })
      let out = ''
      let err = ''
      const timeoutMs = opts.timeoutMs ?? 300_000
      const timer = setTimeout(() => {
        if (process.platform === 'win32') {
          child.kill('SIGKILL')
        } else {
          try {
            process.kill(-child.pid!, 'SIGKILL')
          } catch {
            child.kill('SIGKILL')
          }
        }
        fail(new Error(`agent run timed out after ${Math.round(timeoutMs / 1000)}s`))
      }, timeoutMs)
      child.stdout.on('data', (d) => (out += d))
      child.stderr.on('data', (d) => (err += d))
      child.on('error', (e) => {
        clearTimeout(timer)
        fail(e)
      })
      child.on('close', (code) => {
        clearTimeout(timer)
        if (code !== 0 && !out.trim()) return fail(new Error(`claude exited ${code}: ${err.slice(0, 500)}`))
        done(parseStreamJson(out))
      })
    })
  },
}
