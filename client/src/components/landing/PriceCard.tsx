'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authService } from '@/services/auth';
import toast from 'react-hot-toast';

interface PriceCardProps {
  name: string;
  description: string;
  price: number;
  features: Array<{
    included: boolean;
    text: string;
  }>;
  popular?: boolean;
  productId: string;
  variantId: string;
}

export function PriceCard({
  name,
  description,
  price,
  features,
  popular,
  productId,
  variantId
}: PriceCardProps) {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handlePurchase = async () => {
    if (!variantId) {
      toast.error('This product is currently unavailable for purchase');
      return;
    }

    if (!isAuthenticated) {
      sessionStorage.setItem('pendingPurchase', JSON.stringify({ productId, variantId }));
      router.push('/auth', { scroll: false });
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.post('/api/checkout', {
        productId,
        variantId,
        email: user?.email,
        userId: user?.id,
      });

      const data = response.data;
      if (data.checkoutURL || data.portalURL) {
        try {
          if (data.portalURL) {
            router.push('/profile');
            sessionStorage.setItem('activeProfileTab', 'subscription');
          } else if (data.checkoutURL) {
            const redirectUrl = new URL(data.checkoutURL);
            window.open(redirectUrl.toString(), '_blank');
          }
        } catch (urlError) {
          console.error('Invalid URL received:', urlError);
          toast.error('Invalid URL received');
        }
      } else {
        toast.error('No valid URL received');
      }
    } catch (error: unknown) {
      console.error('Error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process checkout. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex flex-col justify-between rounded-3xl bg-light-background dark:bg-dark-background p-8 ring-1 ${popular ? 'ring-primary-600' : 'ring-light-accent dark:ring-dark-accent'} xl:p-10`}>
      <div>
        <div className="flex items-center justify-between gap-x-4">
          <h3 className="text-lg font-semibold leading-8 text-light-foreground dark:text-dark-foreground">{name}</h3>
          {popular && (
            <p className="rounded-full bg-primary-600/10 px-2.5 py-1 text-xs font-semibold leading-5 text-primary-600">
              Most popular
            </p>
          )}
        </div>
        <p className="mt-6 text-sm leading-6 text-light-muted dark:text-dark-muted">{description}</p>
        <p className="mt-8 flex items-baseline gap-x-1">
          <span className="text-4xl font-bold text-light-foreground dark:text-dark-foreground">${price}</span>
          <span className="text-sm font-semibold leading-6 text-light-muted dark:text-dark-muted">/month</span>
        </p>
        <ul role="list" className="mt-8 space-y-3 text-sm leading-6">
          {features.map((feature, index) => (
            <li key={index} className="flex gap-x-3 text-light-muted dark:text-dark-muted">
              {feature.included ? (
                <svg className="h-6 w-5 flex-none text-primary-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-6 w-5 flex-none text-light-muted dark:text-dark-muted" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              )}
              {feature.text}
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={handlePurchase}
        disabled={isLoading}
        className={`mt-8 block w-full rounded-md px-3 py-2 text-center text-sm font-semibold leading-6 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 disabled:opacity-50 ${
          popular
            ? 'bg-primary-600 text-white hover:bg-primary-700'
            : 'bg-light-accent dark:bg-dark-accent text-light-foreground dark:text-dark-foreground hover:bg-light-accent/80 dark:hover:bg-dark-accent/80'
        }`}
      >
        {isLoading ? 'Processing...' : 'Get started'}
      </button>
    </div>
  );
}