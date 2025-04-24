import { createSlice, PayloadAction } from '@reduxjs/toolkit';

/**
 * Interface for application settings state
 */
interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  apiKeys: {
    openai: string;
    claude: string;
    klusterai: string;
  };
  keysFetched: boolean;
}

/**
 * Initial state for settings
 */
const initialState: SettingsState = {
  theme: 'system',
  apiKeys: {
    openai: '',
    claude: '',
    klusterai: ''
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
    
    // Update API keys
    setApiKeys: (state, action: PayloadAction<{
      openai?: string;
      claude?: string;
      klusterai?: string;
    }>) => {
      state.apiKeys = {
        ...state.apiKeys,
        ...action.payload
      };
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
  setApiKeys,
  resetApiKeysFetched
} = settingsSlice.actions;

export default settingsSlice.reducer; 