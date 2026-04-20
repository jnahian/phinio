import { createFileRoute } from '@tanstack/react-router'
import { Features } from '#/components/landing/Features'
import { FinalCta } from '#/components/landing/FinalCta'
import { Footer } from '#/components/landing/Footer'
import { Hero } from '#/components/landing/Hero'
import { HowItWorks } from '#/components/landing/HowItWorks'
import { Nav } from '#/components/landing/Nav'
import { TrustBar } from '#/components/landing/TrustBar'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="bg-surface text-on-surface font-sans overflow-x-hidden">
      <Nav />
      <Hero />
      <TrustBar />
      <Features />
      <HowItWorks />
      <FinalCta />
      <Footer />
    </div>
  )
}
