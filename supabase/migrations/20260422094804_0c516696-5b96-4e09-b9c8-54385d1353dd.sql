-- Add MTD aggregation type to kpi_master
DO $$ BEGIN
  CREATE TYPE public.mtd_aggregation_type AS ENUM ('sum', 'average', 'weighted_average');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.kpi_master
  ADD COLUMN IF NOT EXISTS mtd_aggregation public.mtd_aggregation_type NOT NULL DEFAULT 'sum';

-- Pre-populate sensible defaults based on unit
UPDATE public.kpi_master
SET mtd_aggregation = 'average'
WHERE unit IS NOT NULL
  AND lower(unit) IN ('%', 'days', 'score', 'mwh', 'kl');
