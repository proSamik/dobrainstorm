import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import axios from 'axios';
import crypto from 'crypto';

// Default system prompt for all AI requests
const SYSTEM_PROMPT = `You are an AST-based mind‑mapping and brainstorming assistant.
You will receive:
  • A JSON array of nodes (each node has name, value, and data).
  • A user message asking for suggestions (e.g., "suggest me 10 domain name ideas").

Using the provided context and user message, generate a valid JSON object that maps categories to arrays of suggestions. Follow this parser schema exactly:
{
  "category1": ["item1", "item2", ...],
  "category2": ["itemA", "itemB", ...],
  ...
}
Return only the JSON object—no extra text, explanation, or formatting.`;

// Default generation parameters
const DEFAULT_MAX_TOKENS = 150;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TOP_P = 1.0;

/**
 * Parse raw AI response text into a JSON object, extracting any JSON block if needed.
 * @param raw The raw string from the AI.
 * @returns The parsed JSON value.
 * @throws Error if parsing fails.
 */
function parseJSON(raw: string): any {
  if (!raw || typeof raw !== 'string') {
    console.error('Invalid input to parseJSON, received:', raw);
    throw new Error('Empty or invalid response received from AI service');
  }
  
  // Log the raw response for debugging
  console.log('Raw AI response text to parse:', raw.substring(0, 200) + (raw.length > 200 ? '...' : ''));
  
  try {
    // First try direct parsing
    return JSON.parse(raw);
  } catch (firstError) {
    console.log('Direct JSON.parse failed, attempting to extract JSON block');
    
    try {
      // Try to find a JSON object block
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const extracted = match[0];
        console.log('Extracted JSON block:', extracted.substring(0, 100) + (extracted.length > 100 ? '...' : ''));
        return JSON.parse(extracted);
      }
      
      // If no object found, try to find a JSON array
      const arrayMatch = raw.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        const extracted = arrayMatch[0];
        console.log('Extracted JSON array:', extracted.substring(0, 100) + (extracted.length > 100 ? '...' : ''));
        return JSON.parse(extracted);
      }
      
      // If still no JSON, fallback to manually extracting quoted items
      console.warn('Falling back to manual extraction of items from response');
      
      // Attempt to infer category from key before array
      let category = 'suggestions';
      const catMatch = raw.match(/"([^"']+)"\s*:\s*\[/);
      if (catMatch) {
        category = catMatch[1];
        console.log(`Inferred category: ${category}`);
      }
      
      // Extract all quoted strings in the raw text
      const itemMatches = Array.from(raw.matchAll(/"([^"']+)"/g)).map(m => m[1]);
      // Remove any occurrence of the category name if it appears as first item
      const items = itemMatches.filter((item, idx) => idx !== 0 || item !== category);
      console.log(`Manually extracted ${items.length} items for category ${category}`);
      return { [category]: items };
    } catch (secondError) {
      console.error('Error parsing extracted JSON:', secondError);
      throw new Error(`Unable to parse JSON from AI response: ${firstError instanceof Error ? firstError.message : firstError}`);
    }
  }
}

/**
 * Determine the provider (OpenAI, Claude, or KlusterAI) based on the model name.
 * @param model The model identifier string.
 * @returns The provider key.
 */
function getProviderFromModel(model: string): 'openai' | 'claude' | 'klusterai' {
  const lower = model.toLowerCase();
  if (lower.startsWith('claude')) {
    return 'claude';
  }
  if (
    lower.startsWith('gpt') ||
    lower.startsWith('text-') ||
    lower.includes('gpt-') ||
    lower.includes('text-davinci')
  ) {
    return 'openai';
  }
  // Fallback to KlusterAI (OpenAI-compatible)
  return 'klusterai';
}

/**
 * Decrypts the AES-CFB encrypted key using the same logic as the Go backend.
 * Expects base64 ciphertext with 16-byte IV prefix.
 */
function decryptKey(encrypted: string): string {
  const envKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!envKey) throw new Error('No ENCRYPTION_KEY or JWT_SECRET in env');
  // Prepare 32-byte key
  const keyBuf = Buffer.alloc(32);
  Buffer.from(envKey).copy(keyBuf);

  // Decode base64 and split IV and ciphertext
  const data = Buffer.from(encrypted, 'base64');
  if (data.length <= 16) {
    throw new Error('Encrypted key is too short to contain an IV');
  }
  const iv = data.slice(0, 16);
  const ciphertext = data.slice(16);
  // Decrypt using AES-256-CFB
  const decipher = crypto.createDecipheriv('aes-256-cfb', keyBuf, iv);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString();
}

