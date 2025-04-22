'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authService } from '@/services/auth'
import { Spinner } from '@/components/ui/spinner'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { validateApiKey } from '@/lib/apiKeyValidation'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'

// API provider types
type ApiProvider = 'openai' | 'claude' | 'klusterai'

interface ApiKeyData {
  key: string
  isValid: boolean
  models: string[]
  selectedModel: string
}

// Server response interfaces
interface ApiKeyResponse {
  key: string
  isValid: boolean
  models: string[]
  selectedModel: string
}

interface ServerResponse {
  [provider: string]: ApiKeyResponse
}

/**
 * Settings page for managing API keys and connections
 * Allows users to set up and validate different AI providers
 */
export default function BoardsSettings() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [dataReady, setDataReady] = useState(false)
  
  // API key states
  const [apiKeys, setApiKeys] = useState<Record<ApiProvider, ApiKeyData>>({
    openai: { key: '', isValid: false, models: [], selectedModel: '' },
    claude: { key: '', isValid: false, models: [], selectedModel: '' },
    klusterai: { key: '', isValid: false, models: [], selectedModel: '' },
  })
  
  // Validation state for each provider
  const [validationStates, setValidationStates] = useState<Record<ApiProvider, {
    isValidating: boolean,
    validateTimeoutRef: NodeJS.Timeout | null
  }>>({
    openai: { isValidating: false, validateTimeoutRef: null },
    claude: { isValidating: false, validateTimeoutRef: null },
    klusterai: { isValidating: false, validateTimeoutRef: null }
  })
  
  /**
   * Process API response to ensure proper data structure
   * This helps normalize the data from different server response formats
   */
  const processApiResponse = (responseData: ServerResponse) => {
    if (!responseData) {
      console.log('No response data to process');
      return {};
    }
    
    const result: Record<string, ApiKeyResponse> = {};
    
    // Process each provider in the response
    Object.keys(responseData).forEach(provider => {
      const data = responseData[provider];
      
      // Skip if no data for this provider
      if (!data) {
        console.log(`No data for provider ${provider}`);
        return;
      }
      
      console.log(`Processing ${provider} data:`, data);
      
      // Ensure models is an array 
      let models: string[] = [];
      if (Array.isArray(data.models)) {
        models = [...data.models];
        console.log(`Found ${models.length} models for ${provider}`);
      } else {
        console.log(`No models array found for ${provider}`);
      }
      
      // Get the selected model - either from the selectedModel field or the first model in the list
      let selectedModel = '';
      if (data.selectedModel) {
        selectedModel = data.selectedModel;
        console.log(`Found selectedModel for ${provider}: ${selectedModel}`);
      } else if (models.length > 0) {
        selectedModel = models[0];
        console.log(`Using first model as selected for ${provider}: ${selectedModel}`);
      }
      
      // Extract and normalize fields with proper defaults
      result[provider] = {
        key: data.key || '',
        isValid: data.isValid === true,
        models: models,
        selectedModel: selectedModel
      };
      
      // Debug log
      console.log(`Processed ${provider} provider data:`, result[provider]);
    });
    
    return result;
  };

  // Log apiKeys changes for debugging
  useEffect(() => {
    console.log('apiKeys state updated:', apiKeys);
  }, [apiKeys]);

  // Fetch existing API keys on component mount
  useEffect(() => {
    const fetchApiKeys = async () => {
      setIsLoading(true)
      setDataReady(false) // Reset data ready state
      setError(null)
      
      try {
        // Make API call to Go backend to fetch saved keys
        console.log('Fetching API keys...');
        // NOTE: authService.get directly returns the data, not a response object with a data property
        const data = await authService.get<ServerResponse>('/settings/api-keys')
        console.log('Original API Keys Response:', data); // Debug log
        
        // Process the data that comes directly from the service
        const processedData = processApiResponse(data || {});
        console.log('Processed API Keys Response:', processedData);
        
        // For each provider, update the state if a key exists
        Object.keys(processedData).forEach((provider) => {
          if (provider in apiKeys) {
            const providerData = processedData[provider];
            console.log(`Setting up ${provider} with data:`, providerData);
            
            // Only filter for openai provider to ensure we only show allowed models
            if (provider === 'openai' && providerData.models.length > 0) {
              // Get the first model as the selected one if it exists
              // Assuming the server returns the models array with the selected model first
              let selectedModel = '';
              if (providerData.selectedModel) {
                selectedModel = providerData.selectedModel;
              } else if (providerData.models.length > 0) {
                selectedModel = providerData.models[0];
              }
              
              console.log(`OpenAI selected model: ${selectedModel}`);
              
              const filteredModels = filterModels(provider as ApiProvider, providerData.models);
              console.log(`Filtered models for ${provider}:`, filteredModels);
              
              // Ensure selected model is in filtered list
              if (selectedModel && !filteredModels.includes(selectedModel) && filteredModels.length > 0) {
                selectedModel = filteredModels[0];
                console.log(`Selected model not in filtered list, defaulting to: ${selectedModel}`);
              }
              
              console.log(`Final state for ${provider}:`, {
                key: providerData.key,
                isValid: providerData.isValid,
                models: filteredModels,
                selectedModel
              });
              
              setApiKeys(prev => ({
                ...prev,
                [provider]: {
                  ...prev[provider as ApiProvider],
                  key: providerData.key,
                  isValid: providerData.isValid,
                  models: filteredModels,
                  selectedModel: selectedModel
                }
              }));
            } else {
              // For other providers, use all models
              let selectedModel = providerData.selectedModel;
              if (!selectedModel && providerData.models.length > 0) {
                selectedModel = providerData.models[0];
              }
              
              setApiKeys(prev => ({
                ...prev,
                [provider]: {
                  ...prev[provider as ApiProvider],
                  key: providerData.key,
                  isValid: providerData.isValid,
                  models: providerData.models,
                  selectedModel: selectedModel
                }
              }));
            }
          }
        });
        
        // Show success message if keys were loaded
        if (Object.keys(processedData).length > 0) {
          setSuccessMessage('Your API settings were loaded successfully');
        }
        
        // Mark data as ready
        setDataReady(true);
      } catch (err) {
        console.error('Error fetching API keys:', err)
        setError('Failed to load saved API keys. Please try again.')
        setDataReady(true) // Still mark as ready even with error so UI can show
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchApiKeys()
    
    // Cleanup any validation timeouts on unmount
    return () => {
      Object.values(validationStates).forEach(state => {
        if (state.validateTimeoutRef) {
          clearTimeout(state.validateTimeoutRef)
        }
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty dependency array to run only on mount
  
  // Handle API key input change with debounced validation
  const handleApiKeyChange = (provider: ApiProvider, value: string) => {
    // Update the key value immediately
    setApiKeys(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        key: value
      }
    }))
    
    // Clear messages when input changes
    setError(null)
    setSuccessMessage(null)
    
    // Clear any existing validation timeout
    if (validationStates[provider].validateTimeoutRef) {
      clearTimeout(validationStates[provider].validateTimeoutRef)
    }
    
    // Only validate non-empty values with a delay
    if (value.trim()) {
      const timeoutRef = setTimeout(() => {
        validateApiKeyWithTimeout(provider, value)
      }, 800) // Debounce validation for 800ms
      
      setValidationStates(prev => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          validateTimeoutRef: timeoutRef
        }
      }))
    } else {
      // Reset validation state for empty input
      setApiKeys(prev => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          isValid: false,
          models: [],
          selectedModel: ''
        }
      }))
    }
  }
  
  // Validate API key without debounce (for blur events)
  const handleApiKeyBlur = (provider: ApiProvider) => {
    const key = apiKeys[provider].key.trim()
    
    // Clear any pending validation
    if (validationStates[provider].validateTimeoutRef) {
      clearTimeout(validationStates[provider].validateTimeoutRef)
      
      setValidationStates(prev => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          validateTimeoutRef: null
        }
      }))
    }
    
    // Don't validate empty keys
    if (key) {
      validateApiKeyWithTimeout(provider, key)
    }
  }
  
  /**
   * Filter function to only show specific OpenAI models
   * @param provider - The API provider name
   * @param models - The full list of models returned by the API
   * @returns Filtered list of models
   */
  const filterModels = (provider: ApiProvider, models: string[]): string[] => {
    if (provider === 'openai') {
      // Only show these specific OpenAI models
      const allowedModels = [
        'o1',
        'o4-mini',
        'gpt-4.1-nano',
        'gpt-4.1-nano-2025-04-14',
        'o4-mini-2025-04-16',
        'gpt-4',
        'gpt-4.1-mini',
        'gpt-4.1-mini-2025-04-14',
        'gpt-4.5-preview',
        'gpt-4.5-preview-2025-02-27',
        'gpt-4.1'
      ];
      
      return models.filter(model => allowedModels.includes(model));
    }
    
    // For other providers, return the full list
    return models;
  }
  
  // Test API key connection and fetch available models
  const validateApiKeyWithTimeout = async (provider: ApiProvider, key: string) => {
    if (!key.trim()) {
      return
    }
    
    // Set validating state
    setValidationStates(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        isValidating: true
      }
    }))
    
    setError(null)
    setSuccessMessage(null)
    
    try {
      // Use axios to call the NextJS API endpoint for validation
      const response = await validateApiKey(provider, key)
      
      if (response.valid) {
        // Apply model filtering
        const filteredModels = filterModels(provider, response.models || [])
        
        setApiKeys(prev => ({
          ...prev,
          [provider]: {
            ...prev[provider],
            isValid: true,
            models: filteredModels,
            selectedModel: response.selectedModel || ''
          }
        }))
        setSuccessMessage(`${provider} API key validated successfully! Found ${filteredModels.length} available models.`)
      } else {
        setApiKeys(prev => ({
          ...prev,
          [provider]: {
            ...prev[provider],
            isValid: false,
            selectedModel: ''
          }
        }))
        setError(`Invalid ${provider} API key: ${response.error || 'Please check and try again.'}`)
      }
    } catch (err: unknown) {
      console.error(`Error validating ${provider} API key:`, err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to validate ${provider} API key. ${errorMessage}`)
      
      setApiKeys(prev => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          isValid: false
        }
      }))
    } finally {
      // Clear validating state
      setValidationStates(prev => ({
        ...prev,
        [provider]: {
          ...prev[provider],
          isValidating: false
        }
      }))
    }
  }
  
  // Save validated API keys
  const saveApiKeys = async () => {
    // Check if at least one key is valid
    const hasValidKey = Object.values(apiKeys).some(data => data.isValid)
    if (!hasValidKey) {
      setError('Please validate at least one API key before saving.')
      return
    }
    
    // Check if each valid key has a selected model
    const missingModelSelection = Object.entries(apiKeys)
      .filter(([, data]) => data.isValid && !data.selectedModel)
      .map(([provider]) => provider)
    
    if (missingModelSelection.length > 0) {
      setError(`Please select a default model for: ${missingModelSelection.join(', ')}`)
      return
    }
    
    setIsSaving(true)
    setError(null)
    
    try {
      // Only send validated keys with selected models to the server
      const keysToSave = Object.entries(apiKeys)
        .filter(([, data]) => data.isValid && data.selectedModel)
        .reduce<Record<string, { key: string; models: string[] }>>((acc, [provider, data]) => ({
          ...acc,
          [provider]: {
            key: data.key,
            models: [data.selectedModel, ...data.models.filter(model => model !== data.selectedModel)]
          }
        }), {})
      
      // Make API call to Go backend to save keys using authService
      const response = await authService.post('/settings/save-keys', keysToSave)
      
      if (response && response.data && response.data.success) {
        setSuccessMessage('API keys and model preferences saved successfully!')
        
        // Redirect back to boards after a short delay
        setTimeout(() => {
          router.push('/boards')
        }, 2000)
      } else {
        throw new Error(response?.data?.error || 'Failed to save API keys')
      }
    } catch (err: unknown) {
      console.error('Error saving API keys:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(`Failed to save API keys. ${errorMessage}`)
    } finally {
      setIsSaving(false)
    }
  }
  
  // Render model selection UI
  const renderModelList = (provider: ApiProvider) => {
    const { models, isValid, selectedModel } = apiKeys[provider];
    
    console.log(`Rendering model list for ${provider}:`, { models, isValid, selectedModel });
    
    if (!isValid || models.length === 0) {
      return null;
    }
    
    // Move selected model to top of the list if it exists and isn't already there
    const orderedModels = selectedModel ? 
      [selectedModel, ...models.filter(model => model !== selectedModel)] : 
      models;
    
    return (
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Default Model:</h4>
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md">
          <Select 
            value={selectedModel || ''}
            onValueChange={(value) => handleModelChange(provider, value)}
          >
            <SelectTrigger className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700">
              <SelectValue placeholder="-- Select a default model --" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700">
              {orderedModels.map((model) => (
                <SelectItem key={model} value={model} className="hover:bg-gray-100 dark:hover:bg-gray-800">
                  {model} {model === selectedModel ? '(currently selected)' : ''}
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
    );
  }
  
  const SettingsSection = ({ children }: { children: React.ReactNode }) => (
    <div className="space-y-4">
      {children}
    </div>
  )

  const ApiKeySection = ({
    provider,
    apiKeyData,
    handleApiKeyChange,
    handleApiKeyBlur,
    renderModelList
  }: {
    provider: ApiProvider
    apiKeyData: ApiKeyData
    handleApiKeyChange: (provider: ApiProvider, value: string) => void
    handleApiKeyBlur: (provider: ApiProvider) => void
    renderModelList: (provider: ApiProvider) => React.ReactNode
  }) => {
    // Debug log to help diagnose the issue
    console.log(`Rendering ${provider} section with data:`, apiKeyData);
    
    const handleFormSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (apiKeyData.key) {
        handleApiKeyBlur(provider);
      }
    };
    
    // Render the saved key form (masked)
    const renderSavedKeyForm = () => {
      console.log(`Rendering saved key form for ${provider} with key: ${apiKeyData.key}`);
      return (
        <form onSubmit={handleFormSubmit} className="relative">
          <div className="space-y-2">
            <Label htmlFor={`${provider}-key`}>{provider.charAt(0).toUpperCase() + provider.slice(1)} API Key</Label>
            <Input
              id={`${provider}-key`}
              type="password"
              placeholder={`Enter ${provider.charAt(0).toUpperCase() + provider.slice(1)} API Key`}
              value={apiKeyData.key}
              readOnly
              className="border border-green-500 bg-gray-50 dark:bg-gray-800 pr-24"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              console.log(`Clearing saved key for ${provider}`);
              setApiKeys(prev => ({
                ...prev,
                [provider]: {
                  ...prev[provider],
                  key: '', // Clear the key to allow typing a new one
                  isValid: false
                }
              }));
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-blue-500 text-sm font-medium"
          >
            Change Key
          </button>
          <input type="submit" className="hidden" />
        </form>
      );
    };
    
    // Render the new key input form
    const renderNewKeyForm = () => (
      <div className="relative">
        <form onSubmit={handleFormSubmit}>
          <div className="space-y-2">
            <Label htmlFor={`${provider}-key`}>{provider.charAt(0).toUpperCase() + provider.slice(1)} API Key</Label>
            <Input
              id={`${provider}-key`}
              type="password"
              placeholder={`Enter ${provider.charAt(0).toUpperCase() + provider.slice(1)} API Key`}
              value={apiKeyData.key}
              onChange={(e) => handleApiKeyChange(provider, e.target.value)}
              onBlur={() => handleApiKeyBlur(provider)}
              className={`border ${apiKeyData.isValid ? 'border-green-500' : 'border-gray-300 dark:border-gray-700'}`}
            />
          </div>
          <input type="submit" className="hidden" aria-hidden="true" />
        </form>
        
        {validationStates[provider].isValidating && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Spinner size="sm" />
          </div>
        )}
        {!validationStates[provider].isValidating && apiKeyData.isValid && !apiKeyData.key.includes('•') && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
    );
    
    return (
      <div className="space-y-4">
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">{provider.charAt(0).toUpperCase() + provider.slice(1)}</h3>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              {/* Check if we have a saved key (from the GET request) */}
              {(apiKeyData.isValid && apiKeyData.key && apiKeyData.key.includes('•')) 
                ? renderSavedKeyForm() 
                : renderNewKeyForm()
              }
            </div>
          </div>
          
          {apiKeyData.isValid && (
            <div className="mt-2 text-sm text-green-600 dark:text-green-400">
              {apiKeyData.key && apiKeyData.key.includes('•') ? 'Using saved API key' : 'API key validated successfully'}
            </div>
          )}
          
          {renderModelList(provider)}
        </div>
      </div>
    );
  }

  /**
   * Handle model selection change
   * Updates state and makes API call to save user preference
   */
  const handleModelChange = async (provider: ApiProvider, selectedModel: string) => {
    setApiKeys((prev) => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        selectedModel,
      },
    }))
    
    try {
      // Show toast notification that model preference is saved temporarily
      // Will be fully saved when user clicks "Save Settings"
      toast.success("Model preference will be saved when you click 'Save Settings'")
    } catch (error) {
      console.error('Error handling model change:', error)
      toast.error("Failed to update model preference")
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
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">API Settings</h1>
        <Button variant="outline" onClick={() => router.push('/boards')}>
          Back to Boards
        </Button>
      </div>
      
      <Card className="p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">AI Provider Configuration</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Configure your AI provider API keys to enable advanced features in your brainstorm boards.
          Keys will be validated automatically when you type or tab out of the field.
        </p>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
        
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md text-green-600 dark:text-green-400">
            {successMessage}
          </div>
        )}
        
        {!dataReady && (
          <div className="flex justify-center items-center py-10">
            <div className="text-center">
              <Spinner size="md" />
              <p className="mt-4 text-gray-600">Preparing settings...</p>
            </div>
          </div>
        )}
        
        {dataReady && (
          <SettingsSection>
            <ApiKeySection
              provider="openai"
              apiKeyData={apiKeys.openai}
              handleApiKeyChange={handleApiKeyChange}
              handleApiKeyBlur={handleApiKeyBlur}
              renderModelList={renderModelList}
            />
            
            <ApiKeySection
              provider="claude"
              apiKeyData={apiKeys.claude}
              handleApiKeyChange={handleApiKeyChange}
              handleApiKeyBlur={handleApiKeyBlur}
              renderModelList={renderModelList}
            />
            
            <ApiKeySection
              provider="klusterai"
              apiKeyData={apiKeys.klusterai}
              handleApiKeyChange={handleApiKeyChange}
              handleApiKeyBlur={handleApiKeyBlur}
              renderModelList={renderModelList}
            />
          </SettingsSection>
        )}
        
        {dataReady && (
          <div className="flex justify-end mt-8">
            <Button
              onClick={saveApiKeys}
              disabled={isSaving || !Object.values(apiKeys).some(data => data.isValid && data.selectedModel)}
              className="px-6"
            >
              {isSaving ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  Save Settings
                  {Object.values(apiKeys).filter(data => data.isValid && data.selectedModel).length > 0 && (
                    <span className="ml-2 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded-full">
                      {Object.values(apiKeys).filter(data => data.isValid && data.selectedModel).length} model(s) selected
                    </span>
                  )}
                </>
              )}
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
} 