import { createContext, useContext, useEffect } from 'react'

export const TopBarTitleContext = createContext<{
  title: string | null
  setTitle: (t: string | null) => void
}>({ title: null, setTitle: () => {} })

export function useSetTopBarTitle(title: string | null | undefined) {
  const { setTitle } = useContext(TopBarTitleContext)
  useEffect(() => {
    if (title != null) setTitle(title)
    return () => setTitle(null)
  }, [title, setTitle])
}
