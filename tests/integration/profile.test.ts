import { randomBytes } from 'node:crypto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  getProfileImpl,
  updateProfileCurrencyImpl,
} from '#/server/profile.impl'
import { createTestUser, prisma, resetDb } from './helpers/db'

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

describe('profile server impls', () => {
  it('getProfileImpl returns the user’s profile', async () => {
    const user = await createTestUser({
      email: 'ada@phinio.test',
      fullName: 'Ada Lovelace',
      preferredCurrency: 'BDT',
    })

    const profile = await getProfileImpl(user.userId)

    expect(profile.id).toBe(user.profileId)
    expect(profile.userId).toBe(user.userId)
    expect(profile.fullName).toBe('Ada Lovelace')
    expect(profile.preferredCurrency).toBe('BDT')
    expect(profile.createdAt).toBeInstanceOf(Date)
  })

  it('getProfileImpl throws when the user has no profile', async () => {
    const userId = await createBareUser('orphan@phinio.test')

    await expect(getProfileImpl(userId)).rejects.toThrow(/not found/i)
  })

  it('getProfileImpl returns USD when the stored currency is USD', async () => {
    const user = await createTestUser({
      email: 'usd@phinio.test',
      fullName: 'Dollar User',
      preferredCurrency: 'USD',
    })

    const profile = await getProfileImpl(user.userId)

    expect(profile.preferredCurrency).toBe('USD')
    expect(profile.fullName).toBe('Dollar User')
  })

  it('updateProfileCurrencyImpl switches from BDT to USD', async () => {
    const user = await createTestUser({
      email: 'bdt-to-usd@phinio.test',
      preferredCurrency: 'BDT',
    })

    const updated = await updateProfileCurrencyImpl(user.userId, {
      preferredCurrency: 'USD',
    })

    expect(updated.preferredCurrency).toBe('USD')
    expect(updated.userId).toBe(user.userId)

    const roundTrip = await getProfileImpl(user.userId)
    expect(roundTrip.preferredCurrency).toBe('USD')
  })

  it('updateProfileCurrencyImpl switches from USD to BDT', async () => {
    const user = await createTestUser({
      email: 'usd-to-bdt@phinio.test',
      preferredCurrency: 'USD',
    })

    const updated = await updateProfileCurrencyImpl(user.userId, {
      preferredCurrency: 'BDT',
    })

    expect(updated.preferredCurrency).toBe('BDT')
    expect(updated.userId).toBe(user.userId)

    const roundTrip = await getProfileImpl(user.userId)
    expect(roundTrip.preferredCurrency).toBe('BDT')
  })

  it('updateProfileCurrencyImpl throws when user has no profile', async () => {
    const userId = await createBareUser('orphan-update@phinio.test')

    await expect(
      updateProfileCurrencyImpl(userId, { preferredCurrency: 'USD' }),
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

    await updateProfileCurrencyImpl(alice.userId, { preferredCurrency: 'USD' })

    const aliceAfter = await getProfileImpl(alice.userId)
    const bobAfter = await getProfileImpl(bob.userId)

    expect(aliceAfter.preferredCurrency).toBe('USD')
    expect(bobAfter.preferredCurrency).toBe('USD')
    // Bob was created as USD and should still be USD (untouched by Alice's update)
    expect(bobAfter.userId).toBe(bob.userId)
    expect(bobAfter.fullName).toBe('Bob')
  })

  it('getProfileImpl scopes by userId', async () => {
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

    const aliceProfile = await getProfileImpl(alice.userId)
    const bobProfile = await getProfileImpl(bob.userId)

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
