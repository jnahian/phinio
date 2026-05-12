# Design System — Phinio (Modern Noir)

> Canonical source: `screens/phinio_modern_noir/DESIGN.md`. This file is a quick reference for AI agents and contributors. Tokens live in `src/styles.css` under `@theme`. The app is **dark-only**; `<html>` permanently has `className="dark"`.

## North Star

**"The Digital Private Bank."** Editorial, nocturnal, data-first. Atmospheric depth over structural rigidity. Floating, overlapping elements; no boxed grids.

## Core Rules

| Rule                            | Detail                                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------------------------- |
| **No 1px lines**                | Sectioning uses background tonal shifts, never `border: 1px solid`.                             |
| **No pure black/white**         | Use `surface` / `on_surface` tokens; never `#000` or `#FFF`.                                    |
| **Tonal layering**              | `surface-container-lowest` → `low` → `high` → `highest` for stacked depth.                      |
| **Manrope for numerics ≥ 24px** | Geometric, financial-grade. Inter for body and labels.                                          |
| **Soft corners**                | `16px` (xl) on interactive cards; `1rem`/`1.5rem` vertical rhythm in lists.                     |
| **Money color**                 | `secondary` (#4edea3) for gains, `tertiary_container` (#cf2c30) for losses — pills, not blocks. |

## Surface Hierarchy

```
surface (#0b1326)            ← page base
 └─ surface-container-low    ← section / card group
     └─ surface-container-highest (#2d3449)  ← interactive card
         └─ surface-container-lowest (#060e20)  ← nested/recessed (input, detail row)
```

## Components (cheat sheet)

- **Cards:** `surface-container-high` body, no dividers, soft 16px corners.
- **Buttons:** Primary = `primary_container` fill + 10% gradient; Secondary = ghost border at 15% `outline-variant`; Tertiary = pure `primary` text.
- **Inputs:** "Carved" — `surface-container-lowest` background, focus transitions border to 100% `primary`.
- **Progress bars:** 4px thin; track `surface_variant`, indicator `secondary` (positive) or `primary_container` (neutral).
- **Glass:** Top bars / FABs use semi-transparent `surface` + `backdrop-filter: blur(16px)`.
- **Shadows:** 40px blur, 6% opacity, tinted from `surface_container_lowest` — never pure black.

## Typography Scale

- Display/headlines: **Manrope** — `display-lg` to `headline-sm` for totals & section titles.
- Body/UI: **Inter** — `body-md` for lists, `label-sm` for metadata in `on_surface_variant`.
- Hierarchy: emphasize the **what** (number) with `headline-lg`; de-emphasize the **how** (category) with `label-md`.
- **Hind Siliguri** is loaded as a fallback in both `--font-sans` and `--font-display` stacks for Bengali content (the app ships en/bn via i18n). See `src/styles.css`.

## Don'ts

- Don't use 1px dividers. Let whitespace separate.
- Don't use alert red for warnings — reserve `tertiary_container` for actual loss / destructive actions; soft warnings use `tertiary_fixed_variant`.
- Don't use heavy/visible drop shadows.
- Don't mix Manrope into body copy or Inter into large numerics.

## When working on UI

Cross-reference three sources in this order:

1. **PRD** (`Phinio_PRD_v1.md`) — behavior and data shape.
2. **Mockup** (`screens/<name>/code.html` + `*.png`) — layout & markup reference.
3. **DESIGN.md** (`screens/phinio_modern_noir/DESIGN.md`) — visual tokens.

The HTML mockups are reference material, not code to import.
