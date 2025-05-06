import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authService } from '@/services/auth';

/**
 * Type for the OpenRouter model architecture
 */
export interface ModelArchitecture {
  modality: string;
  input_modalities: string[];
  output_modalities: string[];
  tokenizer: string;
  instruct_type: string | null;
}

/**
 * Type for the OpenRouter model pricing
 */
export interface ModelPricing {
  prompt: string;
  completion: string;
  request: string;
  image: string;
  web_search: string;
  internal_reasoning: string;
}

/**
 * Type for the OpenRouter model top provider info
 */
export interface ModelTopProvider {
  context_length: number;
  max_completion_tokens: number | null;
  is_moderated: boolean;
}

/**
 * Type for an OpenRouter model
 */
export interface OpenRouterModel {
  id: string;
  name: string;
  created: number;
  description: string;
  context_length: number;
  architecture: ModelArchitecture;
  pricing: ModelPricing;
  top_provider: ModelTopProvider;
  per_request_limits: any | null;
  supported_parameters: string[];
  isFree?: boolean; // Added to easily filter free models
}

/**
 * Interface for user preferences data
 */
export interface UserPreferences {
  id?: string;
  userId?: string;
  userPreferences: string;
  defaultModel: string;
  defaultProvider: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Interface for the models state
 */
interface ModelsState {
  models: OpenRouterModel[];
  selectedModel: string | null;
  textToTextModels: OpenRouterModel[];
  textImageToTextModels: OpenRouterModel[];
  freeModels: OpenRouterModel[];
  userPreferences: UserPreferences | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
}

/**
 * Initial state for models
 */
const initialState: ModelsState = {
  models: [],
  selectedModel: null,
  textToTextModels: [],
  textImageToTextModels: [],
  freeModels: [],
  userPreferences: null,
  loading: false,
  error: null,
  lastFetched: null
};

/**
 * Async thunk for fetching models from OpenRouter API
 * Also loads user preferences if authenticated
 */
export const fetchModels = createAsyncThunk(
  'models/fetchModels',
  async (_, { rejectWithValue }) => {
    try {
      // Fetch models from OpenRouter
      const modelsResponse = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
      });

      if (!modelsResponse.ok) {
        throw new Error(`Error ${modelsResponse.status}: ${modelsResponse.statusText}`);
      }

      const modelsData = await modelsResponse.json();
      const models = modelsData.data as OpenRouterModel[];
      
      // Try to fetch user preferences if user is authenticated
      let userPreferences = null;
      try {
        const prefsResponse = await authService.get('/user/preferences');
        if (prefsResponse.status === 200) {
          userPreferences = prefsResponse.data;
        }
      } catch (error) {
        console.warn('Error loading user preferences:', error);
        // Continue with models data even if preferences failed to load
      }
      
      return {
        models,
        userPreferences
      };
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

/**
 * Async thunk for fetching user preferences
 */
export const fetchUserPreferences = createAsyncThunk(
  'models/fetchUserPreferences',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authService.get('/user/preferences');
      return response as UserPreferences;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

/**
 * Async thunk for saving user preferences
 */
export const saveUserPreferences = createAsyncThunk(
  'models/saveUserPreferences',
  async (preferences: Partial<UserPreferences>, { rejectWithValue }) => {
    try {
      const response = await authService.post('/user/preferences/update', preferences);
      return response.data as UserPreferences;
    } catch (error) {
      return rejectWithValue((error as Error).message);
    }
  }
);

/**
 * Models slice for Redux store
 */
const modelsSlice = createSlice({
  name: 'models',
  initialState,
  reducers: {
    // Set the selected model
    setSelectedModel: (state, action: PayloadAction<string>) => {
      state.selectedModel = action.payload;
    },
    
    // Reset selected model to default
    resetSelectedModel: (state) => {
      // Try to use saved user preferences first
      if (state.userPreferences?.defaultModel && 
          state.models.some(m => m.id === state.userPreferences?.defaultModel)) {
        state.selectedModel = state.userPreferences.defaultModel;
      } 
      // Otherwise fall back to first free model if available, or first model
      else if (state.freeModels.length > 0) {
        state.selectedModel = state.freeModels[0].id;
      } else if (state.models.length > 0) {
        state.selectedModel = state.models[0].id;
      } else {
        state.selectedModel = null;
      }
    },
    
    // Clear all models data
    clearModels: (state) => {
      state.models = [];
      state.textToTextModels = [];
      state.textImageToTextModels = [];
      state.freeModels = [];
      state.selectedModel = null;
      state.lastFetched = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Handle fetchModels actions
      .addCase(fetchModels.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchModels.fulfilled, (state, action) => {
        state.loading = false;
        const { models, userPreferences } = action.payload as { 
          models: OpenRouterModel[], 
          userPreferences: UserPreferences | null 
        };
        
        state.models = models;
        state.lastFetched = Date.now();
        
        // Store user preferences if received
        if (userPreferences) {
          state.userPreferences = userPreferences;
        }
        
        // Process models into categories and mark free models
        const processedModels = models.map(model => ({
          ...model,
          isFree: model.pricing.prompt === "0" && model.pricing.completion === "0"
        }));
        
        // Filter text-to-text models
        state.textToTextModels = processedModels.filter(model => 
          model.architecture.modality === 'text->text' || 
          (model.architecture.input_modalities.includes('text') && 
           model.architecture.output_modalities.includes('text') &&
           !model.architecture.input_modalities.includes('image'))
        );
        
        // Filter text+image-to-text models
        state.textImageToTextModels = processedModels.filter(model => 
          model.architecture.input_modalities.includes('text') && 
          model.architecture.input_modalities.includes('image') && 
          model.architecture.output_modalities.includes('text')
        );
        
        // Filter free models
        state.freeModels = processedModels.filter(model => model.isFree);
        
        // Set selected model based on user preferences if available
        if (userPreferences?.defaultModel && 
            models.some(m => m.id === userPreferences.defaultModel)) {
          state.selectedModel = userPreferences.defaultModel;
        }
        // Otherwise set default selected model if not already set
        else if (state.selectedModel === null) {
          if (state.freeModels.length > 0) {
            state.selectedModel = state.freeModels[0].id;
          } else if (state.models.length > 0) {
            state.selectedModel = state.models[0].id;
          }
        }
      })
      .addCase(fetchModels.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Handle fetchUserPreferences actions
      .addCase(fetchUserPreferences.fulfilled, (state, action) => {
        state.userPreferences = action.payload;
        
        // Update selected model if preferences include default model that exists in our models list
        if (action.payload?.defaultModel && 
            state.models.some(m => m.id === action.payload.defaultModel)) {
          state.selectedModel = action.payload.defaultModel;
        }
      })
      
      // Handle saveUserPreferences actions
      .addCase(saveUserPreferences.fulfilled, (state, action) => {
        state.userPreferences = action.payload;
        
        // Update selected model if it was changed
        if (action.payload?.defaultModel && 
            state.models.some(m => m.id === action.payload.defaultModel)) {
          state.selectedModel = action.payload.defaultModel;
        }
      });
  }
});

export const {
  setSelectedModel,
  resetSelectedModel,
  clearModels
} = modelsSlice.actions;

export default modelsSlice.reducer; 