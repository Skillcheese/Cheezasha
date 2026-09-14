---
name: release
description: Commit and push all pending changes, merge any open PRs, then wait for release-please to open its release PR and merge it once checks pass. Use when the user types /release or asks to "cut a release" / "ship a release".
---

# Release

Land pending work on `main`, then get release-please's release PR through CI and merged.

Rules: `git pull --rebase` (never merge), never force-push/skip hooks/`--no-verify`, no time
estimates. Never `git add -A`/`.` — stage files by name.

## Steps

1. `git status`, then `git pull --rebase origin main`.
2. If the tree is dirty: review the diff, stage relevant files by name, commit (why, not what).
   Skip if clean. Don't run `npm run build:dev` — `dist/` is gitignored, built by CI.
3. `git push origin main`.
4. `gh pr list` — merge any non-release PRs with green checks via `gh pr merge <n> --squash`.
   Skip/ask about anything red or unrelated-looking. Leave any `chore(main): release X.Y.Z` PR
   for step 5.
5. Wait for the release PR, then merge it. Do not use the Monitor tool, and do not use shell
   polling loops (`until`/`while` with `sleep`, backgrounded or not) — both have failed to catch
   the release PR becoming ready. Instead, poll with single one-shot checks spaced 30 seconds
   apart, issuing a fresh `Bash` or `ScheduleWakeup` call each time rather than looping inside one
   shell invocation:
    - Check for the PR: run `gh pr list --search "chore(main): release" --json number -q
'.[0].number'` once. If empty, wait 30 seconds (a single `sleep 30` call, no loop) and check
      again. Repeat until a number comes back.
    - Check its status: run `gh pr checks <n>` once. If any check shows `pending`, wait 30 seconds
      and check again. Repeat until none are pending.
    - A failed check means stop and fix the root cause — don't merge past it, don't skip it.
    - Merge with `gh pr merge <n> --squash` once green. This triggers the version-sync + release
      build/publish workflows.
6. `git pull --rebase origin main`. Report the release version, `gh release view` link, and
   anything that needed manual fixing.

## Guardrails

Ambiguous state (unexpected PRs, unclear failing checks, unrelated uncommitted files) → stop and
ask, don't push through.
