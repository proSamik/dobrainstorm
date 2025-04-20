'use client'

import { Footer } from '@/components/Footer'
import { JsonLd } from '@/components/seo/JsonLd'

export default function AboutPageClient() {
  // Organization data for structured data
  const organizationData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Map Your Ideas',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com',
    logo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'}/logo.ico`,
    description: 'A modern platform for mapping and organizing your ideas effectively.',
  }

  return (
    <div className="min-h-screen bg-light-background dark:bg-dark-background">
      {/* Structured data for the organization */}
      <JsonLd data={organizationData} />

      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-light-foreground dark:text-dark-foreground sm:text-6xl">
            About Map Your Ideas
          </h1>
          <p className="mt-6 text-lg leading-8 text-light-muted dark:text-dark-muted">
            Empowering you to visualize, organize, and bring your ideas to life.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-2xl lg:max-w-4xl">
          <h2 className="text-2xl font-bold tracking-tight text-light-foreground dark:text-dark-foreground">
            Our Mission
          </h2>
          <p className="mt-6 text-lg leading-8 text-light-muted dark:text-dark-muted">
            Map Your Ideas was born from the belief that great ideas deserve powerful tools to help them grow. Our mission is to provide an intuitive and powerful platform that helps individuals and teams visualize their thoughts, connect concepts, and transform abstract ideas into actionable plans. With advanced AI capabilities and seamless collaboration features, we&apos;re making idea organization more accessible and effective than ever before.
          </p>

          <h2 className="mt-16 text-2xl font-bold tracking-tight text-light-foreground dark:text-dark-foreground">
            Why Map Your Ideas?
          </h2>
          <dl className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2">
            <div>
              <dt className="text-lg font-semibold text-light-foreground dark:text-dark-foreground">Visual Thinking</dt>
              <dd className="mt-2 text-base text-light-muted dark:text-dark-muted">
                Transform complex thoughts into clear, visual maps that help you see connections and opportunities you might have missed.
              </dd>
            </div>
            <div>
              <dt className="text-lg font-semibold text-light-foreground dark:text-dark-foreground">AI-Powered Insights</dt>
              <dd className="mt-2 text-base text-light-muted dark:text-dark-muted">
                Leverage cutting-edge AI to enhance your ideation process, generate connections, and discover new perspectives.
              </dd>
            </div>
            <div>
              <dt className="text-lg font-semibold text-light-foreground dark:text-dark-foreground">Seamless Collaboration</dt>
              <dd className="mt-2 text-base text-light-muted dark:text-dark-muted">
                Share your mind maps, collaborate in real-time, and bring your team&apos;s collective creativity to life.
              </dd>
            </div>
            <div>
              <dt className="text-lg font-semibold text-light-foreground dark:text-dark-foreground">Privacy-First</dt>
              <dd className="mt-2 text-base text-light-muted dark:text-dark-muted">
                Your ideas are yours. We prioritize data security and privacy, ensuring your intellectual property remains protected.
              </dd>
            </div>
          </dl>

          <h2 className="mt-16 text-2xl font-bold tracking-tight text-light-foreground dark:text-dark-foreground">
            About the Creator
          </h2>
          <div className="mt-6 text-lg leading-8 text-light-muted dark:text-dark-muted">
            <p className="mb-4">
              Map Your Ideas is created by Samik Choudhury (proSamik), a passionate developer focused on building products that ship faster and make a real impact. With the motto &quot;Build to Ship&quot;, Samik brings extensive experience in creating intuitive and powerful software solutions.
            </p>
            <p>
              As a developer who loves to build and learn new technologies, Samik understands the importance of having the right tools to organize thoughts and bring ideas to fruition. This understanding, combined with technical expertise, has shaped Map Your Ideas into a platform that truly serves its users&apos; needs.
            </p>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
} 