/**
 * Handle POST requests to /api/airequest.
 * Extract API key from Bearer token, parse systemPrompt, model, message, and optional context,
 * route to the proper AI provider SDK or endpoint, and return the response.
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body (including provider and encrypted apiKey)
    const body = await request.json();
    const { provider: bodyProvider, model, message, context, apiKey: encryptedKey } = body as any;

    if (!encryptedKey) {
      return NextResponse.json({ error: 'Missing encrypted apiKey' }, { status: 401 });
    }
    
    // Is the encrypted key is the literal characters "Bearer" followed by dots?
    if (encryptedKey.includes('Bearer') || encryptedKey.includes('•')) {
      return NextResponse.json(
        { error: 'Your API key appears masked or invalid. Please open Settings and re-enter your API key.' },
        { status: 400 }
      );
    }
    
    // Make sure encrypted key is valid Base64
    const b64Pattern = /^[A-Za-z0-9+/=]+$/;
    if (!b64Pattern.test(encryptedKey)) {
      return NextResponse.json(
        { error: 'Your API key appears to be in an invalid format. Please re-enter it in Settings.' },
        { status: 400 }
      );
    }
    
    // Decrypt to plaintext API key
    let apiKey: string;
    try {
      apiKey = decryptKey(String(encryptedKey));
      
      // Diagnostic logging for decrypted key (first/last 5 chars only for security)
      const decKeyLength = apiKey.length;
      const decKeyStart = apiKey.substring(0, Math.min(5, decKeyLength));
      const decKeyEnd = apiKey.substring(Math.max(0, decKeyLength - 5));
      console.log(`[DIAGNOSTIC] Decrypted key: length=${decKeyLength}, start="${decKeyStart}...", end="...${decKeyEnd}"`);
      console.log(`[DIAGNOSTIC] Decrypted key contains Bearer: ${apiKey.includes('Bearer')}`);
      console.log(`[DIAGNOSTIC] Decrypted key contains bullets: ${apiKey.includes('•')}`);
      console.log(`[DIAGNOSTIC] Decrypted key Unicode check: ${Array.from(apiKey).map(c => c.charCodeAt(0)).slice(0, 10)}`);
      
    } catch (e: any) {
      console.error('API key decryption failed:', e.message);
      return NextResponse.json(
        { error: 'Failed to decrypt API key. Please re-enter it in Settings.' },
        { status: 400 }
      );
    }
    
    // Clean up the API key - remove Bearer prefix, trim spaces, and remove any non-printable chars
    apiKey = apiKey.trim().replace(/^Bearer\s+/i, '').replace(/[^\x20-\x7E]/g, '');
    
    // Log the key preparation (without exposing actual key)
    console.log(`API key before cleaning: length=${encryptedKey.length}, after decryption: length=${apiKey.length}`);
    
    // Check for common invalid formats that might have survived decryption
    if (apiKey.includes('sk-****') || apiKey.includes('•••')) {
      return NextResponse.json(
        { error: 'Your API key appears to be masked. Please re-enter your full API key in Settings.' },
        { status: 400 }
      );
    }
    
    // Validate the cleaned API key
    if (!apiKey || apiKey.length < 10) {
      return NextResponse.json(
        { error: 'Decrypted API key is empty or too short. Please re-enter it in Settings.' },
        { status: 400 }
      );
    }

    // Validate required inputs
    if (!model || !message) {
      return NextResponse.json(
        { error: 'model and message are required' },
        { status: 400 }
      );
    }

    // Log the received request
    console.log('Received request:', { model, message, context });

    // Determine provider: explicit or inferred
    const provider = (['openai','claude','klusterai'] as const).includes(bodyProvider)
      ? bodyProvider
      : getProviderFromModel(model);

    let aiResponse: any;

    if (provider === 'openai') {
      // Ensure we're using a clean API key (OpenAI expects raw key without Bearer)
      // Check if the key follows OpenAI format (usually starts with "sk-")
      const cleanApiKey = apiKey.replace(/^Bearer\s+/i, '').trim();
      
      if (!cleanApiKey.startsWith('sk-') && !cleanApiKey.startsWith('org-')) {
        console.warn('Warning: OpenAI key may be in incorrect format (doesn\'t start with sk- or org-)');
      }
      
      console.log(`Using OpenAI with key length: ${cleanApiKey.length}, first 3 chars: ${cleanApiKey.substring(0, 3)}`);
      
      const openai = new OpenAI({ 
        apiKey: cleanApiKey,
        dangerouslyAllowBrowser: false
      });

      // Send chat completion request via OpenAI SDK
      const res = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...(context ?? []),
          { role: 'user', content: message },
        ],
        max_tokens: DEFAULT_MAX_TOKENS,
        temperature: DEFAULT_TEMPERATURE,
        top_p: DEFAULT_TOP_P,
      });
      
      // Detailed logging of OpenAI response
      try {
        console.log('OpenAI response object:', {
          id: res.id,
          model: res.model,
          created: res.created,
          choices_length: res.choices?.length,
          finish_reason: res.choices?.[0]?.finish_reason,
          content_length: res.choices?.[0]?.message?.content?.length || 0,
          content_preview: res.choices?.[0]?.message?.content?.substring(0, 100) || ''
        });
      } catch (logError) {
        console.error('Error logging OpenAI response:', logError);
      }
      
      // Extract and parse the JSON output
      const raw = res.choices?.[0]?.message?.content ?? '';
      if (!raw) {
        console.error('Empty content received from OpenAI');
        throw new Error('No content received from OpenAI');
      }
      
      const parsed = parseJSON(raw);
      aiResponse = parsed;
    }

    if (provider === 'claude') {
      // Prepare payload for Anthropic Messages API
      const payload: any = {
        model,
        system: SYSTEM_PROMPT,
        messages: [...(context ?? []), { role: 'user', content: message }],
        max_tokens: DEFAULT_MAX_TOKENS,
        temperature: DEFAULT_TEMPERATURE,
        top_p: DEFAULT_TOP_P,
      };

      // Call Anthropic Messages API
      const response = await axios.post('https://api.anthropic.com/v1/messages', payload, {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      });

      // Detailed logging of Claude response
      try {
        console.log('Claude response details:', {
          id: response.data.id,
          model: response.data.model,
          type: response.data.type,
          role: response.data.content?.[0]?.type,
          content_length: response.data.content?.[0]?.text?.length || 0,
          content_preview: response.data.content?.[0]?.text?.substring(0, 100) || '',
          stop_reason: response.data.stop_reason,
        });
      } catch (logError) {
        console.error('Error logging Claude response:', logError);
      }

      // Extract and parse the JSON output
      let rawC = '';
      try {
        // Modern Claude API format
        if (response.data.content) {
          rawC = response.data.content[0]?.text || '';
        } else {
          // Legacy format fallback
          rawC = response.data.completion?.content || response.data.completion || '';
        }
        if (!rawC) {
          console.error('Empty content received from Claude');
          throw new Error('No content received from Claude');
        }
      } catch (extractError) {
        console.error('Error extracting content from Claude response:', extractError);
        throw new Error('Failed to extract Claude response content');
      }
      
      const parsedC = parseJSON(rawC);

      // Log the parsed response
      console.log('Parsed response:', parsedC);

      aiResponse = parsedC;
    }

    if (provider === 'klusterai') {
      // Ensure API key has proper Bearer format for Authorization header
      const authKey = apiKey.startsWith('Bearer ') ? apiKey : `Bearer ${apiKey}`;
      console.log(`KlusterAI auth header prepared, length: ${authKey.length}`);

      const respK = await axios.post(
        'https://api.kluster.ai/v1/chat/completions',
        {
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...(context ?? []),
            { role: 'user', content: message },
          ],
          max_tokens: DEFAULT_MAX_TOKENS,
          temperature: DEFAULT_TEMPERATURE,
          top_p: DEFAULT_TOP_P,
        },
        {
          headers: {
            Authorization: authKey,
            'Content-Type': 'application/json',
          },
          timeout: 120000 // 2 minute timeout
        }
      );

      // Detailed logging of KlusterAI response
      try {
        console.log('KlusterAI response details:', {
          id: respK.data.id,
          model: respK.data.model,
          created: respK.data.created,
          choices_length: respK.data.choices?.length,
          finish_reason: respK.data.choices?.[0]?.finish_reason,
          content_length: respK.data.choices?.[0]?.message?.content?.length || 0,
          content_preview: respK.data.choices?.[0]?.message?.content?.substring(0, 100) || ''
        });
      } catch (logError) {
        console.error('Error logging KlusterAI response:', logError);
      }

      // Extract and parse the JSON output
      const rawK = respK.data.choices?.[0]?.message?.content ?? '';
      if (!rawK) {
        console.error('Empty content received from KlusterAI');
        throw new Error('No content received from KlusterAI');
      }
      
      const parsedK = parseJSON(rawK);

      // Log the parsed response
      console.log('Parsed response:', parsedK);

      aiResponse = parsedK;
    }

    return NextResponse.json(aiResponse);
  } catch (error) {
    console.error('AI request error:', error);
    
    // Check if we can extract a meaningful error message
    let errorMessage = 'Unknown error';
    let statusCode = 500;
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Log the full error stack for debugging
      console.error('Full error stack:', error.stack);
      
      // Check if it's an OpenAI API error
      const openAiError = error as any;
      if (openAiError.status) {
        statusCode = openAiError.status;
        console.log(`OpenAI API error status: ${openAiError.status}`);
      }
      
      // Special handling for JSON parsing errors
      if (errorMessage.includes('JSON')) {
        errorMessage = 'The AI returned an invalid response format. Please try again or modify your prompt.';
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined 
      },
      { status: statusCode }
    );
  }
} 