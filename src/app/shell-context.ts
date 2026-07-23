import { createContext, useContext } from 'react'

// A page that renders its OWN create CTA (the list's first-visit invitation)
// tells the shell to hide the header one — one primary per screen.
export const HeaderCtaContext = createContext<(hidden: boolean) => void>(() => {})
export const useHeaderCta = () => useContext(HeaderCtaContext)
