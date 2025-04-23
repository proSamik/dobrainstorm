import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import axios from 'axios';

// Define the shape of chat messages
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

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
  try {
    return JSON.parse(raw);
  } catch (error) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw new Error(`Unable to parse JSON from AI response: ${error instanceof Error ? error.message : error}`);
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
 * Handle POST requests to /api/airequest.
 * Extract API key from Bearer token, parse systemPrompt, model, message, and optional context,
 * route to the proper AI provider SDK or endpoint, and return the response.
 */
export async function POST(request: NextRequest) {
  try {
    // Extract API key from the Authorization header
    const authHeader = request.headers.get('authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }
    const apiKey = authHeader.slice(7).trim();

    // Parse request body
    const {
      model,
      message,
      context,
    } = (await request.json()) as {
      model: string;
      message: string;
      context?: ChatMessage[];
    };

    // Validate required inputs
    if (!model || !message) {
      return NextResponse.json(
        { error: 'model and message are required' },
        { status: 400 }
      );
    }

    // Determine which provider to use
    const provider = getProviderFromModel(model);
    let aiResponse: any;

    if (provider === 'openai') {
      // Initialize OpenAI client
      const openai = new OpenAI({ apiKey });

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
      // Extract and parse the JSON output
      const raw = res.choices?.[0]?.message?.content ?? '';
      const parsed = parseJSON(raw);
      return NextResponse.json(parsed);
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
      // Extract and parse the JSON output
      const rawC = response.data.completion?.content ?? response.data.completion ?? '';
      const parsedC = parseJSON(rawC);
      return NextResponse.json(parsedC);
    }

    // KlusterAI (OpenAI-compatible)
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
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    // Extract and parse the JSON output
    const rawK = respK.data.choices?.[0]?.message?.content ?? '';
    const parsedK = parseJSON(rawK);
    return NextResponse.json(parsedK);
  } catch (error) {
    console.error('AI request error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 