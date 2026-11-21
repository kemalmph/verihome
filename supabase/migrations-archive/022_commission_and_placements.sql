-- Migration 022: commission configuration and long-term placements.
--
-- The ledger cannot split booking revenue without knowing the split. With no
-- rate configured the whole amount posts to owner_payable and the booking is
-- flagged rather than guessed at: under-paying VeriHome is recoverable,
-- silently under-paying an owner is not.

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS platform_commission_pct numeric(5,2)
    CHECK (platform_commission_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS cleaning_fee_goes_to text
    CHECK (cleaning_fee_goes_to IN ('platform','owner'))
    DEFAULT 'platform';

COMMENT ON COLUMN properties.platform_commission_pct IS
  'VeriHome share of rent, percent. NULL means unconfigured: a booking on this property cannot be split, and the ledger posts the whole amount to owner_payable rather than guessing.';

CREATE TABLE IF NOT EXISTS placements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id),
  user_id uuid references users(id),
  viewing_id uuid references viewings(id),
  monthly_rent numeric(12,0) not null,
  commission_pct numeric(5,2) not null,
  commission_amount numeric(12,0) not null,
  status text default 'reported' check (status in (
    'reported','invoiced','paid','disputed','written_off'
  )),
  lease_start_date date,
  reported_by text check (reported_by in ('owner','tenant','team')),
  notes text,
  created_at timestamptz default now()
);

ALTER TABLE placements ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_placements_property ON placements(property_id);
CREATE INDEX IF NOT EXISTS idx_placements_status   ON placements(status);

COMMENT ON TABLE placements IS
  'Long-term placement commission, recorded manually after a deal closes. Recording posts commission_receivable/revenue_commission; payment posts cash/commission_receivable.';
