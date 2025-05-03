'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, AlertCircle, Plus, Edit } from 'lucide-react'
import { ApiProvider, providers } from '@/lib/models/providers'
import { maskApiKey } from '@/lib/apiValidation'
import Image from 'next/image'
import { ApiKeyData } from '@/store/settingsSlice'

interface ApiProviderListItemProps {
  provider: ApiProvider
  isConfigured: boolean
  apiKey?: string
  onAddClick: (provider: ApiProvider) => void
  onEditClick: (provider: ApiProvider) => void
}

/**
 * Individual provider card in the list
 */
function ApiProviderListItem({
  provider,
  isConfigured,
  apiKey,
  onAddClick,
  onEditClick
}: ApiProviderListItemProps) {
  const providerConfig = providers[provider]

  return (
    <Card className={`p-4 border ${
      isConfigured ? 'border-green-200 dark:border-green-900' : 'border-gray-200 dark:border-gray-800'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {providerConfig.logoPath ? (
            <div className="h-10 w-10 relative flex-shrink-0">
              <Image
                src={providerConfig.logoPath}
                alt={providerConfig.displayName}
                width={40}
                height={40}
                className="object-contain"
              />
            </div>
          ) : (
            <div className="h-10 w-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-medium">
                {providerConfig.displayName.charAt(0)}
              </span>
            </div>
          )}
          <div>
            <h3 className="font-medium">{providerConfig.displayName}</h3>
            {isConfigured ? (
              <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                <Check className="mr-1 h-3 w-3" />
                Configured
              </div>
            ) : (
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <AlertCircle className="mr-1 h-3 w-3" />
                Not configured
              </div>
            )}
          </div>
        </div>

        {isConfigured && apiKey ? (
          <>
            <div className="hidden md:block text-sm mr-2 font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
              {maskApiKey(apiKey)}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEditClick(provider)}
              className="flex-shrink-0"
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
          </>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAddClick(provider)}
            className="flex-shrink-0"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        )}
      </div>
    </Card>
  )
}

interface ApiProviderListProps {
  apiKeys: Record<ApiProvider, ApiKeyData | undefined>
  onAddProvider: (provider: ApiProvider) => void
  onEditProvider: (provider: ApiProvider) => void
  isBasicTier?: boolean
}

/**
 * List of API providers with add/edit buttons
 */
export default function ApiProviderList({
  apiKeys,
  onAddProvider,
  onEditProvider,
  isBasicTier = false
}: ApiProviderListProps) {
  return (
    <div className="space-y-6">
      {isBasicTier && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-md">
          <p className="text-amber-800 dark:text-amber-300 text-sm">
            You are on the Basic tier. You will need to use your own API keys for these services.
            Upgrade your plan for more features.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {Object.keys(providers).map((providerKey) => {
          const provider = providerKey as ApiProvider
          const providerData = apiKeys[provider]
          
          return (
            <ApiProviderListItem
              key={provider}
              provider={provider}
              isConfigured={!!providerData?.isValid}
              apiKey={providerData?.key}
              onAddClick={onAddProvider}
              onEditClick={onEditProvider}
            />
          )
        })}
      </div>
    </div>
  )
} 