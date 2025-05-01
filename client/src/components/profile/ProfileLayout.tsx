'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'

type Tab = 'profile' | 'subscription' | 'settings'

export default function ProfileLayout({
  children,
  subscription,
  settings,
}: {
  children: React.ReactNode
  subscription: React.ReactNode
  settings: React.ReactNode
}) {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') as Tab || 'profile';
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const { auth } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTab = sessionStorage.getItem('activeProfileTab')
      if (savedTab) {
        setActiveTab(savedTab as Tab)
        sessionStorage.removeItem('activeProfileTab')
      }
    }
  }, [])

  if (!auth) {
    router.push('/auth')
    return null
  }

  return (
    <div className="min-h-screen bg-light-background dark:bg-dark-background flex justify-center">
      <div className="w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Mobile Tabs */}
        <div className="sm:hidden mb-4 mt-16">
          <div className="grid grid-cols-2 gap-2 bg-light-card dark:bg-dark-card rounded-lg p-2 shadow-sm">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-3 text-sm font-medium rounded-md transition-colors ${activeTab === 'profile' ? 'bg-light-accent dark:bg-dark-accent dark:text-white' : 'text-light-foreground dark:text-dark-foreground'}`}
            >
              Profile
            </button>
            <button
              onClick={() => setActiveTab('subscription')}
              className={`px-4 py-3 text-sm font-medium rounded-md transition-colors ${activeTab === 'subscription' ? 'bg-light-accent dark:bg-dark-accent dark:text-white' : 'text-light-foreground dark:text-dark-foreground'}`}
            >
              Subscription
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-4 py-3 text-sm font-medium rounded-md transition-colors ${activeTab === 'settings' ? 'bg-light-accent dark:bg-dark-accent dark:text-white' : 'text-light-foreground dark:text-dark-foreground'}`}
            >
              Settings
            </button>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Sidebar for larger screens */}
          <div className="hidden sm:block w-56 shrink-0">
            <div className="sticky top-24 bg-light-card dark:bg-dark-card rounded-lg shadow-sm p-3">
              <nav className="space-y-1">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`w-full text-left px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'profile' ? 'bg-light-accent dark:bg-dark-accent dark:text-white' : 'hover:bg-light-hover dark:hover:bg-dark-hover text-light-foreground dark:text-dark-foreground'}`}
                >
                  Profile
                </button>
                <button
                  onClick={() => setActiveTab('subscription')}
                  className={`w-full text-left px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'subscription' ? 'bg-light-accent dark:bg-dark-accent dark:text-white' : 'hover:bg-light-hover dark:hover:bg-dark-hover text-light-foreground dark:text-dark-foreground'}`}
                >
                  Subscription
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className={`w-full text-left px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-light-accent dark:bg-dark-accent dark:text-white' : 'hover:bg-light-hover dark:hover:bg-dark-hover text-light-foreground dark:text-dark-foreground'}`}
                >
                  Settings
                </button>
              </nav>
            </div>
          </div>

          {/* Main content area */}
          <div className="flex-1">
            <div className="bg-light-card dark:bg-dark-card rounded-lg shadow-sm p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  {activeTab === 'profile' ? children :
                   activeTab === 'subscription' ? subscription : settings}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}