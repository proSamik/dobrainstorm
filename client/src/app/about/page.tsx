import { Metadata } from 'next'
import { createMetadata } from '@/lib/seo/metadata'
import AboutPageClient from '@/components/AboutPageClient'

/**
 * Generate metadata for the About page
 */
export const generateMetadata = (): Metadata => {
  return createMetadata({
    title: 'About Us | Map Your Ideas',
    description: 'Learn about Map Your Ideas and our mission to help you organize and visualize your thoughts effectively.',
    keywords: ['about us', 'company values', 'mission', 'team', 'software development'],
    type: 'website',
  })
}

/**
 * About page component that displays company information
 */
export default function AboutPage() {
  return <AboutPageClient />
}