import type { Transcript } from '../transcript.js'

export interface RunOptions {
  prompt: string
  cwd: string
  model?: string
  maxTurns?: number
  timeoutMs?: number
}

export interface Adapter {
  name: string
  run(opts: RunOptions): Promise<Transcript>
}
