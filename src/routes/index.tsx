import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Features } from '#/components/landing/Features'
import { FinalCta } from '#/components/landing/FinalCta'
import { Footer } from '#/components/landing/Footer'
import { Hero } from '#/components/landing/Hero'
import { HowItWorks } from '#/components/landing/HowItWorks'
import { Nav } from '#/components/landing/Nav'
import { Security } from '#/components/landing/Security'
import { TrustBar } from '#/components/landing/TrustBar'
import { authClient } from '#/lib/auth-client'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  const navigate = useNavigate()
  const { data: session, isPending } = authClient.useSession()

  // An installed PWA relaunches at its manifest's start_url, not at the URL
  // the user was last on — so every time the OS evicts the backgrounded app
  // (minutes to hours) the next launch is a cold navigation. start_url is now
  // /app, but browsers only refresh a cached manifest lazily, so existing
  // installs keep landing here. Bounce signed-in visitors through to the app.
  // The check is client-side on purpose: this route is prerendered, so a
  // beforeLoad redirect would be baked in at build time with no session.
  useEffect(() => {
    if (!isPending && session?.user) {
      void navigate({ to: '/app', replace: true })
    }
  }, [isPending, session, navigate])

  return (
    <div className="bg-surface text-on-surface font-sans overflow-x-hidden">
      <Nav />
      <Hero />
      <TrustBar />
      <Features />
      <HowItWorks />
      <Security />
      <FinalCta />
      <Footer />
    </div>
  )
}
