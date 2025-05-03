'use client'

import { useState } from 'react'
import { ApiProvider } from '@/lib/models/providers'

interface ValidationResult {
  isValid: boolean
  models: string[]
  error?: string
  isValidating: boolean
}

/**
 * Hook for validating API provider keys directly from the client
 * Makes direct API calls to the provider endpoints instead of proxying through a server
 */
export function useProviderValidation() {
  const [results, setResults] = useState<Record<string, ValidationResult>>({})

  /**
   * Validate an OpenAI API key
   */
  const validateOpenAI = async (apiKey: string): Promise<ValidationResult> => {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          isValid: false,
          models: [],
          error: data.error?.message || `Error: ${response.status} ${response.statusText}`,
          isValidating: false
        }
      }

      // Extract model names
      const models = data.data.map((model: any) => model.id)
      
      return {
        isValid: true,
        models,
        isValidating: false
      }
    } catch (error) {
      return {
        isValid: false,
        models: [],
        error: error instanceof Error ? error.message : 'Network error occurred',
        isValidating: false
      }
    }
  }

  /**
   * Validate a Google Gemini API key
   */
  const validateGemini = async (apiKey: string): Promise<ValidationResult> => {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          isValid: false,
          models: [],
          error: data.error?.message || `Error: ${response.status} ${response.statusText}`,
          isValidating: false
        }
      }

      // Extract model names
      const models = data.models?.map((model: any) => model.name.split('/').pop()) || []
      
      return {
        isValid: true,
        models,
        isValidating: false
      }
    } catch (error) {
      return {
        isValid: false,
        models: [],
        error: error instanceof Error ? error.message : 'Network error occurred',
        isValidating: false
      }
    }
  }

  /**
   * Validate a Kluster AI API key (uses OpenAI SDK format)
   */
  const validateKlusterv1 = async (apiKey: string): Promise<ValidationResult> => {
    try {
      // Kluster uses OpenAI-compatible API with a different base URL
      const response = await fetch('https://api.kluster.ai/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          isValid: false,
          models: [],
          error: data.error?.message || `Error: ${response.status} ${response.statusText}`,
          isValidating: false
        }
      }

      // Extract model names
      const models = data.data?.map((model: any) => model.id) || []
      
      return {
        isValid: true,
        models,
        isValidating: false
      }
    } catch (error) {
      return {
        isValid: false,
        models: [],
        error: error instanceof Error ? error.message : 'Network error occurred',
        isValidating: false
      }
    }
  }

  /**
   * Validate an OpenRouter API key
   */
  const validateOpenRouter = async (apiKey: string): Promise<ValidationResult> => {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'API Key Validation'
        }
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          isValid: false,
          models: [],
          error: data.error?.message || `Error: ${response.status} ${response.statusText}`,
          isValidating: false
        }
      }

      // Extract model names (OpenRouter uses id or name depending on the model)
      const models = data.data?.map((model: any) => model.id || model.name) || []
      
      return {
        isValid: true,
        models,
        isValidating: false
      }
    } catch (error) {
      return {
        isValid: false,
        models: [],
        error: error instanceof Error ? error.message : 'Network error occurred',
        isValidating: false
      }
    }
  }

  /**
   * Validate any provider API key
   */
  const validateKey = async (provider: ApiProvider, key: string) => {
    if (!key?.trim()) {
      return {
        isValid: false,
        models: [],
        error: 'API key cannot be empty',
        isValidating: false
      }
    }

    // Set validating state for this provider
    setResults(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        isValidating: true,
        error: undefined
      }
    }))

    let result: ValidationResult

    // Call the appropriate validation function based on provider
    switch (provider) {
      case 'openai':
        result = await validateOpenAI(key)
        break
      case 'gemini':
        result = await validateGemini(key)
        break
      case 'klusterv1':
        result = await validateKlusterv1(key)
        break
      case 'openrouter':
        result = await validateOpenRouter(key)
        break
      default:
        result = {
          isValid: false,
          models: [],
          error: 'Unknown provider',
          isValidating: false
        }
    }

    // Update results state
    setResults(prev => ({
      ...prev,
      [provider]: result
    }))

    return result
  }

  return {
    results,
    validateKey
  }
} 