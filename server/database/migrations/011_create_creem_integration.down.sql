-- Restore LemonSqueezy tables (simplified schemas - will need data migration separately)
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    subscription_id INTEGER NOT NULL UNIQUE,
    order_id INTEGER NOT NULL,
    user_id UUID NOT NULL,
    customer_id INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL,
    cancelled BOOLEAN NOT NULL DEFAULT FALSE,
    renews_at TIMESTAMP WITH TIME ZONE,
    ends_at TIMESTAMP WITH TIME ZONE,
    product_id INTEGER NOT NULL,
    variant_id INTEGER NOT NULL,
    trial_ends_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL UNIQUE,
    user_id VARCHAR(255) NOT NULL,
    customer_id INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL,
    refunded_at TIMESTAMP WITH TIME ZONE,
    product_id INTEGER NOT NULL,
    variant_id INTEGER NOT NULL,
    subtotal_formatted VARCHAR(50) NOT NULL,
    tax_formatted VARCHAR(50) NOT NULL,
    total_formatted VARCHAR(50) NOT NULL,
    tax_inclusive BOOLEAN NOT NULL DEFAULT false,
    refunded_amount_formatted VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Drop creem_subscriptions table and its indexes
DROP TABLE IF EXISTS creem_subscriptions CASCADE;

-- Drop Creem columns from users table
ALTER TABLE users
DROP COLUMN IF EXISTS creem_customer_id,
DROP COLUMN IF EXISTS creem_subscription_id,
DROP COLUMN IF EXISTS creem_product_id,
DROP COLUMN IF EXISTS creem_subscription_status,
DROP COLUMN IF EXISTS creem_current_period_start,
DROP COLUMN IF EXISTS creem_current_period_end,
DROP COLUMN IF EXISTS creem_is_trial;

-- Re-add LemonSqueezy columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS latest_subscription_id INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS latest_product_id INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS latest_variant_id INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS latest_status VARCHAR(255) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS latest_renewal_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS latest_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Recreate LemonSqueezy indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscription_id ON subscriptions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_customer_id ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_id ON orders(order_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_variant_id ON orders(variant_id);

-- Drop Creem indexes from users table
DROP INDEX IF EXISTS idx_users_creem_subscription_status;
DROP INDEX IF EXISTS idx_users_creem_product_id;
DROP INDEX IF EXISTS idx_users_creem_subscription_id;

-- Re-create LemonSqueezy indexes on users table
CREATE INDEX IF NOT EXISTS idx_users_latest_status ON users(latest_status);
CREATE INDEX IF NOT EXISTS idx_users_latest_product_id ON users(latest_product_id);
CREATE INDEX IF NOT EXISTS idx_users_latest_variant_id ON users(latest_variant_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_lookup ON users(latest_status, latest_product_id, latest_variant_id); 