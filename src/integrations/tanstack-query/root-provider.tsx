import { QueryClient } from '@tanstack/react-query'

export function getContext() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        gcTime: 10 * 60_000,
      },
    },
  })

  return {
    queryClient,
  }
}
export default function TanstackQueryProvider() {}
