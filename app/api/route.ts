import { NextResponse } from 'next/server';

/**
 * GET /api
 * Simple health check endpoint for the API
 * Used by the worker script to verify the API is running
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'API is running',
    timestamp: new Date().toISOString()
  });
} 