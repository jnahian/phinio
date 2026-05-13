import { randomBytes } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import type { AppContext } from '@phinio/trpc'
import { appRouter } from '@phinio/trpc'
import { createTestUser, prisma, resetDb } from './helpers/db'

function callerFor(profileId: string, userId: string) {
  const ctx: AppContext = { prisma, profileId, userId, locale: 'en' }
  return appRouter.createCaller(ctx)
}

beforeEach(async () => {
  await resetDb()
})

function bareUserId() {
  return `bare_${randomBytes(6).toString('hex')}`
}

async function createBareUser(email: string) {
  const id = bareUserId()
  await prisma.user.create({
    data: {
      id,
      name: 'Bare User',
      email,
      emailVerified: true,
      updatedAt: new Date(),
    },
  })
  return id
}

describe('profile router', () => {
  it('get returns the user’s profile', async () => {
    const user = await createTestUser({
      email: 'ada@phinio.test',
      fullName: 'Ada Lovelace',
      preferredCurrency: 'BDT',
    })

    const profile = await callerFor(user.profileId, user.userId).profile.get()

    expect(profile.id).toBe(user.profileId)
    expect(profile.userId).toBe(user.userId)
    expect(profile.fullName).toBe('Ada Lovelace')
    expect(profile.preferredCurrency).toBe('BDT')
    expect(profile.createdAt).toBeInstanceOf(Date)
  })

  it('get throws when the user has no profile', async () => {
    // No profile row, but we still need a non-null userId to pass through the
    // protectedProcedure guard. Synthesize a fake profileId — the query
    // resolves by userId, so a missing Profile row is what we're testing.
    const userId = await createBareUser('orphan@phinio.test')
    const fakeProfileId = `nonexistent_${randomBytes(6).toString('hex')}`

    await expect(
      callerFor(fakeProfileId, userId).profile.get(),
    ).rejects.toThrow(/not found/i)
  })

  it('get returns USD when the stored currency is USD', async () => {
    const user = await createTestUser({
      email: 'usd@phinio.test',
      fullName: 'Dollar User',
      preferredCurrency: 'USD',
    })

    const profile = await callerFor(user.profileId, user.userId).profile.get()

    expect(profile.preferredCurrency).toBe('USD')
    expect(profile.fullName).toBe('Dollar User')
  })

  it('updateCurrency switches from BDT to USD', async () => {
    const user = await createTestUser({
      email: 'bdt-to-usd@phinio.test',
      preferredCurrency: 'BDT',
    })

    const caller = callerFor(user.profileId, user.userId)
    const updated = await caller.profile.updateCurrency({
      preferredCurrency: 'USD',
    })

    expect(updated.preferredCurrency).toBe('USD')
    expect(updated.userId).toBe(user.userId)

    const roundTrip = await caller.profile.get()
    expect(roundTrip.preferredCurrency).toBe('USD')
  })

  it('updateCurrency switches from USD to BDT', async () => {
    const user = await createTestUser({
      email: 'usd-to-bdt@phinio.test',
      preferredCurrency: 'USD',
    })

    const caller = callerFor(user.profileId, user.userId)
    const updated = await caller.profile.updateCurrency({
      preferredCurrency: 'BDT',
    })

    expect(updated.preferredCurrency).toBe('BDT')
    expect(updated.userId).toBe(user.userId)

    const roundTrip = await caller.profile.get()
    expect(roundTrip.preferredCurrency).toBe('BDT')
  })

  it('updateCurrency throws when the profileId points at no profile', async () => {
    const userId = await createBareUser('orphan-update@phinio.test')
    const fakeProfileId = `nonexistent_${randomBytes(6).toString('hex')}`

    await expect(
      callerFor(fakeProfileId, userId).profile.updateCurrency({
        preferredCurrency: 'USD',
      }),
    ).rejects.toThrow()
  })

  it('two users’ profile currencies are independent', async () => {
    const alice = await createTestUser({
      email: 'alice-profile@phinio.test',
      fullName: 'Alice',
      preferredCurrency: 'BDT',
    })
    const bob = await createTestUser({
      email: 'bob-profile@phinio.test',
      fullName: 'Bob',
      preferredCurrency: 'USD',
    })

    await callerFor(alice.profileId, alice.userId).profile.updateCurrency({
      preferredCurrency: 'USD',
    })

    const aliceAfter = await callerFor(alice.profileId, alice.userId).profile.get()
    const bobAfter = await callerFor(bob.profileId, bob.userId).profile.get()

    expect(aliceAfter.preferredCurrency).toBe('USD')
    expect(bobAfter.preferredCurrency).toBe('USD')
    // Bob was created as USD and should still be USD (untouched by Alice's update)
    expect(bobAfter.userId).toBe(bob.userId)
    expect(bobAfter.fullName).toBe('Bob')
  })

  it('get scopes by userId', async () => {
    const alice = await createTestUser({
      email: 'alice-scope@phinio.test',
      fullName: 'Alice Scope',
      preferredCurrency: 'BDT',
    })
    const bob = await createTestUser({
      email: 'bob-scope@phinio.test',
      fullName: 'Bob Scope',
      preferredCurrency: 'USD',
    })

    const aliceProfile = await callerFor(alice.profileId, alice.userId).profile.get()
    const bobProfile = await callerFor(bob.profileId, bob.userId).profile.get()

    expect(aliceProfile.userId).toBe(alice.userId)
    expect(aliceProfile.id).toBe(alice.profileId)
    expect(aliceProfile.fullName).toBe('Alice Scope')
    expect(aliceProfile.preferredCurrency).toBe('BDT')

    expect(bobProfile.userId).toBe(bob.userId)
    expect(bobProfile.id).toBe(bob.profileId)
    expect(bobProfile.fullName).toBe('Bob Scope')
    expect(bobProfile.preferredCurrency).toBe('USD')

    expect(aliceProfile.id).not.toBe(bobProfile.id)
  })
})
