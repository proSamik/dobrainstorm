'use client'

import Link from 'next/link'
import Image from 'next/image'

/**
 * Footer component that displays site-wide footer with links and information
 */
export function Footer() {
  return (
    <footer className="bg-light-background dark:bg-dark-background border-t border-light-accent dark:border-dark-accent">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="xl:grid xl:grid-cols-3 xl:gap-8">
          {/* Company Info */}
          <div className="space-y-8">
            <Link
              href="/"
              className="flex items-center font-semibold text-light-foreground dark:text-dark-foreground hover:text-primary-600 transition-colors"
            >
              <Image src="/logo.ico" alt="Map Your Ideas Logo" width={24} height={24} className="mr-2" />
              Map Your Ideas
            </Link>
            <p className="text-sm leading-6 text-light-muted dark:text-dark-muted">
              Innovating the landscape of idea management with cutting-edge technology and seamless integration.
            </p>
            <div className="flex space-x-6">
              <a href="https://twitter.com/prosamik" className="text-light-muted dark:text-dark-muted hover:text-primary-600">
                <span className="sr-only">Twitter</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="https://linkedin.com/in/prosamik" className="text-light-muted dark:text-dark-muted hover:text-primary-600">
                <span className="sr-only">LinkedIn</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="mt-16 grid grid-cols-2 gap-8 xl:col-span-2 xl:mt-0">
            <div className="md:grid md:grid-cols-2 md:gap-8">
              <div>
                <h3 className="text-sm font-semibold text-light-foreground dark:text-dark-foreground">Product</h3>
                <ul role="list" className="mt-6 space-y-4">
                  <li>
                    <Link href="/#features" className="text-sm text-light-muted dark:text-dark-muted hover:text-primary-600">
                      Features
                    </Link>
                  </li>
                  <li>
                    <Link href="/#pricing" className="text-sm text-light-muted dark:text-dark-muted hover:text-primary-600">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link href="/#demo" className="text-sm text-light-muted dark:text-dark-muted hover:text-primary-600">
                      Demo
                    </Link>
                  </li>
                </ul>
              </div>
              <div className="mt-10 md:mt-0">
                <h3 className="text-sm font-semibold text-light-foreground dark:text-dark-foreground">Company</h3>
                <ul role="list" className="mt-6 space-y-4">
                  <li>
                    <Link href="/about" className="text-sm text-light-muted dark:text-dark-muted hover:text-primary-600">
                      About
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact" className="text-sm text-light-muted dark:text-dark-muted hover:text-primary-600">
                      Contact
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-light-foreground dark:text-dark-foreground">Legal</h3>
              <ul role="list" className="mt-6 space-y-4">
                <li>
                  <Link 
                    href="/legal?tab=privacy" 
                    className="text-sm text-light-muted dark:text-dark-muted hover:text-primary-600"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link 
                    href="/legal?tab=terms" 
                    className="text-sm text-light-muted dark:text-dark-muted hover:text-primary-600"
                  >
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-16 border-t border-light-accent dark:border-dark-accent pt-8">
          <p className="text-xs leading-5 text-light-muted dark:text-dark-muted">
            &copy; {new Date().getFullYear()} SaaS Platform. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}