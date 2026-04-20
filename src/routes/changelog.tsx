import { createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import changelogSource from '../../CHANGELOG.md?raw'
import { Footer } from '#/components/landing/Footer'
import { Nav } from '#/components/landing/Nav'

export const Route = createFileRoute('/changelog')({
  component: ChangelogScreen,
})

function ChangelogScreen() {
  const { intro, releases } = parseChangelog(changelogSource)

  return (
    <div className="bg-surface text-on-surface font-sans overflow-x-hidden">
      <Nav />

      <main className="relative pt-[calc(7rem+env(safe-area-inset-top))] pb-24 px-6">
        {/* Ambient glow */}
        <div className="pointer-events-none select-none" aria-hidden>
          <div className="absolute -top-24 -left-32 w-[480px] h-[480px] rounded-full bg-primary-container/8 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-3xl">
          {/* Header */}
          <header className="mb-14 text-center">
            <span
              className="label-sm text-primary"
              style={{ letterSpacing: '0.16em' }}
            >
              RELEASE NOTES
            </span>
            <h1 className="font-display font-extrabold text-5xl sm:text-6xl tracking-[-0.03em] text-on-surface mt-3 leading-[1.05]">
              Changelog
            </h1>
            {intro.length > 0 && (
              <p className="body-md text-on-surface-variant max-w-xl mx-auto mt-5 leading-relaxed">
                {intro.join(' ')}
              </p>
            )}
          </header>

          {/* Releases */}
          <div className="space-y-16">
            {releases.map((r) => (
              <ReleaseBlock key={r.version} release={r} />
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}

// ── Release block ───────────────────────────────────────────────────────────

function ReleaseBlock({ release }: { release: Release }) {
  return (
    <article>
      <header className="flex flex-wrap items-baseline gap-3 mb-6">
        <h2 className="font-display font-bold text-2xl sm:text-3xl text-on-surface tracking-tight">
          v{release.version}
        </h2>
        <span className="label-sm text-on-surface-variant tracking-[0.12em]">
          {release.date}
        </span>
      </header>

      {release.intro.length > 0 && (
        <p className="body-md text-on-surface-variant leading-relaxed mb-8 max-w-2xl">
          {release.intro.map((p, i) => (
            <span key={i}>
              {renderInline(p)}
              {i < release.intro.length - 1 ? ' ' : null}
            </span>
          ))}
        </p>
      )}

      <div className="space-y-8">
        {release.sections.map((s) => (
          <section key={s.kind}>
            <h3
              className={`label-md mb-4 ${categoryColor(s.kind)}`}
              style={{ letterSpacing: '0.12em' }}
            >
              {s.kind}
            </h3>
            <ul className="space-y-3">
              {s.items.map((item, i) => (
                <li
                  key={i}
                  className="flex gap-3 body-sm text-on-surface-variant leading-relaxed"
                >
                  <span
                    aria-hidden
                    className={`mt-[0.55em] h-1 w-1 rounded-full flex-shrink-0 ${categoryDot(s.kind)}`}
                  />
                  <span>{renderInline(item)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  )
}

function categoryColor(kind: string): string {
  switch (kind.toLowerCase()) {
    case 'added':
      return 'text-secondary'
    case 'changed':
      return 'text-primary'
    case 'fixed':
      return 'text-[#ffd46a]'
    case 'security':
      return 'text-tertiary'
    case 'deprecated':
    case 'removed':
      return 'text-on-surface-variant'
    default:
      return 'text-on-surface-variant'
  }
}

function categoryDot(kind: string): string {
  switch (kind.toLowerCase()) {
    case 'added':
      return 'bg-secondary'
    case 'changed':
      return 'bg-primary'
    case 'fixed':
      return 'bg-[#ffd46a]'
    case 'security':
      return 'bg-tertiary'
    default:
      return 'bg-outline-variant'
  }
}

// ── Parser ──────────────────────────────────────────────────────────────────

interface Section {
  kind: string
  items: Array<string>
}

interface Release {
  version: string
  date: string
  intro: Array<string>
  sections: Array<Section>
}

interface ParsedChangelog {
  intro: Array<string>
  releases: Array<Release>
}

function parseChangelog(text: string): ParsedChangelog {
  const lines = text.split('\n')
  const intro: Array<string> = []
  const releases: Array<Release> = []
  let current: Release | null = null
  let currentSection: Section | null = null
  let buffer = ''

  const flushBullet = () => {
    if (buffer && currentSection) {
      currentSection.items.push(buffer.trim())
    }
    buffer = ''
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')

    if (line.startsWith('# ')) continue

    const h2 = line.match(/^##\s+\[([^\]]+)\]\s+-\s+(.+)$/)
    if (h2) {
      flushBullet()
      currentSection = null
      current = { version: h2[1], date: h2[2], intro: [], sections: [] }
      releases.push(current)
      continue
    }

    const h3 = line.match(/^###\s+(.+)$/)
    if (h3 && current) {
      flushBullet()
      currentSection = { kind: h3[1], items: [] }
      current.sections.push(currentSection)
      continue
    }

    if (line.startsWith('- ') && currentSection) {
      flushBullet()
      buffer = line.slice(2)
      continue
    }

    // Continuation of a bullet (indented line)
    if (line.startsWith('  ') && buffer) {
      buffer += ' ' + line.trim()
      continue
    }

    if (line.trim() === '') {
      flushBullet()
      continue
    }

    // Paragraph text before any section — becomes the release intro
    if (current && current.sections.length === 0) {
      current.intro.push(line.trim())
    } else if (!current) {
      intro.push(line.trim())
    }
  }

  flushBullet()
  return { intro, releases }
}

// ── Inline markdown renderer (**bold** _italic_ `code` [text](url)) ─────────

function renderInline(text: string): Array<ReactNode> {
  const regex = /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  const parts: Array<ReactNode> = []
  let last = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const tok = match[0]
    if (tok.startsWith('**')) {
      parts.push(
        <strong key={key++} className="text-on-surface font-semibold">
          {tok.slice(2, -2)}
        </strong>,
      )
    } else if (tok.startsWith('`')) {
      parts.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded bg-surface-container-high text-[0.85em] text-on-surface font-mono"
        >
          {tok.slice(1, -1)}
        </code>,
      )
    } else if (tok.startsWith('_')) {
      parts.push(<em key={key++}>{tok.slice(1, -1)}</em>)
    } else if (tok.startsWith('[')) {
      const link = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (link) {
        parts.push(
          <a
            key={key++}
            href={link[2]}
            className="text-primary hover:underline"
            target={link[2].startsWith('http') ? '_blank' : undefined}
            rel={link[2].startsWith('http') ? 'noopener noreferrer' : undefined}
          >
            {link[1]}
          </a>,
        )
      }
    }
    last = match.index + tok.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}
