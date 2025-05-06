import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

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
 * Interface for the models state
 */
interface ModelsState {
  models: OpenRouterModel[];
  selectedModel: string | null;
  textToTextModels: OpenRouterModel[];
  textImageToTextModels: OpenRouterModel[];
  freeModels: OpenRouterModel[];
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
  loading: false,
  error: null,
  lastFetched: null
};

/**
 * Async thunk for fetching models from OpenRouter API
 */
export const fetchModels = createAsyncThunk(
  'models/fetchModels',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data as OpenRouterModel[];
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
      // Set to first free model if available, otherwise first model
      if (state.freeModels.length > 0) {
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
      .addCase(fetchModels.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchModels.fulfilled, (state, action) => {
        state.loading = false;
        state.models = action.payload;
        state.lastFetched = Date.now();
        
        // Process models into categories and mark free models
        const processedModels = action.payload.map(model => ({
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
        
        // Set default selected model to first free model if available
        if (state.selectedModel === null) {
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
      });
  }
});

export const {
  setSelectedModel,
  resetSelectedModel,
  clearModels
} = modelsSlice.actions;

export default modelsSlice.reducer; 