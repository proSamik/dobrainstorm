import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import axios from 'axios';
import crypto from 'crypto';

// Define types for API request and response
interface ApiMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string;
  name?: string;
}

interface ApiRequest {
  provider: 'openai' | 'claude' | 'klusterai';
  model: string;
  message: string;
  context?: ApiMessage[];
  apiKey: string;
}

// Default system prompt for all AI requests
const SYSTEM_PROMPT = `You are an expert mind-mapping and brainstorming assistant for creative thinking.

You will receive:
  • A node context tree showing the current mind map structure
  • A user message requesting suggestions or ideas
  • Details about the current node and its context

Your task is to generate a structured set of ideas that can be used to expand the mind map.

RESPONSE FORMAT: Return a valid JSON object with an improved structure:

{
  "Category 1": [
    {
      "title": "Concept 1A", 
      "reason": "Why this idea is relevant or important",
      "sub_branches": [
        {"title": "Sub-concept 1", "reason": "Explanation for sub-concept"},
        {"title": "Sub-concept 2", "reason": "Explanation for sub-concept"}
      ]
    },
    {
      "title": "Concept 1B",
      "reason": "Justification for this idea's inclusion"
    }
  ],
  "Category 2": [
    {
      "title": "Concept 2A",
      "reason": "Reasoning behind this idea"
    }
  ]
}

GUIDELINES:
- Create 3-5 categories that naturally group related ideas
- Provide 3-6 specific concepts for each category
- Keep concept titles concise (under 8 words is ideal)
- Include a brief reason/justification for each concept (1-2 sentences)
- Add sub_branches only where it adds significant value (optional)
- Ensure all concepts are relevant to the user's query and current node context
- Return ONLY the JSON object with no additional text, explanation, or formatting

EXAMPLE RESPONSE:
{
  "Market Research": [
    {
      "title": "Competitor analysis",
      "reason": "Understanding competitors' strengths and weaknesses informs our strategy."
    },
    {
      "title": "Customer surveys",
      "reason": "Direct feedback from target users reveals actual needs and pain points."
    }
  ],
  "Product Features": [
    {
      "title": "User authentication",
      "reason": "Security is essential for maintaining user trust and data integrity.",
      "sub_branches": [
        {"title": "Social login", "reason": "Reduces friction in the signup process."},
        {"title": "Two-factor authentication", "reason": "Adds an extra layer of security."}
      ]
    }
  ]
}

Remember: The output will be automatically parsed to create nodes in a mind map, so maintaining the exact JSON format is critical.`;

// Default generation parameters
const DEFAULT_MAX_TOKENS = 500;
const DEFAULT_TEMPERATURE = 0.7;
const DEFAULT_TOP_P = 1.0;

/**
 * Parse raw AI response text into a JSON object, extracting any JSON block if needed.
 * @param raw The raw string from the AI.
 * @returns The parsed JSON value.
 * @throws Error if parsing fails.
 */
