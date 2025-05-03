'use client'

import React from 'react'
import { ExternalLink } from 'lucide-react'
import { ApiProvider } from '@/lib/models/providers'
import { providerDocs } from '@/lib/providers/documentation'

interface ProviderDocumentationProps {
  provider: ApiProvider
  className?: string
}

/**
 * Component to display setup instructions and documentation for an API provider
 */
export default function ProviderDocumentation({
  provider,
  className = ''
}: ProviderDocumentationProps) {
  const docs = providerDocs[provider]

  if (!docs) {
    return (
      <div className={`p-4 bg-gray-100 dark:bg-gray-800 rounded-md ${className}`}>
        <p className="text-gray-500 dark:text-gray-400">
          Documentation not available for this provider.
        </p>
      </div>
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-col">
        <h3 className="text-lg font-medium mb-2">{docs.title}</h3>
        <a
          href={docs.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center"
        >
          {docs.urlText}
          <ExternalLink className="ml-1 h-4 w-4" />
        </a>
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        {docs.steps.map((step, index) => (
          <React.Fragment key={index}>
            {step ? (
              <p className="my-1 text-sm text-gray-700 dark:text-gray-300">{step}</p>
            ) : (
              <div className="my-2" /> /* Empty line spacing */
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
} 