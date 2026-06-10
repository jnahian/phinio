---
name: release
description: Cut a Phinio release — write user-facing CHANGELOG entries, bump package.json + package-lock.json, commit, push main, and create a GitHub Release. Use whenever the user says "release", "ship a release", "cut vX.Y.Z", "release notes", "changelog", or asks to publish a new version. Encodes Phinio's release conventions (Keep a Changelog format, SemVer, gitmoji-stripped prose, `🔖 chore: release vX.Y.Z` commit, GitHub-created tag via `gh release create`). Pauses for explicit user confirmation before any push or release-create step.
---

# Cutting a Phinio Release

This skill turns "we have unreleased commits on main" into "v*X.Y.Z* is published on GitHub." It has two halves:

1. **Author the changelog** — translate raw git history into release notes a real user can read. (The hard, judgment-heavy part.)
2. **Publish** — bump versions, commit, push, create a GitHub Release. (Mechanical, but easy to get wrong on auth/branch boundaries.)

Commit subjects are written for _developers looking back at code_; release notes are written for _users looking forward at the product_. The translation step is what makes this skill valuable — without it you'd be pasting `git log` into a release.

## Before doing anything: ask, don't assume

Two things materially change the output. Ask both before writing, one at a time (per global CLAUDE.md), most critical first. Skip a question if the user already answered it in their prompt.

1. **What commit range should the changelog cover?**
   - All history (first release), or
   - Since a specific tag/commit/date, or
   - Since the last `##` entry in `CHANGELOG.md` (typical for an update — usually `<last-tag>..HEAD`)?

2. **What version number?**
   - Read `package.json` first. If it disagrees with the latest `## [X.Y.Z]` in `CHANGELOG.md`, surface the mismatch — don't silently pick one.
   - Suggest a SemVer bump based on the commits: bugfix-only → patch, new user-visible features → minor, breaking → major. Let the user decide.

## Phase 1 — Write the changelog

### 1a. Read the full commit range

```bash
git log --pretty=format:"%h %s%n%b%n---" <range>
```

Where `<range>` is `main` for a first release, or `<last-tag>..HEAD` / `<since-date>..HEAD` for an update. Read the **entire** output — skimming the first page and extrapolating is how you miss whole features. Commits are often out of narrative order; early commits may be superseded by later ones in the same range.

### 1b. Translate commits into user-facing entries

This is the work. Principles:

- **User-facing means "what can the user now do, or what changed for them."** "Added `computeMonthlyTotal` helper" is developer-facing; "Home dashboard now shows monthly EMI outflow" is user-facing. Rewrite accordingly.
- **Group related commits.** A feature that landed across ten commits ("wip", "fix typo", "refactor part 2", "final tweak") becomes _one_ bullet describing the feature. The reader does not care about the development path.
- **Drop gitmoji prefixes** (✨ 🐛 ♻️ 🚀 🌱 🚨 💄 ♿ 🔖 etc.) in the changelog prose. Useful in `git log`, noisy in release notes.
- **Drop purely internal commits** with no user-visible effect (formatting passes, lint fixes, build-config tweaks, dependency bumps without behavior change, package-lock syncs). Or fold them into a single "Internal" bullet under `### Changed` if you want to acknowledge them without cluttering.
- **Order within a section by impact**, not by commit date. The marquee feature goes first.
- **When a later commit supersedes an earlier one in the same range**, describe the end state, not the journey. If a feature was added then refactored then renamed within the range, the bullet is about what shipped.
- **Treat visual polish as `Changed`**, not `Fixed` (e.g., layout tweaks, donut placement). Reserve `Fixed` for actual bugs.

### 1c. Format — Keep a Changelog + SemVer

```markdown
## [<VERSION>] - <YYYY-MM-DD>

<optional one-paragraph lede describing the release>

### Added

- ...

### Changed

- ...

### Fixed

- ...
```

- Use only the sections that have entries. Keep a Changelog also defines `Deprecated`, `Removed`, and `Security` — include them only if they apply.
- Use today's date (the project uses absolute dates).
- For an update (not first release), prepend the new `## [<VERSION>]` block above the previous one. Do not rewrite prior entries.

### 1d. Save unstaged and report — then STOP

Write the changelog block into `CHANGELOG.md`. Do **not** `git add`, do **not** commit yet — the user needs to eyeball the prose first.

Report back with:

- Entry counts per section.
- Any judgment calls the user should verify — especially commits you folded, dropped, or grouped in non-obvious ways, and any version/`package.json` mismatches.

**Then stop and wait.** If the user only said "/changelog" or "write the changelog", you are done. Only proceed to Phase 2 if the user explicitly asks to release/ship/publish.

## Phase 2 — Publish the release

Trigger phrases for Phase 2: "release", "ship it", "cut vX.Y.Z", "publish", or an explicit "yes, publish/release/push" after the changelog is written.

