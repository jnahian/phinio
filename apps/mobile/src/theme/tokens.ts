import { designTokens } from '@phinio/design-tokens'

/**
 * Modern Noir dark palette re-exported as a flat RN-friendly object so
 * components can do `colors.surface` or `colors.onSurface` without
 * juggling the kebab-case keys that come from the JSON source. CSS
 * tokens are still single source of truth in `@phinio/design-tokens`;
 * this file just adapts naming for JS callers.
 */
const c = designTokens.color

export const colors = {
  surface: c.surface,
  surfaceDim: c['surface-dim'],
  surfaceBright: c['surface-bright'],
  surfaceContainerLowest: c['surface-container-lowest'],
  surfaceContainerLow: c['surface-container-low'],
  surfaceContainer: c['surface-container'],
  surfaceContainerHigh: c['surface-container-high'],
  surfaceContainerHighest: c['surface-container-highest'],
  surfaceVariant: c['surface-variant'],
  onSurface: c['on-surface'],
  onSurfaceVariant: c['on-surface-variant'],
  onBackground: c['on-background'],
  outline: c.outline,
  outlineVariant: c['outline-variant'],
  primary: c.primary,
  primaryContainer: c['primary-container'],
  onPrimary: c['on-primary'],
  onPrimaryContainer: c['on-primary-container'],
  secondary: c.secondary,
  secondaryContainer: c['secondary-container'],
  onSecondary: c['on-secondary'],
  onSecondaryContainer: c['on-secondary-container'],
  tertiary: c.tertiary,
  tertiaryContainer: c['tertiary-container'],
  onTertiary: c['on-tertiary'],
  onTertiaryContainer: c['on-tertiary-container'],
  error: c.error,
  errorContainer: c['error-container'],
  onError: c['on-error'],
  onErrorContainer: c['on-error-container'],
} as const

export type ThemeColors = typeof colors

export const theme = {
  colors,
} as const

export type Theme = typeof theme
