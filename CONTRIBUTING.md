# contributing

Glad you're here. Ground rules are short.

## what I'm most interested in

- **Adapters.** Codex, Gemini, anything that runs headless. An adapter
  is one object with a name and a `run()` — look at
  `src/adapters/claude-code.ts` and its tests. This is the single most
  useful thing you could add.
- **Lint rules that caught something real.** Tell me what they caught
  and where. Rules invented in the abstract tend to produce noise.
- **Bug fixes with a failing test.** The test is the bug report.

## before you open a PR

- `npm test` must pass. It runs offline — no API key, no spend.
- One change per PR. A fix and a feature are two PRs.
- Match what's here: plain TypeScript, no new dependencies without a
  strong case (it took real convincing for the three that exist),
  comments only where the code can't speak for itself.
- Tests go next to the existing ones and assert real behavior. If your
  change touches the adapter or runner, the fake-adapter and PATH-shim
  patterns in `test/` show how to test without spending money.
- CI runs your PR on Linux and Windows. Windows failures are real
  failures — that leg has caught genuine bugs twice already.

## what happens next

I read every PR. Small and focused merges fast; large and sprawling
sits until I have a free evening, so prefer small. If I push back it's
about the change, not about you.

If you're not sure whether something fits, open an issue first and ask
— cheaper for both of us than a PR that misses.
