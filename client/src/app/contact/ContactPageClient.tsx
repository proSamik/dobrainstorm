'use client'

import { FormEvent, useState } from 'react'
import { Footer } from '@/components/Footer'
import { authService } from '@/services/auth'

/**
 * Client component for the Contact page that handles form submission
 * and other interactive elements
 */
export default function ContactPageClient() {
  const [responseMessage, setResponseMessage] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setResponseMessage(undefined)

    const formData = new FormData(event.currentTarget)
    const data = {
      name: formData.get('name')?.toString(),
      email: formData.get('email')?.toString(),
      message: formData.get('message')?.toString(),
    }

    console.log(data)

    try {
      const response = await authService.post('/api/contact', data);
      
      if (response.status === 200 && response.data) {
        // Use the server's success message if available
        setResponseMessage(response.data.message || 'Thank you for your message. We\'ll get back to you soon!')
        // Reset form
        event.currentTarget.reset()
      } else {
        setResponseMessage(response.data?.error || 'Something went wrong. Please try again later.')
      }
    } catch {
      setResponseMessage('Something went wrong. Please try again later.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-light-background dark:bg-dark-background">
      <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight text-light-foreground dark:text-dark-foreground sm:text-6xl">
            Contact Us
          </h1>
          <p className="mt-6 text-lg leading-8 text-light-muted dark:text-dark-muted">
            Have a question or feedback? We&apos;d love to hear from you.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-light-foreground dark:text-dark-foreground">
                Name
              </label>
              <input
                type="text"
                name="name"
                id="name"
                required
                className="mt-2 block w-full rounded-md border border-light-accent dark:border-dark-accent bg-light-card dark:bg-dark-card px-3 py-2 text-light-foreground dark:text-dark-foreground shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:bg-dark-background"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-light-foreground dark:text-dark-foreground">
                Email
              </label>
              <input
                type="email"
                name="email"
                id="email"
                required
                className="mt-2 block w-full rounded-md border border-light-accent dark:border-dark-accent bg-light-card dark:bg-dark-card px-3 py-2 text-light-foreground dark:text-dark-foreground shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:bg-dark-background"
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-light-foreground dark:text-dark-foreground">
                Message
              </label>
              <textarea
                name="message"
                id="message"
                rows={6}
                required
                className="mt-2 block w-full rounded-md border border-light-accent dark:border-dark-accent bg-light-card dark:bg-dark-card px-3 py-2 text-light-foreground dark:text-dark-foreground shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 dark:bg-dark-background"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full rounded-md bg-primary-500 px-3.5 py-2.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-primary-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </button>
            </div>

            {responseMessage && (
              <p className={`mt-4 text-sm text-center ${responseMessage.includes('thank you') || responseMessage.includes('Thank you') ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {responseMessage}
              </p>
            )}
          </form>
        </div>
      </div>
      <Footer />
    </div>
  )
} 