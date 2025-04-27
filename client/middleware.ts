import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware function to process requests
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Special handling for blog image assets
  if (pathname.startsWith('/blog/posts/images/')) {
    // Create a new URL for the image using the public directory path
    const url = request.nextUrl.clone();
    
    // For static image files, use the original path but ensure they're not going through image optimization
    return NextResponse.next();
  }
  
  // For all other routes, proceed as normal
  return NextResponse.next();
}

// Configure the middleware to run only for specific paths
export const config = {
  matcher: [
    // Apply this middleware only to paths that match:
    '/blog/posts/images/:path*',
  ],
}; 