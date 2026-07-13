import { numeric, pgSchema, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { legacyColumns, pk, timestamps } from './common';

export const billing = pgSchema('billing');

export const invoices = billing.table('invoices', {
  id: pk(),
  orderId: uuid('order_id').notNull(),
  invoiceNumber: varchar('invoice_number', { length: 64 }).notNull(),
  totalInr: numeric('total_inr', { precision: 12, scale: 2 }).notNull(),
  taxInr: numeric('tax_inr', { precision: 12, scale: 2 }).notNull().default('0'),
  issuedAt: timestamp('issued_at', { withTimezone: true }),
  fileId: uuid('file_id'),
  ...legacyColumns,
  ...timestamps,
});

export const invoiceLines = billing.table('invoice_lines', {
  id: pk(),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  description: varchar('description', { length: 500 }).notNull(),
  amountInr: numeric('amount_inr', { precision: 12, scale: 2 }).notNull(),
  ...legacyColumns,
  ...timestamps,
});
