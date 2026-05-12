import tokens from './tokens.json' with { type: 'json' }

export type Tokens = typeof tokens
export const designTokens: Tokens = tokens
export default designTokens
