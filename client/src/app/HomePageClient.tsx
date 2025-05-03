'use client'

import { Footer } from '@/components/Footer'
import { Hero } from '@/components/landing/Hero'
import { Demo } from '@/components/landing/Demo'
import { Features } from '@/components/landing/Features'
import { Pricing } from '@/components/landing/Pricing'
import { CTA } from '@/components/landing/CTA'
import FeedbackButton from '@/components/ui/FeedbackButton'
/**
 * Client component for the landing page that displays the main marketing content
 * with hero section, features, pricing, and CTAs
 */
export default function HomePageClient() {
  return (
    <div className="min-h-screen bg-light-background dark:bg-dark-background">
      <FeedbackButton position="bottom-right" />
      <Hero />
      <div id="demo">
        <Demo />
      </div>
      <Features />
      <div id="pricing">
        <Pricing />
      </div>
      <CTA />
      <Footer />
    </div>
  )
} 