'use client'

import React, { useEffect, useState } from 'react'
import { Check, RefreshCcw, Loader2, Search, X } from 'lucide-react'
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
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ChatModelSelectorProps {
  className?: string;
  onSelectModel?: (modelId: string) => void;
  compact?: boolean;
}

/**
 * Model selector component for chat interface
 * Allows selecting models from OpenRouter grouped by type
 */
export default function ChatModelSelector({ className, onSelectModel }: ChatModelSelectorProps) {
  const dispatch = useAppDispatch()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  
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

  // Filter models based on search term
  const filterModels = (modelList: any[]) => {
    if (!searchTerm) return modelList;
    return modelList.filter(model => 
      model.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  // Get the current filtered models based on category tab and search
  const getFilteredModels = () => {
    switch (activeTab) {
      case 'free':
        return filterModels(freeModels);
      case 'text':
        return filterModels(textToTextModels);
      case 'image':
        return filterModels(textImageToTextModels);
      default:
        return filterModels(models);
    }
  }

  // Get the selected model name for display
  const getSelectedModelName = () => {
    if (!selectedModel) return "Select model";
    const model = models.find(m => m.id === selectedModel);
    return model ? model.name : "Selected model";
  }

  // Show loading spinner while fetching models
  if (loading && models.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger className={`h-9 ${className} bg-white dark:bg-dark-background`}>
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
          <SelectTrigger className="h-9 flex-1 bg-white dark:bg-dark-background">
            <span className="text-red-500">Failed to load models</span>
          </SelectTrigger>
        </Select>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleRefresh} 
          className="h-9 w-9 p-0"
          title="Retry loading models"
        >
          <RefreshCcw className="h-4 w-4" />
        </Button>
      </div>
    )
  }

    return (
      <div className={`flex items-center gap-2 ${className} z-10`}>
        <Select 
          value={selectedModel || undefined} 
          onValueChange={handleModelSelect}
        >
          <SelectTrigger className="h-9 flex-1 bg-white dark:bg-dark-background min-w-[180px]">
            <SelectValue placeholder="Select a model">
              {getSelectedModelName()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[300px] overflow-hidden">
            {/* Search input and tabs (sticky) */}
            <div className="sticky top-0 z-10 bg-white dark:bg-dark-background">
              {/* Search input */}
              <div className="p-2 border-b">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                    placeholder="Search models..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 h-9"
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1 h-7 w-7 p-0"
                      onClick={() => setSearchTerm('')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Category tabs */}
              <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
                <TabsList className="w-full grid grid-cols-4">
                  <TabsTrigger value="all" className={activeTab === 'all' ? 'border-b-2 border-blue-500' : ''}>All</TabsTrigger>
                  <TabsTrigger value="free" className={activeTab === 'free' ? 'border-b-2 border-blue-500' : ''}>Free</TabsTrigger>
                  <TabsTrigger value="text" className={activeTab === 'text' ? 'border-b-2 border-blue-500' : ''}>Text</TabsTrigger>
                  <TabsTrigger value="image" className={activeTab === 'image' ? 'border-b-2 border-blue-500' : ''}>Img+Text</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Scrollable models list */}
            <div className="max-h-[200px] overflow-y-auto top-0 z-10 bg-white dark:bg-dark-background">
              {getFilteredModels().length > 0 ? (
                <SelectGroup>
                  {getFilteredModels().map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center justify-between w-full">
                        <span className="truncate">{model.name}</span>
                        {model.isFree && <span className="text-xs text-blue-500 ml-1">(free)</span>}
                        {model.id === selectedModel && <Check className="h-4 w-4 ml-2 flex-shrink-0" />}
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              ) : (
                <div className="p-2 text-center text-gray-500">No models found</div>
              )}
            </div>
          </SelectContent>
        </Select>
        
        {/* Refresh button */}
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleRefresh} 
          className="h-9 w-9 p-0"
          disabled={loading}
          title="Refresh models list"
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    )
}
