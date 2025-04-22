import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import axios from 'axios';

interface OpenAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

interface KlusterAIModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

/**
 * Validates an OpenAI API key
 */
async function validateOpenAIKey(apiKey: string) {
  try {
    // Initialize the OpenAI client with the API key
    const openai = new OpenAI({ apiKey });

    // Test the key by listing models
    const response = await openai.models.list();
    
    // Extract model names
    const models = response.data.map((model: OpenAIModel) => model.id);

    return { 
      valid: true, 
      models 
    };
  } catch (error) {
    console.error('OpenAI validation error:', error);
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Failed to validate OpenAI key' 
    };
  }
}

/**
 * Validates a Claude API key
 */
async function validateClaudeKey(apiKey: string) {
  try {
    // Make a direct HTTP request to Claude's API to test the key
    const response = await axios.get('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    });

    // If we reach here, the key is valid
    // Extract available models from the response
    const models = response.data.data.map((model: { id: string }) => model.id);

    return {
      valid: true,
      models
    };
  } catch (error) {
    // If there's an error, the key is likely invalid
    console.error('Claude validation error:', error);
    
    // Default models if we can't validate properly
    const defaultModels = [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-2.1',
      'claude-2.0',
      'claude-instant-1.2'
    ];
    
    // For development, you might want to assume keys are valid even on error
    if (process.env.NODE_ENV === 'development') {
      return {
        valid: true,
        models: defaultModels,
        error: 'Development mode: assuming key is valid'
      };
    }
    
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to validate Claude key'
    };
  }
}

/**
 * Validates a KlusterAI API key (OpenAI compatible)
 */
async function validateKlusterAIKey(apiKey: string) {
  try {
    // KlusterAI uses OpenAI-compatible API, so we use the same client with a different base URL
    const response = await axios.get('https://api.kluster.ai/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    // Extract model names from the response (assuming OpenAI-compatible format)
    const models = response.data.data.map((model: KlusterAIModel) => model.id);

    return {
      valid: true,
      models
    };
  } catch (error) {
    console.error('KlusterAI validation error:', error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to validate KlusterAI key'
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { provider, key } = data;

    console.log(`Validating key for provider: ${provider}`);

    // Validate input
    if (!provider || !key) {
      return NextResponse.json(
        { valid: false, error: 'Provider and key are required' },
        { status: 400 }
      );
    }

    // Validate the key based on provider
    let result;

    switch (provider) {
      case 'openai':
        result = await validateOpenAIKey(key);
        break;
      case 'claude':
        result = await validateClaudeKey(key);
        break;
      case 'klusterai':
        result = await validateKlusterAIKey(key);
        break;
      default:
        return NextResponse.json(
          { valid: false, error: 'Invalid provider' },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error validating key:', error);
    return NextResponse.json(
      { 
        valid: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
} 