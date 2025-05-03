// Documentation and setup instructions for API providers

import { ApiProvider } from '../models/providers';

export interface ProviderDocumentationInfo {
  title: string;
  url: string;
  urlText: string;
  steps: string[];
}

export const providerDocs: Record<ApiProvider, ProviderDocumentationInfo> = {
  openai: {
    title: 'How to get an OpenAI API Key',
    url: 'https://platform.openai.com/api-keys',
    urlText: 'Go to OpenAI Platform',
    steps: [
      '1. Sign up or log in to your OpenAI account',
      '2. Navigate to API keys section in your account settings',
      '3. Click "Create new secret key"',
      '4. Give your key a name (optional)',
      '5. Copy the API key (you won\'t be able to see it again)',
      '6. Paste it in the field below',
      '',
      'Note: You need billing set up in your OpenAI account to use the API.'
    ]
  },
  gemini: {
    title: 'How to get a Google Gemini API Key',
    url: 'https://aistudio.google.com/app/apikey',
    urlText: 'Go to Google AI Studio',
    steps: [
      '1. Sign up or log in to your Google account',
      '2. Go to Google AI Studio',
      '3. Click "Get API key" in the sidebar',
      '4. Create a new API key or use an existing one',
      '5. Copy the API key',
      '6. Paste it in the field below',
      '',
      'Note: Google provides free quota for Gemini API usage.'
    ]
  },
  klusterv1: {
    title: 'How to get a Kluster AI API Key',
    url: 'https://kluster.ai/dashboard',
    urlText: 'Go to Kluster Dashboard',
    steps: [
      '1. Sign up or log in to your Kluster account',
      '2. Navigate to the API section in your dashboard',
      '3. Generate a new API key',
      '4. Copy the API key',
      '5. Paste it in the field below',
      '',
      'Note: Kluster uses the OpenAI SDK format but with their specialized models.'
    ]
  },
  openrouter: {
    title: 'How to get an OpenRouter API Key',
    url: 'https://openrouter.ai/keys',
    urlText: 'Go to OpenRouter Dashboard',
    steps: [
      '1. Sign up or log in to your OpenRouter account',
      '2. Navigate to the API Keys section',
      '3. Create a new API key',
      '4. Set the key name and optional rate limits',
      '5. Copy the API key',
      '6. Paste it in the field below',
      '',
      'Note: OpenRouter provides access to multiple models with a single API key.'
    ]
  }
}; 