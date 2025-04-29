'use client';

import { PRICING_PLANS } from '@/lib/pricing';
import { PriceCard } from './PriceCard';

/**
 * Pricing component that displays different subscription tiers
 * @returns JSX.Element containing the pricing section with three tiers
 */
export function Pricing() {
  return (
    <div className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-light-foreground dark:text-dark-foreground sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-6 text-lg leading-8 text-light-muted dark:text-dark-muted">
            Choose the perfect plan for your needs. All plans include core features to help you organize and visualize your ideas.
          </p>
        </div>
        <div className="isolate mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-y-8 sm:mt-20 lg:mx-0 lg:max-w-none lg:grid-cols-3 lg:gap-x-8 xl:mx-0">
          {PRICING_PLANS.map((tier) => (
            <PriceCard key={tier.name} {...tier} />
          ))}
        </div>
      </div>
    </div>
  );
}