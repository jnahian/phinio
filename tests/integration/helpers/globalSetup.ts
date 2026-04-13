import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'

let server: PGLiteSocketServer | null = null
let db: PGlite | null = null

export async function setup() {
  db = new PGlite()
  await db.waitReady

  const migrationSql = await readFile(
    resolve(
      process.cwd(),
      'prisma/migrations/20260413175701_init/migration.sql',
    ),
    'utf8',
  )
  await db.exec(migrationSql)

  server = new PGLiteSocketServer({
    db,
    host: '127.0.0.1',
    port: 0,
    maxConnections: 10,
  })
  await server.start()

  // getServerConn() returns "host:port" after start(). We use it verbatim
  // so Prisma (via pg adapter) connects to our pglite instance.
  process.env.DATABASE_URL = `postgresql://postgres@${server.getServerConn()}/postgres`

  // Better Auth won't be exercised, but #/lib/auth is still imported
  // transitively — give it something to avoid a startup throw and silence
  // the "base URL could not be determined" warning.
  process.env.BETTER_AUTH_SECRET ??= 'test-secret-not-for-production'
  process.env.BETTER_AUTH_URL ??= 'http://localhost:3000'
}

export async function teardown() {
  if (server) await server.stop()
  if (db) await db.close()
}
