'use client'

import React, { useState, useEffect } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiProvider } from '@/lib/models/providers'
import { providers, filterModels } from '@/lib/models/providers'
import { Spinner } from '@/components/ui/spinner'
import ProviderDocumentation from './ProviderDocumentation'
import ConnectionTester from './ConnectionTester'
import ModelSelector from './ModelSelector'
import { X } from 'lucide-react'
import { ApiKeyData } from '@/store/settingsSlice'

interface ApiKeyModalProps {
  provider: ApiProvider
  isOpen: boolean
  onClose: () => void
  initialData?: ApiKeyData
  onSave: (provider: ApiProvider, data: ApiKeyData) => void
}

/**
 * Modal for adding or editing an API key with documentation and testing
 */
export default function ApiKeyModal({
  provider,
  isOpen,
  onClose,
  initialData,
  onSave
}: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState('')
  const [isValid, setIsValid] = useState(false)
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const providerConfig = providers[provider]

  // Initialize state from initialData
  useEffect(() => {
    if (initialData) {
      setApiKey(initialData.key || '')
      setIsValid(initialData.isValid || false)
      setModels(initialData.models || [])
      setSelectedModel(initialData.selectedModel || '')
    }
    setIsLoading(false)
  }, [initialData, provider])

  // Handle successful connection test
  const handleConnectionSuccess = (availableModels: string[]) => {
    setError(null)
    setIsValid(true)
    
    // Filter models based on provider's supported list
    const filteredModels = filterModels(provider, availableModels)
    setModels(filteredModels)
    
    // If we have models but no selection, select the first one
    if (filteredModels.length > 0 && !selectedModel) {
      setSelectedModel(filteredModels[0])
    }
  }

  // Handle connection test error
  const handleConnectionError = (errorMessage: string) => {
    setError(errorMessage)
    setIsValid(false)
    setModels([])
    setSelectedModel('')
  }

  // Handle model selection change
  const handleModelChange = (model: string) => {
    setSelectedModel(model)
  }

  // Save the validated API key and selected model
  const handleSave = async () => {
    if (!isValid || !apiKey) {
      setError('Please validate the API key before saving')
      return
    }

    if (!selectedModel && models.length > 0) {
      setError('Please select a default model')
      return
    }

    setIsSaving(true)

    try {
      await onSave(provider, {
        key: apiKey,
        isValid,
        models,
        selectedModel
      })
      
      // Close modal after successful save
      onClose()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to save API key')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md md:max-w-2xl" aria-describedby="loading-description">
          <DialogDescription id="loading-description" className="sr-only">
            Loading API key configuration
          </DialogDescription>
          <div className="flex justify-center items-center py-20">
            <Spinner size="lg" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md md:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">
              {initialData?.key ? 'Edit' : 'Add'} {providerConfig.displayName} API Key
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 rounded-full"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Configure your {providerConfig.displayName} API key to use with your boards.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Documentation */}
          <ProviderDocumentation provider={provider} />

          {/* API Key Input */}
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder={`Enter your ${providerConfig.displayName} API Key`}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value)
                // Reset validation when key changes
                if (isValid) {
                  setIsValid(false) 
                }
              }}
              className={`border ${
                isValid ? 'border-green-500' : error ? 'border-red-500' : 'border-gray-300 dark:border-gray-700'
              }`}
            />
            
            {error && (
              <p className="text-sm text-red-500 break-words max-w-full">
                {error}
              </p>
            )}

            {/* Connection Test Button */}
            <ConnectionTester
              provider={provider}
              apiKey={apiKey}
              onSuccess={handleConnectionSuccess}
              onError={handleConnectionError}
              className="mt-2"
            />
          </div>

          {/* Model Selector (only shown after successful validation) */}
          {isValid && models.length > 0 && (
            <ModelSelector
              models={models}
              selectedModel={selectedModel}
              onModelChange={handleModelChange}
              className="mt-4"
            />
          )}
        </div>

        <DialogFooter className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid || (models.length > 0 && !selectedModel) || isSaving}
          >
            {isSaving ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Saving...
              </>
            ) : (
              'Save API Key'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 