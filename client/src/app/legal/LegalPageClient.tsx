'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams } from 'next/navigation'
import { Footer } from '@/components/Footer'

// Define the sections content
const sections = {
  terms: [
    {
      title: '1. Terms of Use',
      content: 'By accessing and using Map Your Ideas, you accept and agree to be bound by the terms and provisions of this agreement. These terms apply to all visitors, users, and others who access or use our service.'
    },
    {
      title: '2. User Accounts and Authentication',
      content: 'We offer email-based registration and Google Authentication. By using our authentication services, you agree to provide accurate and complete information. You are responsible for maintaining the security of your account and for all activities that occur under your account. We reserve the right to suspend or terminate accounts that violate our terms or are inactive for an extended period.'
    },
    {
      title: '3. Data Storage and Sync',
      content: 'We store and sync your user profile, email, username, subscription details, and board data with our database. This synchronization is essential for providing our services and ensuring your data is accessible across devices. You retain ownership of your content while granting us the necessary rights to provide and improve our services.'
    },
    {
      title: '4. AI Services Integration',
      content: 'Our platform integrates with various AI APIs to enhance your experience. By using these features, you acknowledge that: (a) any data you explicitly choose to process through AI services will be subject to their respective terms and conditions, (b) we do not modify your data without your consent, and (c) we do not share personal information with AI providers unless specifically requested by you for particular features.'
    },
    {
      title: '5. Use License',
      content: 'We grant you a personal, non-exclusive, non-transferable license to use Map Your Ideas for your personal or business purposes, subject to these terms and your subscription status.'
    },
    {
      title: '6. Disclaimer',
      content: 'The services are provided "as is" and "as available" without warranties of any kind, either express or implied. We do not warrant that the services will be uninterrupted or error-free, that defects will be corrected, or that our services or servers are free of harmful components.'
    },
    {
      title: '7. Limitations',
      content: 'To the fullest extent permitted by law, Map Your Ideas shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses resulting from your access to or use of or inability to access or use the services.'
    }
  ],
  privacy: [
    {
      title: '1. Information Collection',
      content: 'We collect information you provide directly to us, including but not limited to: (a) Account information: email address, username, and profile details when you register, (b) Authentication data through Google sign-in, (c) Subscription and billing information, (d) Board content and organizational data you create or upload, (e) Usage data and interaction with our services.'
    },
    {
      title: '2. Use of Information',
      content: 'We use the collected information to: (a) Provide, maintain, and improve our services, (b) Process your transactions, (c) Send you technical notices and support messages, (d) Respond to your comments and questions, (e) Develop new features and services, (f) Monitor and analyze usage patterns.'
    },
    {
      title: '3. AI Processing and Data Handling',
      content: 'When you use our AI-enhanced features: (a) We only process data through AI APIs that you explicitly choose to analyze, (b) We do not store or use your personal data for AI training, (c) AI processing is governed by our partners\' terms of service, which we encourage you to review, (d) You maintain control over what data is processed by AI features.'
    },
    {
      title: '4. Data Storage and Security',
      content: 'We implement reasonable security measures to protect your information: (a) Data is encrypted in transit and at rest, (b) Regular security audits and updates are performed, (c) Access to personal data is restricted to authorized personnel, (d) We use industry-standard database security practices.'
    },
    {
      title: '5. Information Sharing',
      content: 'We do not share your personal information except: (a) With your explicit consent, (b) With service providers who assist in our operations, (c) When required by law or to protect rights and safety, (d) In connection with a business transfer or acquisition.'
    },
    {
      title: '6. Data Retention',
      content: 'We retain your information as long as your account is active or as needed to provide services. You can request data deletion, though we may retain certain information as required by law or for legitimate business purposes.'
    },
    {
      title: '7. Your Rights and Choices',
      content: 'You have the right to: (a) Access your personal information, (b) Correct inaccurate data, (c) Request deletion of your data, (d) Export your data in a portable format, (e) Opt-out of certain data processing and communications.'
    }
  ]
}

/**
 * Client component for the Legal page that handles interactive elements
 * This includes tab switching between Terms of Service and Privacy Policy
 */
export default function LegalPageClient() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>('terms')

  // Set the active tab based on URL parameters
  useEffect(() => {
    const tab = searchParams.get('tab') as 'terms' | 'privacy'
    if (tab && (tab === 'terms' || tab === 'privacy')) {
      setActiveTab(tab)
    }
  }, [searchParams])

  return (
    <div className="min-h-screen bg-light-background dark:bg-dark-background py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-light-foreground dark:text-dark-foreground">
            Legal Information
          </h1>
          <p className="mt-4 text-lg text-light-muted dark:text-dark-muted">
            Our terms of service and privacy policy
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center space-x-4 mb-12">
          <button
            onClick={() => setActiveTab('terms')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'terms'
                ? 'bg-light-accent dark:bg-dark-accent text-white'
                : 'text-light-muted dark:text-dark-muted hover:text-light-foreground dark:hover:text-dark-foreground'
            }`}
            aria-selected={activeTab === 'terms'}
            role="tab"
          >
            Terms of Service
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'privacy'
                ? 'bg-light-accent dark:bg-dark-accent text-white'
                : 'text-light-muted dark:text-dark-muted hover:text-light-foreground dark:hover:text-dark-foreground'
            }`}
            aria-selected={activeTab === 'privacy'}
            role="tab"
          >
            Privacy Policy
          </button>
        </div>

        {/* Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-light-card dark:bg-dark-card rounded-lg shadow-lg p-8"
        >
          <h2 className="text-2xl font-bold text-light-foreground dark:text-dark-foreground mb-8">
            {activeTab === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
          </h2>
          
          <div className="space-y-8">
            {sections[activeTab].map((section, index) => (
              <section key={index} className="space-y-4">
                <h3 className="text-xl font-semibold text-light-foreground dark:text-dark-foreground">
                  {section.title}
                </h3>
                <p className="text-light-muted dark:text-dark-muted leading-relaxed">
                  {section.content}
                </p>
              </section>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t border-light-border dark:border-dark-border">
            <p className="text-sm text-light-muted dark:text-dark-muted">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </div>
        </motion.div>
      </div>
      <Footer />
    </div>
  )
} 