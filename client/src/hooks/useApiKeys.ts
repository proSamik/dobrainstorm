'use client'

import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ApiProvider } from '@/lib/models/providers'
import { ApiKeyData, updateApiKey, setApiKeys } from '@/store/settingsSlice'
import { authService } from '@/services/auth'
import { RootState } from '@/store'

/**
 * Hook for loading and managing API keys
 */
export function useApiKeys() {
  const dispatch = useDispatch()
  const storeApiKeys = useSelector((state: RootState) => state.settings.apiKeys)
  const keysFetched = useSelector((state: RootState) => state.settings.keysFetched)
  
  const [isLoading, setIsLoading] = useState(!keysFetched)
  const [error, setError] = useState<string | null>(null)

  // Load API keys from server
  const loadApiKeys = async () => {
    // If keys are already fetched, no need to fetch again
    if (keysFetched) {
      return storeApiKeys
    }
    
    setIsLoading(true)
    setError(null)
    
    try {
      // Fetch API keys from backend
      const response = await authService.get('/settings/api-keys')
      
      // Process and normalize response
      const processedKeys: Record<ApiProvider, ApiKeyData> = {} as Record<ApiProvider, ApiKeyData>

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
      
      // Update Redux store
      dispatch(setApiKeys(processedKeys))
      return processedKeys
    } catch (err) {
      console.error('Error fetching API keys:', err)
      setError('Failed to load saved API keys. Please try again.')
      return {} as Record<ApiProvider, ApiKeyData>
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
          models: data.models || [],
          selectedModel: data.selectedModel || ''
        }
      }
      
      // Save to server using authService which handles authentication
      const response = await authService.post('/settings/save-keys', keysToSave)
      
      if (response && response.data && response.data.success) {
        // Update Redux store with the new key data
        dispatch(updateApiKey({ provider, data }))
        return true
      } else {
        throw new Error(response?.data?.error || 'Failed to save API key')
      }
    } catch (error) {
      console.error('Error saving API key:', error)
      throw error
    }
  }

  // Load keys on mount if they haven't been fetched yet
  useEffect(() => {
    if (!keysFetched) {
      loadApiKeys()
    } else {
      setIsLoading(false)
    }
  }, [keysFetched])

  return {
    isLoading,
    error,
    apiKeys: storeApiKeys,
    loadApiKeys,
    saveApiKey
  }
} 