'use client'

import React from 'react'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'

interface ModelSelectorProps {
  models: string[]
  selectedModel: string
  onModelChange: (model: string) => void
  isLoading?: boolean
  className?: string
}

/**
 * Component for selecting a model from the available list
 */
export default function ModelSelector({
  models,
  selectedModel,
  onModelChange,
  isLoading = false,
  className = ''
}: ModelSelectorProps) {
  // If no models, or only one model (which is already selected), don't render
  if (!models?.length || (models.length === 1 && models[0] === selectedModel)) {
    return null
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Select Default Model:
        </h4>
        {isLoading && <Spinner size="sm" />}
      </div>

      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md">
        <Select
          value={selectedModel}
          onValueChange={onModelChange}
          disabled={isLoading}
        >
          <SelectTrigger className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700">
            <SelectValue placeholder="-- Select a default model --" />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700">
            {/* Put selected model at the top */}
            {selectedModel && models.includes(selectedModel) && (
              <SelectItem
                key={`current-${selectedModel}`}
                value={selectedModel}
                className="font-medium text-primary"
              >
                {selectedModel} (currently selected)
              </SelectItem>
            )}
            
            {/* Show all other models */}
            {models
              .filter(model => model !== selectedModel)
              .map(model => (
                <SelectItem
                  key={model}
                  value={model}
                  className="hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  {model}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        {!selectedModel && models.length > 0 && (
          <p className="text-amber-600 dark:text-amber-400 text-sm mt-2">
            Please select a default model
          </p>
        )}
        
        {selectedModel && (
          <p className="text-green-600 dark:text-green-400 text-sm mt-2">
            Selected model: {selectedModel}
          </p>
        )}
      </div>
    </div>
  )
} 