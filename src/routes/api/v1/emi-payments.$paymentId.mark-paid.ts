import { createFileRoute } from '@tanstack/react-router'
import { markPaymentPaidSchema } from '#/lib/validators'
import { api, readMutationInput, requireApiProfile } from '#/server/api-v1'
import { markPaymentPaidImpl } from '#/server/emis.impl'

export function handleMarkPaymentPaid(
  request: Request,
  paymentId: string,
): Promise<Response> {
  return api(async () => {
    const { profileId } = await requireApiProfile(request)
    const input = markPaymentPaidSchema.parse(
      await readMutationInput(request, { paymentId }),
    )
    return markPaymentPaidImpl(profileId, input)
  })
}

export const Route = createFileRoute(
  '/api/v1/emi-payments/$paymentId/mark-paid',
)({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        handleMarkPaymentPaid(request, params.paymentId),
    },
  },
})
