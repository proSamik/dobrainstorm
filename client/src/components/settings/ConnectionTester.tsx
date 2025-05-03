'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Check, AlertCircle } from 'lucide-react'
import { ApiProvider } from '@/lib/models/providers'
import { toast } from 'sonner'
import { useProviderValidation } from '@/hooks/useProviderValidation'

interface ConnectionTesterProps {
  provider: ApiProvider
  apiKey: string
  onSuccess: (models: string[]) => void
  onError: (error: string) => void
  className?: string
}

/**
 * Component to test API key connection
 */
export default function ConnectionTester({
  provider,
  apiKey,
  onSuccess,
  onError,
  className = ''
}: ConnectionTesterProps) {
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const { results, validateKey } = useProviderValidation()
  
  // Get the validation state for this provider
  const providerResult = results[provider]
  const isValidating = providerResult?.isValidating || false

  // Test connection with current API key
  const testConnection = async () => {
    if (!apiKey?.trim()) {
      onError('API key cannot be empty')
      return
    }

    setConnectionStatus('idle')

    try {
      const result = await validateKey(provider, apiKey)

      if (result.isValid) {
        setConnectionStatus('success')
        onSuccess(result.models || [])
        toast.success(`${provider} API key verified successfully!`)
      } else {
        setConnectionStatus('error')
        onError(result.error || 'Failed to validate API key')
        toast.error(`${provider} API key validation failed`)
      }
    } catch (error) {
      setConnectionStatus('error')
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      onError(errorMessage)
      toast.error(`Connection test failed: ${errorMessage}`)
    }
  }

  return (
    <div className={`flex flex-col ${className}`}>
      <Button
        onClick={testConnection}
        disabled={isValidating || !apiKey?.trim()}
        variant={connectionStatus === 'error' ? 'destructive' : 'default'}
        className="mt-2"
      >
        {isValidating ? (
          <>
            <Spinner size="sm" className="mr-2" />
            Testing Connection...
          </>
        ) : connectionStatus === 'success' ? (
          <>
            <Check className="mr-2 h-4 w-4" />
            Connection Verified
          </>
        ) : connectionStatus === 'error' ? (
          <>
            <AlertCircle className="mr-2 h-4 w-4" />
            Test Failed - Try Again
          </>
        ) : (
          'Test Connection'
        )}
      </Button>

      {connectionStatus === 'success' && (
        <p className="text-sm text-green-600 dark:text-green-400 mt-2">
          Connection successful! Models found and ready for use.
        </p>
      )}
    </div>
  )
} 