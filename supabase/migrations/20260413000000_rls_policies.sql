-- ============================================================
-- CrewFind — Row Level Security Policies
-- Apply via Supabase dashboard → SQL Editor, or `supabase db push`
-- ============================================================

-- ── Enable RLS on every table ────────────────────────────────
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE listings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE hangars        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins         ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE players        ENABLE ROW LEVEL SECURITY;

-- ── Helper: resolve rsi_handle for the current auth user ─────
-- Used in policies below to map auth.uid() → rsi_handle
CREATE OR REPLACE FUNCTION current_handle()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT rsi_handle FROM profiles WHERE id = auth.uid()
$$;

-- ── Helper: is the current auth user an admin? ────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admins WHERE rsi_handle = current_handle()
  )
$$;


-- ============================================================
-- profiles
-- ============================================================

-- Anyone (including anon) can read non-hidden, non-banned profiles
CREATE POLICY "profiles: public read"
  ON profiles FOR SELECT
  USING (
    (hidden IS NOT TRUE AND banned IS NOT TRUE)
    OR id = auth.uid()   -- owner always sees own profile
    OR is_admin()        -- admins see all
  );

-- Only the owner can update their own profile
-- Prevents changing id, rsi_handle, banned, hidden (admin-only fields)
CREATE POLICY "profiles: owner update"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND banned = (SELECT banned FROM profiles WHERE id = auth.uid())
    AND hidden = (SELECT hidden FROM profiles WHERE id = auth.uid())
  );

-- Insert handled by handleSession() after Supabase auth — must match auth.uid()
CREATE POLICY "profiles: owner insert"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Only owner can delete own profile (account deletion flow)
CREATE POLICY "profiles: owner delete"
  ON profiles FOR DELETE
  USING (id = auth.uid());

-- Admins can hide/ban (UPDATE) any profile
CREATE POLICY "profiles: admin update"
  ON profiles FOR UPDATE
  USING (is_admin());


-- ============================================================
-- listings
-- ============================================================

-- Anyone can read non-hidden listings
CREATE POLICY "listings: public read"
  ON listings FOR SELECT
  USING (
    hidden IS NOT TRUE
    OR owner = current_handle()  -- owner sees own even if hidden
    OR is_admin()
  );

-- Only authenticated users (non-guest = has auth.uid()) can create listings
CREATE POLICY "listings: authenticated insert"
  ON listings FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND owner = current_handle()
  );

-- Owner can update their own listing (bump, edit)
-- Prevents changing owner or hidden flag
CREATE POLICY "listings: owner update"
  ON listings FOR UPDATE
  USING (owner = current_handle())
  WITH CHECK (
    owner = current_handle()
    AND hidden = (SELECT hidden FROM listings WHERE id = listings.id)
  );

-- Owner can delete their own listing
CREATE POLICY "listings: owner delete"
  ON listings FOR DELETE
  USING (owner = current_handle());

-- Admins can hide/unhide any listing
CREATE POLICY "listings: admin update"
  ON listings FOR UPDATE
  USING (is_admin());


-- ============================================================
-- hangars
-- ============================================================

-- Only owner can see their own hangar
CREATE POLICY "hangars: owner read"
  ON hangars FOR SELECT
  USING (user_id = auth.uid());

-- Only owner can add ships to their hangar
CREATE POLICY "hangars: owner insert"
  ON hangars FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Only owner can remove ships from their hangar
CREATE POLICY "hangars: owner delete"
  ON hangars FOR DELETE
  USING (user_id = auth.uid());


-- ============================================================
-- ratings
-- ============================================================

-- Anyone can read ratings (used to display profile scores)
CREATE POLICY "ratings: public read"
  ON ratings FOR SELECT
  USING (true);

-- Authenticated users can submit a rating for someone else
CREATE POLICY "ratings: authenticated insert"
  ON ratings FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND rater_id = auth.uid()
    AND rater_id <> rated_id  -- can't rate yourself
  );

-- Owner can update their own rating (change score/comment)
CREATE POLICY "ratings: owner update"
  ON ratings FOR UPDATE
  USING (rater_id = auth.uid())
  WITH CHECK (rater_id = auth.uid());

