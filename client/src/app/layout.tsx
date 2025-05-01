import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster as HotToaster } from 'react-hot-toast'
import { Toaster as SonnerToaster } from 'sonner'
import { ThemeProvider } from '@/components/ThemeProvider'
import { AuthProvider } from '@/contexts/AuthContext'
import { UserDataProvider } from '@/contexts/UserDataContext'
import Navigation from '@/components/Navigation'
import PageView from '@/components/PageView'
import JsonLd from '@/components/seo/JsonLd'
import PrismInit from '@/components/PrismInit'
import Head from 'next/head'

const inter = Inter({ subsets: ['latin'] })

// Base site information for SEO
const siteName = 'Map Your Ideas'
const siteDescription = 'A modern platform for mapping and organizing your ideas effectively'

// Generate default metadata for the site
export const metadata: Metadata = {
  title: {
    template: '%s | Map Your Ideas',
    default: 'Map Your Ideas - Organize Your Thoughts',
  },
  description: siteDescription,
  keywords: ['mind mapping', 'brainstorming', 'ideas', 'organization', 'productivity', 'collaboration'],
  authors: [{ name: 'Map Your Ideas Team' }],
  icons: {
    icon: '/logo.ico',
    shortcut: '/logo.ico',
    apple: '/logo.ico',
  },
  openGraph: {
    type: 'website',
    siteName,
    images: [
      {
        url: '/logo.ico',
        width: 32,
        height: 32,
        alt: 'Map Your Ideas'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    creator: '@mapyourideas'
  },
  robots: {
    index: true,
    follow: true
  }
}

// Organization structured data
const organizationData = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: siteName,
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com',
  logo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://example.com'}/logo.ico`,
  sameAs: [
    'https://twitter.com/mapyourideas',
    'https://github.com/mapyourideas',
    'https://www.linkedin.com/company/mapyourideas'
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'support@mapyourideas.com',
    contactType: 'customer service'
  }
}

/**
 * Root layout component that wraps all pages with necessary providers
 * and global styles
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <Head>
        {/* Lemon Squeezy Affiliate Configuration */}
        <script dangerouslySetInnerHTML={{ __html: 'window.lemonSqueezyAffiliateConfig = { store: "mapyouridea" };' }} />
        <script src="https://lmsqueezy.com/affiliate.js" defer></script>
      </Head>
      <body suppressHydrationWarning className={`${inter.className} bg-light-background dark:bg-dark-background text-light-foreground dark:text-dark-foreground`}>
        {/* Add organization structured data to all pages */}
        <JsonLd data={organizationData} />
        
        <ThemeProvider>
          <AuthProvider>
            <UserDataProvider>
              <Navigation />
              <PageView />
              {children}
              <PrismInit />
              {/* React Hot Toast for legacy components */}
              <HotToaster 
                position="bottom-right"
                toastOptions={{
                  className: 'bg-light-background dark:bg-dark-background text-light-foreground dark:text-dark-foreground',
                }}
              />
              {/* Sonner Toast for newer components */}
              <SonnerToaster 
                position="bottom-right"
                theme="system"
                className="bg-light-background dark:bg-dark-background text-light-foreground dark:text-dark-foreground"
              />
            </UserDataProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
