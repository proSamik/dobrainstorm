'use client'

import { useState, useEffect } from 'react'
import { ApiProvider } from '@/lib/models/providers'
import { ApiKeyData } from '@/app/(user)/boards/settings/page'
import { authService } from '@/services/auth'

/**
 * Hook for loading and managing API keys
 */
export function useApiKeys() {
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [apiKeys, setApiKeys] = useState<Record<ApiProvider, ApiKeyData | undefined>>({} as Record<ApiProvider, ApiKeyData | undefined>)

  // Load API keys from server
  const loadApiKeys = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Fetch API keys from backend
      const response = await authService.get('/settings/api-keys')
      
      // Process and normalize response
      const processedKeys: Record<ApiProvider, ApiKeyData | undefined> = {} as Record<ApiProvider, ApiKeyData | undefined>

      // Initialize with empty values for all providers
      for (const provider of Object.keys(response) as ApiProvider[]) {
        const providerData = response[provider]
        
        if (providerData) {
          // Skip if key contains bullets or is otherwise invalid
          const isInvalidKey = !providerData.key || 
            providerData.key.includes('•') || 
            providerData.key.includes('Bearer');
          
          if (!isInvalidKey) {
            processedKeys[provider] = {
              key: providerData.key,
              isValid: !!providerData.isValid,
              models: Array.isArray(providerData.models) ? providerData.models : [],
              selectedModel: providerData.selectedModel || ''
            }
          }
        }
      }
      
      setApiKeys(processedKeys)
      return processedKeys
    } catch (err) {
      console.error('Error fetching API keys:', err)
      setError('Failed to load saved API keys. Please try again.')
      return {} as Record<ApiProvider, ApiKeyData | undefined>
    } finally {
      setIsLoading(false)
    }
  }

  // Save API key
  const saveApiKey = async (provider: ApiProvider, data: ApiKeyData) => {
    try {
      // Format data for the server
      const keysToSave = {
        [provider]: {
          key: data.key,
          models: [data.selectedModel, ...data.models.filter(model => model !== data.selectedModel)]
        }
      }
      
      // Save to server using authService which handles authentication
      const response = await authService.post('/settings/save-keys', keysToSave)
      
      if (response && response.data && response.data.success) {
        // Update local state with the new key data
        setApiKeys(prev => ({
          ...prev,
          [provider]: data
        }))
        
        return true
      } else {
        throw new Error(response?.data?.error || 'Failed to save API key')
      }
    } catch (error) {
      console.error('Error saving API key:', error)
      throw error
    }
  }

  // Load keys on mount
  useEffect(() => {
    loadApiKeys()
  }, [])

  return {
    isLoading,
    error,
    apiKeys,
    loadApiKeys,
    saveApiKey
  }
} 