// Provider types and configurations for API settings

export type ApiProvider = 'openai' | 'gemini' | 'klusterv1' | 'openrouter';

export interface ProviderConfig {
  name: string;
  displayName: string;
  logoPath?: string;
  docUrl: string;
  apiBaseUrl?: string;
  supportedModels: string[];
}

export const providers: Record<ApiProvider, ProviderConfig> = {
  openai: {
    name: 'openai',
    displayName: 'OpenAI',
    logoPath: '/logos/openai-logo.svg',
    docUrl: 'https://platform.openai.com/docs/api-reference',
    supportedModels: [
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
    ]
  },
  gemini: {
    name: 'gemini',
    displayName: 'Google Gemini',
    logoPath: '/logos/gemini-logo.svg',
    docUrl: 'https://ai.google.dev/docs',
    supportedModels: [
      'gemini-pro',
      'gemini-pro-vision',
      'gemini-1.5-pro',
      'gemini-1.5-flash'
    ]
  },
  klusterv1: {
    name: 'klusterv1',
    displayName: 'Kluster AI',
    logoPath: '/logos/kluster-logo.svg',
    docUrl: 'https://kluster.ai/docs',
    supportedModels: [
      'kluster-fast',
      'kluster-pro',
      'kluster-vision'
    ]
  },
  openrouter: {
    name: 'openrouter',
    displayName: 'OpenRouter',
    logoPath: '/logos/openrouter-logo.svg',
    docUrl: 'https://openrouter.ai/docs',
    supportedModels: [
      'openai/o1',
      'openai/o4-mini',
      'anthropic/claude-3-opus',
      'anthropic/claude-3-sonnet',
      'meta-llama/llama-3-70b-instruct',
      'meta-llama/llama-3-8b-instruct',
      'mistral/mistral-large',
      'mistral/mistral-medium'
    ]
  }
};

/**
 * Filter available models based on provider's supported model list
 * @param provider API provider name
 * @param availableModels Array of models returned from API
 * @returns Filtered list of supported models
 */
export function filterModels(provider: ApiProvider, availableModels: string[]): string[] {
  const supportedModels = providers[provider].supportedModels;
  
  // If no available models or empty supported models list, return empty array
  if (!availableModels?.length || !supportedModels?.length) {
    return [];
  }
  
  // Special case for OpenRouter which prefixes model names
  if (provider === 'openrouter') {
    return availableModels.filter(model => 
      supportedModels.some(supported => model.includes(supported))
    );
  }
  
  // Default filtering: return only models that are in the supported list
  return availableModels.filter(model => supportedModels.includes(model));
} 