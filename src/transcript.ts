export interface ToolCall {
  name: string
  input: Record<string, unknown>
}

export interface RunResult {
  costUsd: number
  numTurns: number
  isError: boolean
}

export interface Transcript {
  messages: string[]
  toolCalls: ToolCall[]
  commands: string[]
  result?: RunResult
}

export function parseStreamJson(output: string): Transcript {
  const t: Transcript = { messages: [], toolCalls: [], commands: [] }
  for (const line of output.split('\n')) {
    if (!line.trim().startsWith('{')) continue
    let event: any
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }
    if (event.type === 'assistant') {
      for (const block of event.message?.content ?? []) {
        if (block.type === 'text' && block.text) t.messages.push(block.text)
        if (block.type === 'tool_use' && typeof block.name === 'string') {
          const call: ToolCall = { name: block.name, input: block.input ?? {} }
          t.toolCalls.push(call)
          if (call.name === 'Bash' && typeof call.input.command === 'string')
            t.commands.push(call.input.command)
        }
      }
    }
    if (event.type === 'result') {
      t.result = {
        costUsd: event.total_cost_usd ?? 0,
        numTurns: event.num_turns ?? 0,
        isError: !!event.is_error,
      }
    }
  }
  return t
}
