'use client'

import React from 'react';
import BlogList from './BlogList';
import { Post } from '@/types/blog';
import Link from 'next/link';

/**
 * Props for the BlogPageClient component
 */
interface BlogPageClientProps {
  posts: Post[];
}

/**
 * BlogPageClient component renders the blog list with posts
 */
const BlogPageClient: React.FC<BlogPageClientProps> = ({ posts }) => {
  return (
    <div className="min-h-screen bg-background pt-16 pb-8">
      <div className="container mx-auto px-4">
      <Link href="/" className="text-sm font-medium text-light-muted dark:text-dark-muted hover:text-light-foreground dark:hover:text-dark-foreground transition-colors">
              ← Back to Home
        </Link>
        <header className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-primary-400 mb-6">Our Blog</h1>
          <p className="text-xl text-foreground max-w-3xl mx-auto">
            Insights, tutorials, and updates from our team to help you build better software
          </p>
        </header>
        
        <BlogList posts={posts} />
      </div>
    </div>
  );
};

export default BlogPageClient; 