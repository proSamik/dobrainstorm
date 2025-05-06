'use client'

import React, { useEffect } from 'react'
import { Check, RefreshCcw, Loader2 } from 'lucide-react'
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectLabel, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux'
import { fetchModels, setSelectedModel } from '@/store/modelsSlice'

interface ChatModelSelectorProps {
  className?: string;
  onSelectModel?: (modelId: string) => void;
}

/**
 * Model selector component for chat interface
 * Allows selecting models from OpenRouter grouped by type
 */
export default function ChatModelSelector({ className, onSelectModel }: ChatModelSelectorProps) {
  const dispatch = useAppDispatch()
  
  // Get models from Redux store
  const { 
    models,
    freeModels,
    textToTextModels,
    textImageToTextModels,
    selectedModel,
    loading,
    error,
    lastFetched
  } = useAppSelector(state => state.models)

  // Fetch models if not already loaded
  useEffect(() => {
    // Only fetch models if they haven't been loaded or 24 hours have passed since last fetch
    const shouldRefresh = !lastFetched || (Date.now() - lastFetched) > 24 * 60 * 60 * 1000
    
    if (models.length === 0 || shouldRefresh) {
      dispatch(fetchModels())
    }
  }, [dispatch, models.length, lastFetched])

  // Handle model selection
  const handleModelSelect = (value: string) => {
    dispatch(setSelectedModel(value))
    if (onSelectModel) {
      onSelectModel(value)
    }
  }

  // Handle manual refresh
  const handleRefresh = () => {
    dispatch(fetchModels())
  }

  // Show loading spinner while fetching models
  if (loading && models.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger className={`h-9 ${className}`}>
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading models...</span>
          </div>
        </SelectTrigger>
      </Select>
    )
  }

  // Show error state
  if (error && models.length === 0) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Select disabled>
          <SelectTrigger className="h-9 flex-1">
            <span className="text-red-500">Failed to load models</span>
          </SelectTrigger>
        </Select>
        <Button 
          variant="ghost" 
          size="lg" // Changed from "icon" to "lg"
          onClick={handleRefresh} 
          className="h-9 w-9"
          title="Retry loading models"
        >
          <RefreshCcw className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Select 
        value={selectedModel || undefined} 
        onValueChange={handleModelSelect}
      >
        <SelectTrigger className="h-9 flex-1">
          <SelectValue placeholder="Select a model" />
        </SelectTrigger>
        <SelectContent>
          {/* Free models group */}
          {freeModels.length > 0 && (
            <SelectGroup>
              <SelectLabel>Free Models</SelectLabel>
              {freeModels.map(model => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center justify-between w-full">
                    <span className="truncate">{model.name}</span>
                    {model.id === selectedModel && <Check className="h-4 w-4 ml-2" />}
                  </div>
                </SelectItem>
              ))}
            </SelectGroup>
          )}

          {/* Text to Text models */}
          {textToTextModels.filter(m => !m.isFree).length > 0 && (
            <SelectGroup>
              <SelectLabel>Text → Text</SelectLabel>
              {textToTextModels
                .filter(m => !m.isFree)
                .map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center justify-between w-full">
                      <span className="truncate">{model.name}</span>
                      {model.id === selectedModel && <Check className="h-4 w-4 ml-2" />}
                    </div>
                  </SelectItem>
                ))}
            </SelectGroup>
          )}

          {/* Text+Image to Text models */}
          {textImageToTextModels.filter(m => !m.isFree).length > 0 && (
            <SelectGroup>
              <SelectLabel>Text+Image → Text</SelectLabel>
              {textImageToTextModels
                .filter(m => !m.isFree)
                .map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex items-center justify-between w-full">
                      <span className="truncate">{model.name}</span>
                      {model.id === selectedModel && <Check className="h-4 w-4 ml-2" />}
                    </div>
                  </SelectItem>
                ))}
            </SelectGroup>
          )}
        </SelectContent>
      </Select>
      
      {/* Refresh button */}
      <Button 
        variant="ghost" 
        size="lg" // Changed from "icon" to "lg"
        onClick={handleRefresh} 
        className="h-9 w-9"
        disabled={loading}
        title="Refresh models list"
      >
        <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  )
} 