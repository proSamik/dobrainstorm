'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { useAppDispatch, useAppSelector } from '@/hooks/useRedux'
import { fetchModels, fetchUserPreferences, saveUserPreferences as savePrefAction } from '@/store/modelsSlice'
import ModelSelector from '@/components/settings/ModelSelector'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/ui/spinner'
import { Save, RefreshCw } from 'lucide-react'

interface UserPreferencesProps {
  className?: string
}

/**
 * Component for managing user preferences, including default model selection
 * and custom preference settings in markdown format
 */
export default function UserPreferences({ className = '' }: UserPreferencesProps) {
  const dispatch = useAppDispatch()
  const { models, loading: modelsLoading, userPreferences: storePreferences } = useAppSelector(state => state.models)
  
  const [userPreferences, setUserPreferences] = useState('')
  const [defaultModel, setDefaultModel] = useState('')
  const [originalPreferences, setOriginalPreferences] = useState('')
  const [originalModel, setOriginalModel] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })

  // Check if any changes have been made
  const hasChanges = userPreferences !== originalPreferences || defaultModel !== originalModel

  // Update local state from Redux store when it changes
  useEffect(() => {
    if (storePreferences) {
      if (storePreferences.userPreferences) {
        setUserPreferences(storePreferences.userPreferences)
        setOriginalPreferences(storePreferences.userPreferences)
      }
      
      if (storePreferences.defaultModel) {
        setDefaultModel(storePreferences.defaultModel)
        setOriginalModel(storePreferences.defaultModel)
      }
    }
  }, [storePreferences])

  // Load user preferences - first from store, then from API if needed
  const loadUserPreferences = useCallback(async (forceRefresh = false) => {
    // If preferences already in store and not forcing refresh, use those
    if (storePreferences && !forceRefresh) {
      return;
    }
    
    setIsLoading(true);
    try {
      // Dispatch action to fetch preferences from API
      await dispatch(fetchUserPreferences()).unwrap();
      setMessage({ text: '', type: '' });
    } catch (error) {
      console.error('Error loading user preferences:', error);
      setMessage({ 
        text: 'Failed to load preferences. Please try again.', 
        type: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  }, [dispatch, storePreferences]);

  // Initial data load
  useEffect(() => {
    loadUserPreferences();
  }, [loadUserPreferences]);

  // Load models if not loaded yet, and set default model once models are loaded
  useEffect(() => {
    if (models.length === 0) {
      dispatch(fetchModels());
    } else if (originalModel && !defaultModel && models.some(m => m.id === originalModel)) {
      // If models loaded after preferences, set the default model
      setDefaultModel(originalModel);
    }
  }, [dispatch, models, originalModel, defaultModel]);

  // Handle model selection
  const handleModelChange = (modelId: string) => {
    setDefaultModel(modelId);
  };

  // Handle preferences text change
  const handlePreferencesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserPreferences(e.target.value);
  };

  // Save preferences to server
  const savePreferences = async () => {
    setIsSaving(true);
    setMessage({ text: '', type: '' });
    
    try {
      // Save via Redux action
      await dispatch(savePrefAction({
        userPreferences,
        defaultModel,
        defaultProvider: 'OPENROUTER'
      })).unwrap();
      
      setMessage({ 
        text: 'Preferences saved successfully.', 
        type: 'success' 
      });
      
      // Store will be updated via the thunk, which will update local state via the useEffect
    } catch (error) {
      console.error('Error saving preferences:', error);
      setMessage({ 
        text: 'Failed to save preferences. Please try again.', 
        type: 'error' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Sync models from server and refresh the list
  const syncModels = () => {
    dispatch(fetchModels());
    loadUserPreferences(true); // Force refresh from API
  };

  // Extract model IDs for selector
  const modelIds = models.map(model => model.id);

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-light-foreground dark:text-dark-foreground">
          User Preferences
        </h3>
        <Button
          onClick={syncModels}
          disabled={modelsLoading || isLoading}
          variant="outline"
          size="sm"
        >
          {modelsLoading || isLoading ? <Spinner size="sm" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Refresh Models
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          {/* Status message */}
          {message.text && (
            <div 
              className={`p-3 rounded ${
                message.type === 'error' 
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="space-y-6 rounded-lg bg-light-card dark:bg-dark-card p-6 shadow-sm">
            {/* Default model selection */}
            <ModelSelector
              models={modelIds}
              selectedModel={defaultModel}
              onModelChange={handleModelChange}
              isLoading={modelsLoading}
            />

            {/* User preferences markdown editor */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-light-foreground dark:text-dark-foreground">
                Custom Preferences (Markdown)
              </label>
              <Textarea
                value={userPreferences}
                onChange={handlePreferencesChange}
                placeholder="Enter your preferences in markdown format..."
                className="h-32 resize-y bg-light-background dark:bg-dark-background"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Use markdown to format your preferences. These can be used by AI models to personalize responses.
              </p>
            </div>

            {/* Save button */}
            <div className="flex justify-end">
              <Button 
                onClick={savePreferences}
                disabled={isSaving || modelsLoading || !hasChanges}
                className="px-4 py-2"
              >
                {isSaving ? <Spinner className="mr-2" size="sm" /> : <Save className="h-4 w-4 mr-1" />}
                Save Preferences
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
} 