### 2a. Bump versions

Both files. The v1.7.0 release missed `package-lock.json` — v1.8.0 corrected it; don't repeat the mistake.

```bash
# Edit package.json -> "version": "<NEW>"
# Then sync the lockfile without installing anything new:
npm install --package-lock-only --silent
```

Verify both ended up at the new version: `grep -m2 '"version"' package.json package-lock.json`.

### 2b. Commit

```bash
git add CHANGELOG.md package.json package-lock.json
git commit -m "🔖 chore: release v<NEW>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

The `🔖 chore: release vX.Y.Z` subject matches every prior release in the project (`git log --oneline | grep release`). Don't deviate.

### 2c. Push to main — STOP and confirm first

Pushing to `main` is shared-state and bypasses PR review. Even if the user said "release", **always re-confirm before the push.** Phinio's `main` has a "PRs required" rule that the user is bypassing on these release commits — they need to consciously opt in each time.

In Claude Code's auto mode, the classifier blocks `git push origin main` and `gh release create --target main` on the first attempt with a "Permission denied by auto mode classifier" error. Surface this to the user when it happens — they need to approve the permission prompt, or run the commands themselves with `! git push origin main`.

```bash
git push origin main
```

### 2d. Create the GitHub Release (the tag is created by GitHub)

Phinio's convention is **GitHub-created tags via `gh release create`**, not local `git tag` + push. Pass the changelog block as `--notes` (verbatim — the same Keep-a-Changelog headings render fine in GitHub release notes).

```bash
gh release create v<NEW> \
  --title "v<NEW>" \
  --target main \
  --notes "$(cat <<'EOF'
### Added

- ...

### Changed

- ...

### Fixed

- ...
EOF
)"
```

The auto-mode classifier may block this too, with a similar error citing "creates a tag on main." Same remedy as 2c: ask the user to approve, or have them run it.

`gh release create` prints the release URL on success. Report it back to the user.

## Quick reference — full flow

| Step                                       | Command                                                                 | Notes                                            |
| ------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------ |
| Read commits                               | `git log --pretty=format:"%h %s%n%b%n---" v<PREV>..HEAD`                | Read the whole output                            |
| Edit `CHANGELOG.md`                        | (Edit tool)                                                             | Prepend new `## [VERSION]` block                 |
| **STOP — let user review changelog prose** |                                                                         | Don't proceed until asked                        |
| Bump version                               | Edit `package.json`; `npm install --package-lock-only --silent`         | Both files must move                             |
| Commit                                     | `git commit -m "🔖 chore: release v<NEW>" ...`                          | Co-author trailer per project convention         |
| **STOP — confirm push to main**            |                                                                         | `main` is protected; user must opt in            |
| Push                                       | `git push origin main`                                                  | May need approval prompt                         |
| Release                                    | `gh release create v<NEW> --title "v<NEW>" --target main --notes "..."` | GitHub creates the tag; may need approval prompt |

## Example translation (changelog only)

Raw commits in a range:

```
a1b2c3d ✨ feat: add withdrawal modal
e4f5g6h 🐛 fix: withdrawal modal not closing on escape
i7j8k9l ♻️ refactor: extract WithdrawForm from modal
m0n1o2p 🚀 feat: global Withdraw page with investment picker
q3r4s5t ♻️ refactor: unify withdraw UX behind one shared modal
u6v7w8x 🚨 fix: don't double-count withdrawals in completed-item ROI
y9z0a1b 🌱 chore: seed withdrawal scenarios
```

Translated changelog entries:

```markdown
### Added

- **Withdrawals** — withdraw from any investment via a shared modal or from a
  global Withdraw page with an investment picker. Withdrawal scenarios are
  included in the seed script.

### Fixed

- Completed-item ROI no longer double-counts withdrawals.
```

Seven commits → two bullets. The refactor-toward-unification is invisible to users — they just see "withdrawals work." The ROI fix is separated because it's a distinct user-visible bug.

## Common mistakes

- **Forgetting `package-lock.json`.** v1.7.0 shipped with the lockfile still at the old version. Always run `npm install --package-lock-only` after editing `package.json`.
- **Pasting commit subjects into the changelog.** "✨ feat(dashboard): include upcoming DPS deposits in Home upcoming list" is developer-facing. Rewrite as: "Upcoming DPS deposits on the Home dashboard appear alongside EMI payments."
- **Local `git tag` + `git push --tags`.** Phinio uses `gh release create` so the tag is created by GitHub alongside the Release record. Don't tag locally first — you'll either duplicate or conflict.
- **Skipping the post-changelog review pause.** The prose involves judgment calls (groupings, drops, classifications). The user needs a chance to fix them before they land in a commit.
- **Treating "release" as full authorization to push.** Re-confirm before `git push origin main` and before `gh release create` every time. The auto-mode classifier will block these anyway; surface that clearly when it does.
