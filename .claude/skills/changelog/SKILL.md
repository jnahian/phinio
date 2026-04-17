---
name: changelog
description: Write or update CHANGELOG.md for the Phinio project. Use whenever the user mentions changelog, release notes, "what changed", preparing a release, or wants to document recent commits for users. Encodes Phinio's release-notes conventions — Keep a Changelog format, SemVer, user-facing prose (not raw commit subjects), gitmoji prefixes stripped. Works in an isolated git worktree so main-branch history is read cleanly without disturbing the current branch.
---

# Writing the Phinio CHANGELOG

The goal of this workflow is to turn raw git history into a release-notes document a real user can read and understand. Commit subjects are written for *developers looking back at code* — a changelog is written for *users looking forward at the product*. These are different audiences, and the translation step is what makes the output valuable.

This skill exists because that translation has conventions specific to Phinio (format, grouping rules, gitmoji handling, worktree workflow) that would be tedious to re-derive every time.

## Before writing: ask, don't assume

Two things materially change the output, and guessing wrong wastes a full rewrite. Ask both before doing anything else. Ask them one at a time (per this project's global CLAUDE.md), most critical first:

1. **What commit range should the changelog cover?**
   - All history (first release), or
   - Since a specific tag/commit/date, or
   - Since the last `##` entry already in `CHANGELOG.md` (for an update rather than a fresh file)?

2. **What version number?**
   - Check `package.json` first and suggest that as the default. If it disagrees with any existing `CHANGELOG.md`, surface the mismatch rather than silently picking one.
   - If this is clearly a bugfix-only batch, suggest a patch bump; if new user-visible features, minor; if breaking, major. But let the user decide — they know what they're shipping.

If the user has already answered these in their prompt, skip the question.

## Workflow

### 1. Set up an isolated worktree

Use a **native git worktree** at a sibling path (not inside `.claude/`, not inside the repo). This keeps the current branch's uncommitted work untouched while you read and write against `main`.

```bash
git worktree add -b changelog/v<VERSION> ../phinio-changelog main
```

If `../phinio-changelog` already exists from a prior run, either `git worktree remove` it first (confirm with the user — it may have uncommitted changes) or pick a new suffix like `../phinio-changelog-v1-1-0`.

All file reads and writes for the rest of the workflow happen inside that worktree.

### 2. Read the full commit range

```bash
git -C ../phinio-changelog log --pretty=format:"%h %s%n%b%n---" <range>
```

Where `<range>` is `main` for a first release, or `<last-tag>..main` / `<since-date>..main` for an update. Read the **entire** output — skimming the first page and extrapolating is how you miss whole features. Commits are often out of narrative order; early commits may be superseded by later ones in the same range.

### 3. Translate commits into user-facing entries

This is the work. Some principles:

- **User-facing means "what can the user now do, or what changed for them."** "Added `computeMonthlyTotal` helper" is developer-facing. "Home dashboard now shows monthly EMI outflow" is user-facing. Rewrite accordingly.
- **Group related commits.** A feature that landed across ten commits ("wip", "fix typo", "refactor part 2", "final tweak") becomes *one* bullet describing the feature. The reader does not care about the development path.
- **Drop gitmoji prefixes** (✨ 🐛 ♻️ 🚀 🌱 🚨 etc.) in the changelog prose. They're useful in `git log`, noisy in release notes.
- **Drop purely internal commits** with no user-visible effect (formatting passes, lint fixes, build config tweaks, dependency bumps without behavior change). Or fold them into a single "Internal" bullet under `### Changed` if you want to acknowledge them without cluttering.
- **Order within a section by impact**, not by commit date. The marquee feature goes first.
- **When a later commit supersedes an earlier one in the same range**, describe the end state, not the journey. If a feature was added then refactored then renamed within the range, the bullet is about what shipped — not "added X, then changed it to Y."

### 4. Format — Keep a Changelog + SemVer

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- For an **update** (not first release), prepend the new `## [<VERSION>]` block above the previous one. Do not rewrite prior entries.

### 5. Leave the file unstaged for review

Write the file. Do **not** `git add`, do **not** commit. The user needs to review the prose — the rewrites from commit subjects to user-facing items involve judgment calls they should eyeball before it lands.

Report back with:
- Worktree path and branch name.
- Entry counts per section.
- Any judgment calls the user should verify — especially commits you folded, dropped, or grouped in non-obvious ways, and any version/package.json mismatches.

### 6. (Optional) Clean up

The worktree stays around until the user decides what to do — merge the branch, cherry-pick the file, or discard. Don't auto-remove it. Mention in the final report how to remove it when they're done:

```bash
git worktree remove ../phinio-changelog
```

## Example translation

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

Seven commits became two bullets. The refactor-toward-unification is invisible to users — they just see "withdrawals work." The ROI fix is separated because it's a distinct user-visible bug.