function parseJSON(raw: string): Record<string, string[]> {
  if (!raw || typeof raw !== 'string') {
    console.error('Invalid input to parseJSON, received:', raw);
    throw new Error('Empty or invalid response received from AI service');
  }
  
  // Log the raw response for debugging
  console.log('Raw AI response text to parse:', raw.substring(0, 200) + (raw.length > 200 ? '...' : ''));
  
  // Try cleaning the string before parsing
  const cleanRaw = (str: string) => {
    // Remove any BOM, non-printable characters, and sanitize quotes
    return str
      .replace(/^\uFEFF/, '')  // Remove BOM
      .replace(/[^\x20-\x7E\n\r\t]/g, '') // Remove non-printable chars except newlines/tabs
      .replace(/[\u201C\u201D]/g, '"')  // Replace curly quotes with straight quotes
      .replace(/[\u2018\u2019]/g, "'")  // Replace curly apostrophes
      .replace(/\\'/g, "'");  // Fix escaped single quotes which can cause issues
  };

  // Try to fix common JSON structural issues
  const fixJsonStructure = (str: string) => {
    let result = str;
    
    // Replace trailing commas before closing brackets (common AI error)
    result = result.replace(/,(\s*[\}\]])/g, '$1');
    
    // Try to fix unescaped quotes in JSON strings
    result = result.replace(/"([^"]*)(?<!\\)"([^"]*)"([^"]*)"(?!\s*:)/g, '"$1\\"$2\\"$3"');
    
    // Fix mismatched quotes
    const openQuotes = (result.match(/"/g) || []).length;
    if (openQuotes % 2 !== 0) {
      console.warn(`Detected odd number of quotes (${openQuotes}), attempting to fix`);
      // Close any unclosed string at the end of a property
      result = result.replace(/("(?:\\.|[^"\\])*?)(?=,\s*")/g, '$1"');
      result = result.replace(/("(?:\\.|[^"\\])*?)(?=})/g, '$1"');
    }
    
    return result;
  };

  try {
    // First try direct parsing with cleaned and fixed string
    const cleaned = cleanRaw(raw);
    const fixed = fixJsonStructure(cleaned);
    
    try {
      return JSON.parse(fixed);
    } catch {
      // If direct parsing with fixes failed, try the original cleaned version
      return JSON.parse(cleaned);
    }
  } catch (firstError) {
    console.log('Direct JSON.parse failed, attempting to extract JSON block');
    console.error('Parse error:', firstError);
    
    try {
      // Clean the raw string first
      const cleaned = cleanRaw(raw);
      const fixed = fixJsonStructure(cleaned);
      
      try {
        // Look for the outermost {...} that contains valid JSON
        const objMatches = fixed.match(/\{(?:[^{}]|(?:\{[^{}]*\}))*\}/g) || [];
        for (const potentialJson of objMatches) {
          try {
            const parsed = JSON.parse(potentialJson);
            console.log('Found valid JSON object');
            return parsed;
          } catch {
            // Continue trying other matches
          }
        }
      } catch {
        console.log('Complex regex matching failed, falling back to simpler approach');
      }
      
      // Simpler approach: find first { and last }
      const firstBrace = fixed.indexOf('{');
      const lastBrace = fixed.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
        const extracted = fixed.substring(firstBrace, lastBrace + 1);
        try {
          console.log('Extracted JSON block:', extracted.substring(0, 100) + (extracted.length > 100 ? '...' : ''));
          const potentialFixed = fixJsonStructure(extracted);
          return JSON.parse(potentialFixed);
        } catch {
          console.log('Simple extraction failed, continuing to array check');
        }
      }
      
      // If no object found, try to find a JSON array with balanced brackets
      try {
        const arrMatches = fixed.match(/\[(?:[^\[\]]|(?:\[[^\[\]]*\]))*\]/g) || [];
        for (const potentialArr of arrMatches) {
          try {
            const parsed = JSON.parse(potentialArr);
            console.log('Found valid JSON array');
            return parsed;
          } catch {
            // Continue trying other matches
          }
        }
      } catch {
        console.log('Complex regex array matching failed, falling back to simpler approach');
      }
      
      // Simpler approach for arrays
      const firstBracket = fixed.indexOf('[');
      const lastBracket = fixed.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1 && firstBracket < lastBracket) {
        const extracted = fixed.substring(firstBracket, lastBracket + 1);
        try {
          console.log('Extracted JSON array:', extracted.substring(0, 100) + (extracted.length > 100 ? '...' : ''));
          const potentialFixed = fixJsonStructure(extracted);
          return JSON.parse(potentialFixed);
        } catch {
          console.log('Simple array extraction failed, continuing to fallback');
        }
      }
      
      // If still no JSON, fallback to manually extracting quoted items
      console.warn('Falling back to manual extraction of items from response');
      
      // Look for patterns like "category": [...] or "category": [...],
      const categoryPattern = /"([^"]+)"\s*:\s*\[((?:[^[\]]|\[[^[\]]*\])*)\]/g;
      const categories: Record<string, string[]> = {};
      let categoryMatch;
      
      while ((categoryMatch = categoryPattern.exec(fixed)) !== null) {
        const category = categoryMatch[1];
        const itemsText = categoryMatch[2];
        
        // Extract items from the array portion
        const items: string[] = [];
        const itemRegex = /"((?:\\"|[^"])+?)"/g;
        let itemMatch;
        
        while ((itemMatch = itemRegex.exec(itemsText)) !== null) {
          if (itemMatch[1]) {
            items.push(itemMatch[1].replace(/\\"/g, '"'));
          }
        }
        
        if (items.length > 0) {
          categories[category] = items;
        }
      }
      
      if (Object.keys(categories).length > 0) {
        return categories;
      }
      
      // If all else fails, return a fallback structure
      return { "Error": ["Failed to parse AI response into JSON format"] };
    } catch (extractError) {
      console.error('Error in JSON extraction:', extractError);
      // Return a fallback for any parsing failures
      return { "Error": ["Failed to parse AI response"] };
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
    const { provider: bodyProvider, model, message, context, apiKey: encryptedKey } = body as ApiRequest;

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
      
    } catch (e: unknown) {
      console.error('API key decryption failed:', e instanceof Error ? e.message : String(e));
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

    // Declare a type for the AI response to avoid 'any'
    let aiResponse: Record<string, string[]> = { "Empty": [] };

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

      // Prepare messages for OpenAI API
      // Start with system message
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT }
      ];
      
      // Add context messages, properly typed by role
      if (context && Array.isArray(context)) {
        context.forEach(ctx => {
          if (ctx.role === 'system') {
            messages.push({ role: 'system', content: ctx.content });
          } else if (ctx.role === 'user') {
            messages.push({ role: 'user', content: ctx.content });
          } else if (ctx.role === 'assistant') {
            messages.push({ role: 'assistant', content: ctx.content });
          } else if (ctx.role === 'function' && ctx.name) {
            messages.push({ role: 'function', content: ctx.content, name: ctx.name });
          } else if (ctx.role === 'tool') {
            // OpenAI SDK expects tool responses to have specific structure
            // Convert tool messages to assistant messages with content
            messages.push({ 
              role: 'assistant', 
              content: `Tool result: ${ctx.content}` 
            });
            console.warn('Tool message type converted to assistant message for OpenAI compatibility');
          }
        });
      }
      
      // Add user message
      messages.push({ role: 'user', content: message });

      // Send chat completion request via OpenAI SDK
      const res = await openai.chat.completions.create({
        model,
        messages,
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
      const payload = {
        model,
        system: SYSTEM_PROMPT,
        messages: [...(context ?? []), { role: 'user', content: message }],
        max_tokens: DEFAULT_MAX_TOKENS,
        temperature: DEFAULT_TEMPERATURE,
        top_p: DEFAULT_TOP_P,
      } as const;

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
        } as Record<string, unknown>,
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
  } catch (error: unknown) {
    console.error('Error processing API request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 