-- ============================================================
-- CrewFind — Pilot Since + Ship Thumbnail Cache
-- Apply via Supabase dashboard → SQL Editor
-- ============================================================

-- ── Pilot Since ───────────────────────────────────────────────
-- Lets users record when they started playing, independent of
-- their CrewFind account creation date.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pilot_since date;


-- ── Ship Thumbnails cache table ───────────────────────────────
-- Stores thumbnail URLs after first fetch so we don't hit the
-- starcitizen.tools API on every hangar load.
CREATE TABLE IF NOT EXISTS ship_thumbnails (
  ship_name    text PRIMARY KEY,
  thumbnail_url text NOT NULL,
  cached_at    timestamptz DEFAULT now()
);

ALTER TABLE ship_thumbnails ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anon) can read cached thumbnails
CREATE POLICY "ship_thumbnails: public read"
  ON ship_thumbnails FOR SELECT
  USING (true);

-- Authenticated users can insert new cache entries
CREATE POLICY "ship_thumbnails: authenticated insert"
  ON ship_thumbnails FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Authenticated users can refresh stale entries
CREATE POLICY "ship_thumbnails: authenticated update"
  ON ship_thumbnails FOR UPDATE
  USING (auth.uid() IS NOT NULL);


-- ── Ship Thumbnails storage bucket ────────────────────────────
-- Public bucket — images are served directly to the browser.
INSERT INTO storage.buckets (id, name, public)
VALUES ('ship-thumbnails', 'ship-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Public read on every object in the bucket
CREATE POLICY "ship-thumbnails bucket: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ship-thumbnails');

-- Authenticated users can upload/replace thumbnail images
CREATE POLICY "ship-thumbnails bucket: authenticated upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'ship-thumbnails'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "ship-thumbnails bucket: authenticated update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'ship-thumbnails'
    AND auth.uid() IS NOT NULL
  );
