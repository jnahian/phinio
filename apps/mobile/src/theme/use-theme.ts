import { theme } from './tokens'
import type { Theme } from './tokens'

/**
 * Phinio is dark-only (Modern Noir) — there is no light variant to
 * toggle between, so this hook simply returns the singleton theme. It
 * exists as a hook so future work (system contrast, accent tinting)
 * can swap in a context-driven implementation without touching call
 * sites.
 */
export function useTheme(): Theme {
  return theme
}
