import axios from 'axios';

/**
 * Response structure from validation endpoint
 */
export interface ValidateKeyResponse {
  valid: boolean;
  models?: string[];
  selectedModel?: string;
  error?: string;
}

/**
 * Validates an API key with the frontend API
 * This uses axios directly since validation now happens in the NextJS API
 * 
 * @param provider - The AI provider ('openai', 'claude', 'klusterai')
 * @param key - The API key to validate
 * @returns Promise with validation result
 */
export async function validateApiKey(provider: string, key: string): Promise<ValidateKeyResponse> {
  try {
    const response = await axios.post('/api/settings/validate-key', {
      provider,
      key
    });
    
    return response.data;
  } catch (error) {
    console.error('Error validating API key:', error);
    
    // Return a standardized error response
    if (axios.isAxiosError(error) && error.response) {
      // Handle server error responses
      return {
        valid: false,
        error: error.response.data?.error || 'Validation server error'
      };
    }
    
    // Handle network errors or other issues
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error validating API key'
    };
  }
}

/**
 * Helper to determine if the API key is valid for use
 * Used to enable/disable UI elements that require valid keys
 */
export function isApiKeyValid(response: ValidateKeyResponse | null): boolean {
  return !!response && response.valid && !response.error;
}

/**
 * Get available models for a validated provider
 * @returns Array of model IDs or empty array if not valid
 */
export function getAvailableModels(response: ValidateKeyResponse | null): string[] {
  if (isApiKeyValid(response) && response?.models?.length) {
    return response.models;
  }
  return [];
} 