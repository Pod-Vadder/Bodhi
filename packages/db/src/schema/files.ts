import { bigint, pgSchema, uuid, varchar } from 'drizzle-orm/pg-core';
import { legacyColumns, pk, timestamps } from './common';

export const files = pgSchema('files');

export const fileObjects = files.table('file_objects', {
  id: pk(),
  bucket: varchar('bucket', { length: 128 }).notNull(),
  objectKey: varchar('object_key', { length: 1024 }).notNull(),
  mimeType: varchar('mime_type', { length: 255 }).notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  sha256: varchar('sha256', { length: 64 }),
  uploadedBy: uuid('uploaded_by'),
  ...legacyColumns,
  ...timestamps,
});
