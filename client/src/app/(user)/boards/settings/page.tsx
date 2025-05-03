'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui/spinner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import FeedbackButton from '@/components/ui/FeedbackButton'
import ApiProviderList from '@/components/settings/ApiProviderList'
import ApiKeyModal from '@/components/settings/ApiKeyModal'
import { ApiProvider } from '@/lib/models/providers' 
import { useUserData } from '@/contexts/UserDataContext'
import { useApiKeys } from '@/hooks/useApiKeys'
import { ApiKeyData } from '@/store/settingsSlice'

/**
 * Settings page for managing API keys and connections
 * Allows users to set up and validate different AI providers
 */
export default function BoardsSettings() {
  const router = useRouter()
  const { userData } = useUserData()
  
  // Use our custom hook for managing API keys
  const { isLoading, error, apiKeys, saveApiKey } = useApiKeys()
  
  // Modal state
  const [selectedProvider, setSelectedProvider] = useState<ApiProvider | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Check if user is on basic tier
  const isBasicTier = userData?.subscription?.productId === process.env.NEXT_PUBLIC_CREEM_PRODUCT_ID_1

  // Handle opening the modal to add a new provider
  const handleAddProvider = (provider: ApiProvider) => {
    setSelectedProvider(provider)
    setIsModalOpen(true)
  }
  
  // Handle opening the modal to edit an existing provider
  const handleEditProvider = (provider: ApiProvider) => {
    setSelectedProvider(provider)
    setIsModalOpen(true)
  }
  
  // Handle closing the modal
  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedProvider(null)
  }
  
  // Handle saving API key changes
  const handleSaveApiKey = async (provider: ApiProvider, data: ApiKeyData) => {
    try {
      await saveApiKey(provider, data)
      toast.success(`${provider} API key saved successfully!`)
    } catch (error) {
      toast.error(`Failed to save API key: ${error instanceof Error ? error.message : 'Unknown error'}`)
      throw error
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <FeedbackButton position="bottom-right" />
      
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">API Settings</h1>
        <Button variant="outline" onClick={() => router.push('/boards')}>
          Back to Boards
        </Button>
      </div>
      
      {error && (
        <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
      
      <Card className="p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">AI Provider Configuration</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Configure your AI provider API keys to enable advanced features in your brainstorm boards.
          Click &quot;Add&quot; to set up a new API key or &quot;Edit&quot; to modify an existing one.
        </p>
        
        <ApiProviderList
          apiKeys={apiKeys}
          onAddProvider={handleAddProvider}
          onEditProvider={handleEditProvider}
          isBasicTier={isBasicTier}
        />
      </Card>
      
      {/* Modal for adding/editing API keys */}
      {selectedProvider && (
        <ApiKeyModal
          provider={selectedProvider}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          initialData={apiKeys[selectedProvider]}
          onSave={handleSaveApiKey}
        />
      )}
    </div>
  )
} 