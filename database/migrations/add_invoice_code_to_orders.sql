-- Add invoice_code column to orders table if not exists
ALTER TABLE orders ADD COLUMN IF NOT EXISTS invoice_code VARCHAR(50) NULL AFTER status;

-- Add index for invoice_code
ALTER TABLE orders ADD INDEX IF NOT EXISTS idx_invoice_code (invoice_code);
