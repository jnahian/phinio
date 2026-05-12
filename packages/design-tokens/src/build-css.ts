import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

type TokenTree = Record<string, Record<string, string>>

export function tokensToCss(tokens: TokenTree): string {
  const lines: Array<string> = ['@theme {']
  for (const [group, entries] of Object.entries(tokens)) {
    for (const [name, value] of Object.entries(entries)) {
      lines.push(`  --${group}-${name}: ${value};`)
    }
  }
  lines.push('}')
  lines.push('')
  return lines.join('\n')
}

function main() {
  const src = resolve(__dirname, 'tokens.json')
  const out = resolve(__dirname, '../dist/tokens.css')
  const tokens = JSON.parse(readFileSync(src, 'utf8')) as TokenTree
  const css = tokensToCss(tokens)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, css, 'utf8')
  console.log(`Wrote ${out} (${css.length} bytes)`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
