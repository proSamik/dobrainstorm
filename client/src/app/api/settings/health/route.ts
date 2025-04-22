import { NextResponse } from 'next/server';

/**
 * Simple health check to confirm the API routes are properly configured
 */
export async function GET() {
  console.log('API health check called!');
  
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    apiPath: '/api/settings/health',
    routeType: 'App Router'
  });
} 