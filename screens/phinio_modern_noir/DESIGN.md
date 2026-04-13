# Design System Strategy: The Financial Architect

## 1. Overview & Creative North Star
The creative North Star for this design system is **"The Digital Private Bank."** 

We are moving away from the loud, playful "fintech-as-a-game" aesthetic. Instead, we are building a high-end, editorial experience that treats personal finance with the gravity of a private vault and the clarity of a premium broadsheet. The design system rejects the "template" look by utilizing intentional asymmetry, deep tonal layering, and "breathing" layouts that prioritize data visualization over decorative clutter. 

To achieve a premium, custom feel, we prioritize **Atmospheric Depth** over structural rigidity. Rather than boxing content into grids, we allow elements to float and overlap, creating a sense of sophisticated, organic composition.

---

## 2. Colors & Surface Philosophy
The palette is rooted in a deep, nocturnal foundation (`#0b1326`), accented by surgical hits of functional color.

### The "No-Line" Rule
**Explicit Instruction:** 1px solid borders are strictly prohibited for sectioning. Structural boundaries must be defined solely through background color shifts or tonal transitions. Use `surface-container-low` against `surface` to define regions. The absence of lines creates a fluid, uninterrupted user journey.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—stacked sheets of frosted glass.
- **Base Layer:** `surface` (#0b1326) - The foundation.
- **Sectional Layer:** `surface-container-low` (#131b2e) - For secondary content blocks.
- **Interactive Layer:** `surface-container-highest` (#2d3449) - For primary interactive cards.
- **Nested Depth:** An inner card (e.g., a transaction detail) should use `surface-container-lowest` (#060e20) when sitting inside a `surface-container-high` (#222a3d) parent to create a "recessed" or "carved" look.

### The "Glass & Gradient" Rule
Standard flat fills are for utilities. For high-impact areas (Hero Sections, Net Worth Overview), use:
- **Glassmorphism:** Apply `surface_variant` at 40% opacity with a 20px-30px backdrop-blur.
- **Signature Textures:** Linear gradients transitioning from `primary_container` (#2563eb) to a deep alpha-zero version of the same hue. This adds "soul" and prevents the UI from feeling sterile.

---

## 3. Typography: The Editorial Scale
We utilize a dual-font approach to balance authority with utility.

*   **Display & Headlines (Manrope):** Chosen for its geometric precision. Use `display-lg` to `headline-sm` for large financial totals and section titles. The wide apertures of Manrope convey openness and transparency.
*   **Body & UI (Inter):** The workhorse. Inter provides maximum legibility for dense financial data. Use `body-md` for transaction lists and `label-sm` for metadata.
*   **The Hierarchy Rule:** Emphasize the "What" (the number) with `headline-lg` and de-emphasize the "How" (the category) with `label-md` in `on_surface_variant`.

---

## 4. Elevation & Depth
Hierarchy is achieved through **Tonal Layering** and ambient light, never through heavy drop shadows.

*   **The Layering Principle:** Stack `surface-container` tiers. A `surface-container-lowest` card placed on a `surface-container-low` background creates a natural, soft lift.
*   **Ambient Shadows:** For floating elements (Modals, FABs), use a shadow with a blur radius of 40px and 6% opacity. The shadow color must be a tinted version of `surface_container_lowest`, never pure black.
*   **The "Ghost Border" Fallback:** If a container lacks contrast on a specific background, use the `outline-variant` token at **15% opacity**. This creates a suggestion of a border rather than a hard edge.
*   **Glassmorphism:** For top navigation bars or floating action areas, use semi-transparent `surface` colors with `backdrop-filter: blur(16px)`.

---

## 5. Components

### Cards & Data Lists
*   **Style:** Forbid divider lines. Use `1.5rem` (xl) or `1rem` (lg) vertical spacing to separate items.
*   **Interactive Cards:** Soft corners (16px / `xl`) are mandatory. Use `surface-container-high` for the card body.
*   **Micro-Signals:** Use `secondary` (#4edea3) for gains and `tertiary_container` (#cf2c30) for losses, but only for the text or a small 4px "pill" indicator. Avoid large, jarring blocks of color.

### Buttons
*   **Primary:** `primary_container` (#2563eb) fill with `on_primary_container` text. Apply a subtle 10% gradient for a tactile feel.
*   **Secondary/Ghost:** No fill. Use `on_surface` text with the "Ghost Border" (15% `outline-variant`).
*   **Tertiary:** Pure text with `primary` (#b4c5ff) color, no container.

### Input Fields
*   **The "Carved" Look:** Use `surface-container-lowest` for the field background to make it look recessed into the `surface`.
*   **Focus State:** Transition the border from 15% opacity `outline-variant` to 100% `primary`.

### Progress & Health Bars
*   **Track:** `surface_variant`.
*   **Indicator:** Use `secondary` for positive goals and `primary_container` for neutral spending.
*   **Width:** Keep bars thin (4px) to maintain the "Thin Line Icon" aesthetic.

---

## 6. Do’s and Don’ts

### Do:
*   **Do** use extreme white space. If a layout feels "full," it is likely over-designed.
*   **Do** use `manrope` for any numeric value over 24px.
*   **Do** layer surfaces (`low` on `lowest`) to create "zones" of information without using boxes.
*   **Do** use "thin" weight icons (1px to 1.5px stroke) to match the Inter typography.

### Don’t:
*   **Don’t** use pure black (#000000) or pure white (#FFFFFF). Use the provided surface and "on-surface" tokens.
*   **Don’t** use a 1px divider to separate list items; let the white space do the work.
*   **Don’t** use high-contrast shadows. If you can clearly see where the shadow ends, it is too heavy.
*   **Don’t** use "alert red" for anything other than actual financial loss or destructive actions. Use `tertiary_fixed_variant` for softer warnings.