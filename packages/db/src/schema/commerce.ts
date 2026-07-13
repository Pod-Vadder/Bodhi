import {
  integer,
  jsonb,
  numeric,
  pgSchema,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { legacyColumns, pk, timestamps } from './common';
import { users } from './core';

export const commerce = pgSchema('commerce');

export const orderStatus = commerce.enum('order_status', [
  'pending',
  'paid',
  'failed',
  'refunded',
  'cancelled',
]);

export const paymentGateway = commerce.enum('payment_gateway', ['ccavenue', 'razorpay']);

export const products = commerce.table('products', {
  id: pk(),
  code: varchar('code', { length: 64 }).notNull(),
  name: varchar('name', { length: 300 }).notNull(),
  priceInr: numeric('price_inr', { precision: 12, scale: 2 }).notNull(),
  assessmentId: uuid('assessment_id'),
  ...legacyColumns,
  ...timestamps,
});

export const coupons = commerce.table('coupons', {
  id: pk(),
  code: varchar('code', { length: 64 }).notNull(),
  discountPercent: numeric('discount_percent', { precision: 5, scale: 2 }),
  discountFlatInr: numeric('discount_flat_inr', { precision: 12, scale: 2 }),
  maxRedemptions: integer('max_redemptions'),
  redeemedCount: integer('redeemed_count').notNull().default(0),
  validFrom: timestamp('valid_from', { withTimezone: true }),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  ...legacyColumns,
  ...timestamps,
});

export const orders = commerce.table('orders', {
  id: pk(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  status: orderStatus('status').notNull().default('pending'),
  totalInr: numeric('total_inr', { precision: 12, scale: 2 }).notNull(),
  couponId: uuid('coupon_id').references(() => coupons.id),
  ...legacyColumns,
  ...timestamps,
});

export const orderItems = commerce.table('order_items', {
  id: pk(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id),
  quantity: integer('quantity').notNull().default(1),
  unitPriceInr: numeric('unit_price_inr', { precision: 12, scale: 2 }).notNull(),
  ...legacyColumns,
  ...timestamps,
});

export const payments = commerce.table('payments', {
  id: pk(),
  orderId: uuid('order_id')
    .notNull()
    .references(() => orders.id),
  gateway: paymentGateway('gateway').notNull(),
  gatewayReference: varchar('gateway_reference', { length: 128 }),
  amountInr: numeric('amount_inr', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  /** Raw gateway callback payload for reconciliation and dispute handling. */
  gatewayPayload: jsonb('gateway_payload'),
  ...legacyColumns,
  ...timestamps,
});
