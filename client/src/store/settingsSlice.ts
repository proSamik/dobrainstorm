import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ApiProvider } from '@/lib/models/providers';

/**
 * Interface for a provider's API key data
 */
export interface ApiKeyData {
  key: string;
  isValid?: boolean;
  models?: string[];
  selectedModel?: string;
}

/**
 * Interface for application settings state
 */
interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  apiKeys: {
    openai: ApiKeyData;
    gemini: ApiKeyData;
    klusterv1: ApiKeyData;
    openrouter: ApiKeyData;
  };
  keysFetched: boolean;
}

/**
 * Initial state for settings
 */
const initialState: SettingsState = {
  theme: 'system',
  apiKeys: {
    openai: { key: '' },
    gemini: { key: '' },
    klusterv1: { key: '' },
    openrouter: { key: '' }
  },
  keysFetched: false
};

/**
 * Settings slice for Redux store
 */
const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    // Set theme preference
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'system'>) => {
      state.theme = action.payload;
    },
    
    // Update a specific API key with all its data
    updateApiKey: (state, action: PayloadAction<{
      provider: ApiProvider;
      data: ApiKeyData;
    }>) => {
      const { provider, data } = action.payload;
      if (provider in state.apiKeys) {
        state.apiKeys[provider as keyof typeof state.apiKeys] = data;
      }
      state.keysFetched = true;
    },
    
    // Update multiple API keys at once
    setApiKeys: (state, action: PayloadAction<{
      [K in ApiProvider]?: ApiKeyData;
    }>) => {
      Object.entries(action.payload).forEach(([provider, data]) => {
        if (provider in state.apiKeys && data) {
          state.apiKeys[provider as keyof typeof state.apiKeys] = data;
        }
      });
      state.keysFetched = true;
    },
    
    // Reset API keys status
    resetApiKeysFetched: (state) => {
      state.keysFetched = false;
    }
  }
});

export const {
  setTheme,
  updateApiKey,
  setApiKeys,
  resetApiKeysFetched
} = settingsSlice.actions;

export default settingsSlice.reducer; 