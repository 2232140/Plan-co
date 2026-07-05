-- Add roulette state columns to rooms
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS selected_candidate_id uuid REFERENCES room_candidates(id),
  ADD COLUMN IF NOT EXISTS roulette_started_at   timestamptz;

-- Allow UPDATE on rooms (needed for host to update status/selected_candidate_id)
CREATE POLICY "Public update rooms"
  ON rooms FOR UPDATE TO public USING (true) WITH CHECK (true);

-- Enable Realtime on rooms so clients detect status changes
ALTER PUBLICATION supabase_realtime ADD TABLE rooms;
