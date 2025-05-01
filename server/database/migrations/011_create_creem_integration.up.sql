-- Create creem_subscriptions table
CREATE TABLE IF NOT EXISTS creem_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    subscription_id VARCHAR(100) NOT NULL UNIQUE,
    customer_id VARCHAR(100) NOT NULL,
    product_id VARCHAR(100) NOT NULL,
    checkout_id VARCHAR(100),
    order_id VARCHAR(100),
    status VARCHAR(50) NOT NULL,
    collection_method VARCHAR(50),
    last_transaction_id VARCHAR(100),
    last_transaction_date TIMESTAMP WITH TIME ZONE,
    next_transaction_date TIMESTAMP WITH TIME ZONE,
    current_period_start_date TIMESTAMP WITH TIME ZONE,
    current_period_end_date TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Add Creem fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS creem_customer_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS creem_subscription_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS creem_product_id VARCHAR(100),
ADD COLUMN IF NOT EXISTS creem_subscription_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS creem_current_period_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS creem_current_period_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS creem_is_trial BOOLEAN DEFAULT FALSE;

-- Drop LemonSqueezy specific columns from users table
ALTER TABLE users
DROP COLUMN IF EXISTS latest_subscription_id,
DROP COLUMN IF EXISTS latest_product_id,
DROP COLUMN IF EXISTS latest_variant_id,
DROP COLUMN IF EXISTS latest_status,
DROP COLUMN IF EXISTS latest_renewal_date,
DROP COLUMN IF EXISTS latest_end_date;

-- Drop LemonSqueezy tables
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;

-- Create indexes for creem_subscriptions
CREATE INDEX IF NOT EXISTS idx_creem_subscriptions_user_id ON creem_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_creem_subscriptions_subscription_id ON creem_subscriptions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_creem_subscriptions_customer_id ON creem_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_creem_subscriptions_status ON creem_subscriptions(status);

-- Create indexes for Creem fields in users table
CREATE INDEX IF NOT EXISTS idx_users_creem_subscription_status ON users(creem_subscription_status);
CREATE INDEX IF NOT EXISTS idx_users_creem_product_id ON users(creem_product_id);
CREATE INDEX IF NOT EXISTS idx_users_creem_subscription_id ON users(creem_subscription_id);

-- Drop LemonSqueezy specific indexes
DROP INDEX IF EXISTS idx_users_latest_status;
DROP INDEX IF EXISTS idx_users_latest_product_id;
DROP INDEX IF EXISTS idx_users_latest_variant_id;
DROP INDEX IF EXISTS idx_users_subscription_lookup; 