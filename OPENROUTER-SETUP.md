# Setting Up OpenRouter Integration

This document explains how to set up the OpenRouter integration for the chat functionality in the app.

## Prerequisites

- An OpenRouter account with API access
- API key from OpenRouter

## Configuration

1. Create a `.env` file in the root directory based on `.env.example`
2. Set the `OPENROUTER_API_KEY` to your OpenRouter API key
3. Configure the frontend settings:
   - `FRONTEND_URL`: The URL of your frontend (used in OpenRouter API calls)
   - `FRONTEND_TITLE`: The title of your app (used in OpenRouter API calls)

Example:
```
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FRONTEND_URL=https://example.com
FRONTEND_TITLE=My Chat App
```

## Features

The integration with OpenRouter provides the following features:

- AI-powered chat responses using GPT models
- Real-time streaming of AI responses
- Ability to stop generation mid-response
- Conversation history preserved throughout the chat session

## Default Model

By default, the system uses `openai/gpt-4.1-nano` for responses. You can change the default model by modifying the `DefaultModel` constant in `server/pkg/openrouter/client.go`.

## Customizing System Prompts

You can customize the default system prompt by modifying the `systemMessage` in `server/pkg/openrouter/client.go`. The current default is "Give results in plain text".

## Troubleshooting

If you encounter issues with the OpenRouter integration:

1. Check that your API key is correctly set in the `.env` file
2. Verify that your OpenRouter account has sufficient credits
3. Check the server logs for detailed error messages
4. Ensure your network allows outbound connections to OpenRouter's API endpoints 