'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService } from '@/services/auth';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

export default function CreemCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuth();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyCallback = async () => {
      // Make sure user is authenticated
      if (!isAuthenticated) {
        setError('Authentication required');
        setIsProcessing(false);
        // Redirect to login after a short delay
        setTimeout(() => router.push('/auth'), 2000);
        return;
      }

      try {
        // Get the full URL to send to the server
        const fullUrl = window.location.href;
        
        // Call the verify endpoint
        const response = await authService.get(
          `/creem/verify-return-url?${fullUrl.split('?')[1]}`
        );
        
        if (response?.valid) {
          // Verification successful - don't try to refresh user data here
          // Show success message
          toast.success('Subscription activated successfully!');
          
          // Redirect to boards page - user data will be loaded on the next page
          router.push('/boards');
        } else {
          setError('Verification failed');
          setIsProcessing(false);
          router.push('/profile');
        }
      } catch (err) {
        console.error('Error verifying Creem callback:', err);
        setError('An error occurred while verifying your subscription');
        setIsProcessing(false);
        router.push('/profile');
      }
    };

    verifyCallback();
  }, [isAuthenticated, router]);

  if (isProcessing) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-light-background dark:bg-dark-background">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-t-2 border-b-2 border-primary-600"></div>
        <h2 className="text-xl font-medium text-light-foreground dark:text-dark-foreground">
          Verifying your subscription...
        </h2>
        <p className="mt-2 text-light-muted dark:text-dark-muted">
          Please wait while we complete your purchase
        </p>
      </div>
    );
  }

  // Redirect to profile page on error
  useEffect(() => {
    if (error) {
      router.push('/profile');
    }
  }, [error, router]);

  return null;
} 