-- Owner can delete their own rating
CREATE POLICY "ratings: owner delete"
  ON ratings FOR DELETE
  USING (rater_id = auth.uid());

-- Account deletion: owner can delete ratings they received too
CREATE POLICY "ratings: delete own received ratings"
  ON ratings FOR DELETE
  USING (rated_id = auth.uid());


-- ============================================================
-- conversations
-- ============================================================

-- Only participants can see a conversation
CREATE POLICY "conversations: participant read"
  ON conversations FOR SELECT
  USING (
    participant_a = current_handle()
    OR participant_b = current_handle()
    OR is_admin()
  );

-- Authenticated users can create conversations (startConversation)
CREATE POLICY "conversations: authenticated insert"
  ON conversations FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      participant_a = current_handle()
      OR participant_b = current_handle()
    )
  );

-- Only participants can update (cleared_by_a / cleared_by_b, last_message_at)
CREATE POLICY "conversations: participant update"
  ON conversations FOR UPDATE
  USING (
    participant_a = current_handle()
    OR participant_b = current_handle()
  );

-- Account deletion: participants can delete conversations they're part of
CREATE POLICY "conversations: participant delete"
  ON conversations FOR DELETE
  USING (
    participant_a = current_handle()
    OR participant_b = current_handle()
  );


-- ============================================================
-- messages
-- ============================================================

-- Only participants of the parent conversation can read messages
CREATE POLICY "messages: participant read"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.participant_a = current_handle() OR c.participant_b = current_handle())
    )
    OR is_admin()
  );

-- Only participants can send messages into a conversation
CREATE POLICY "messages: participant insert"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND sender_handle = current_handle()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.participant_a = current_handle() OR c.participant_b = current_handle())
    )
  );

-- Only the recipient (non-sender participant) can mark as read
CREATE POLICY "messages: recipient update"
  ON messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.participant_a = current_handle() OR c.participant_b = current_handle())
    )
    AND sender_handle <> current_handle()
  );

-- Account deletion: owner can delete their own messages
CREATE POLICY "messages: owner delete"
  ON messages FOR DELETE
  USING (sender_handle = current_handle());


-- ============================================================
-- reports
-- ============================================================

-- Only admins can read reports
CREATE POLICY "reports: admin read"
  ON reports FOR SELECT
  USING (is_admin());

-- Authenticated users can submit reports (not guests — requires auth.uid())
CREATE POLICY "reports: authenticated insert"
  ON reports FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND reporter_handle = current_handle()
  );

-- Nobody can update reports (immutable once submitted)
-- (no UPDATE policy = blocked for all)

-- Only admins can delete (dismiss) reports
CREATE POLICY "reports: admin delete"
  ON reports FOR DELETE
  USING (is_admin());


-- ============================================================
-- admins
-- ============================================================

-- Anyone authenticated can read (needed for checkAdminStatus query)
CREATE POLICY "admins: authenticated read"
  ON admins FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can add other admins
CREATE POLICY "admins: admin insert"
  ON admins FOR INSERT
  WITH CHECK (is_admin());

-- Only admins can remove admins
CREATE POLICY "admins: admin delete"
  ON admins FOR DELETE
  USING (is_admin());


-- ============================================================
-- blocks
-- ============================================================

-- Only the blocker can see their own block list
CREATE POLICY "blocks: owner read"
  ON blocks FOR SELECT
  USING (blocker_handle = current_handle());

-- Authenticated users can block others
CREATE POLICY "blocks: authenticated insert"
  ON blocks FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND blocker_handle = current_handle()
    AND blocker_handle <> blocked_handle
  );

-- Only the blocker can unblock
CREATE POLICY "blocks: owner delete"
  ON blocks FOR DELETE
  USING (blocker_handle = current_handle());


-- ============================================================
-- players  (in-verse status)
-- ============================================================

-- Anyone can read player status (shown on listings)
CREATE POLICY "players: public read"
  ON players FOR SELECT
  USING (true);

-- Only the owner can update their own status
CREATE POLICY "players: owner upsert"
  ON players FOR INSERT
  WITH CHECK (handle = current_handle() AND auth.uid() IS NOT NULL);

CREATE POLICY "players: owner update"
  ON players FOR UPDATE
  USING (handle = current_handle())
  WITH CHECK (handle = current_handle());
