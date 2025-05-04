'use client'

import React, { useState, useRef } from 'react'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'

interface ModelSelectorProps {
  models: string[]
  selectedModel: string
  onModelChange: (model: string) => void
  isLoading?: boolean
  className?: string
}

/**
 * Component for selecting a model from the available list
 * Supports searching and scrolling through models
 */
export default function ModelSelector({
  models,
  selectedModel,
  onModelChange,
  isLoading = false,
  className = ''
}: ModelSelectorProps) {
  // State for search input
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // If no models, or only one model (which is already selected), don't render
  if (!models?.length || (models.length === 1 && models[0] === selectedModel)) {
    return null
  }

  // Filter models based on search query
  const filteredModels = models.filter(model => 
    model.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Handle search input click to prevent closing dropdown
  const handleSearchClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
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
          open={isOpen}
          onOpenChange={setIsOpen}
        >
          <SelectTrigger className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700">
            <SelectValue placeholder="-- Select a default model --" />
          </SelectTrigger>
          <SelectContent 
            className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700"
            style={{ maxHeight: '300px' }}
            onCloseAutoFocus={(e) => {
              e.preventDefault()
            }}
          >
            {/* Search input */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
                <Input
                  ref={searchInputRef}
                  placeholder="Search models..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onClick={handleSearchClick}
                  className="pl-8 py-2 w-full text-sm bg-gray-50 dark:bg-gray-800"
                />
              </div>
            </div>
            
            <div className="overflow-y-auto scrollbar-visible" style={{ 
              maxHeight: '200px',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(156, 163, 175, 0.5) transparent'
            }}>
              {/* Put selected model at the top */}
              {selectedModel && filteredModels.includes(selectedModel) && (
                <SelectItem
                  key={`current-${selectedModel}`}
                  value={selectedModel}
                  className="font-medium text-primary"
                >
                  {selectedModel} (currently selected)
                </SelectItem>
              )}
              
              {/* Show all other filtered models */}
              {filteredModels
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

              {/* Show message when no models match the search */}
              {filteredModels.length === 0 && (
                <div className="py-3 px-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                  No models match your search
                </div>
              )}
            </div>
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