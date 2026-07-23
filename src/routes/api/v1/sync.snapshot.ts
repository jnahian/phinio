import { createFileRoute } from '@tanstack/react-router'
import { prisma } from '#/db'
import { api, requireApiProfile } from '#/server/api-v1'

/**
 * Full-snapshot pull for the iOS sync engine. The dataset is per-profile
 * and small (personal scale), so one wholesale snapshot replaces delta
 * sync entirely: no tombstones, no cursors, deletes come for free.
 * Raw Prisma rows serialize correctly by convention: Decimal → string,
 * Date → ISO 8601.
 */
export function handleSnapshot(request: Request): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const where = { profileId }
    const [
      profile,
      investments,
      investmentDeposits,
      investmentWithdrawals,
      emis,
      emiPayments,
      notifications,
    ] = await Promise.all([
      prisma.profile.findUniqueOrThrow({ where: { id: profileId } }),
      prisma.investment.findMany({ where }),
      prisma.investmentDeposit.findMany({ where }),
      prisma.investmentWithdrawal.findMany({ where }),
      prisma.emi.findMany({ where }),
      prisma.emiPayment.findMany({ where }),
      prisma.notification.findMany({ where }),
    ])
    return {
      serverTime: new Date().toISOString(),
      profile,
      investments,
      investmentDeposits,
      investmentWithdrawals,
      emis,
      emiPayments,
      notifications,
    }
  })
}

export const Route = createFileRoute('/api/v1/sync/snapshot')({
  server: {
    handlers: {
      GET: ({ request }) => handleSnapshot(request),
    },
  },
})
