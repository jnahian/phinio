import { en } from './en'
import { bn } from './bn'

export const resources = {
  en,
  bn,
} as const

export type ResourceLocale = keyof typeof resources

export { en, bn }
