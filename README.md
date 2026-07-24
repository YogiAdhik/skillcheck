# skillcheck

Tests for your agent skills.

Skills fail silently. A bad edit to a description and the skill stops
triggering. A reworded instruction and the agent starts doing something
you didn't mean. You find out weeks later, in someone else's session.

skillcheck gives skills what code has had for fifty years: a test suite.

    npx @yogiadhik/skillcheck lint .claude/skills/
    npx @yogiadhik/skillcheck run .claude/skills/commit-helper

`lint` is free and instant: frontmatter problems, weak descriptions
(the description is the only thing the agent reads when deciding to
trigger your skill), token cost, broken relative links, dangerous
patterns. `run` is the real thing: it copies a fixture into a throwaway
workspace, mounts your skill, runs the agent headless, and tells you
what actually happened — which files changed, which commands ran,
whether the skill fired at all.

## writing a test

One YAML file next to your skill. Deterministic checks cost nothing
extra; a judge rubric is there for the fuzzy parts.

    # commit-helper.test.yaml
    skill: commit-helper
    cases:
      - name: writes conventional commit
        prompt: "commit my staged changes"
        setup: fixtures/dirty-repo
        expect:
          files_changed: []
          command_ran: "git commit"
          transcript_matches: "(feat|fix|chore):"
        judge: |
          Did the commit message accurately describe the staged diff?
          Score 0-10.

`skill:` is the path from the test file to the skill directory.
`expect:` supports files_changed, command_ran, transcript_matches and
skill_invoked. `judge:` sends the transcript and your rubric to a cheap
model; pass is 7/10 by default (set judge_pass to change it).

Run `npx @yogiadhik/skillcheck init <skill-dir>` to scaffold a starter file.

## cost

Behavioral runs call the real agent, and that costs real money.
skillcheck caches results by content hash — unchanged skill, unchanged
case, no re-run — and `--budget 2.50` hard-stops a run at the cap.
Lint never spends anything.

## CI

    - uses: YogiAdhik/skillcheck/action@v0.1.0
      with:
        path: .claude/skills

That runs lint with GitHub annotations on every pull request. For
behavioral runs in CI, call `npx @yogiadhik/skillcheck run` yourself in a job that
has your agent authenticated; keep a budget flag on it.

## a note on safety

`run` executes the agent with permission prompts disabled, inside a
throwaway temp directory. That's the point — but it means fixtures
should be copies, never live data, and skills you don't trust should be
linted, not run.

## adapters

Claude Code today. An adapter is a name and one function that takes a
prompt plus a working directory and returns a transcript; if you want
Codex or Gemini support, `src/adapters/` is where it goes and I'll take
the pull request.

MIT.
