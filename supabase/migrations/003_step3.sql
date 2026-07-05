-- room_votes: tag voting per member
CREATE TABLE IF NOT EXISTS room_votes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id    text        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  member_id  uuid        NOT NULL REFERENCES room_members(id) ON DELETE CASCADE,
  tag_name   text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT room_votes_unique UNIQUE (room_id, member_id, tag_name)
);
ALTER TABLE room_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON room_votes FOR ALL TO public USING (true) WITH CHECK (true);
ALTER TABLE room_votes REPLICA IDENTITY FULL;

-- room_candidates: AI-generated spot candidates
CREATE TABLE IF NOT EXISTS room_candidates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     text        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text        NOT NULL,
  budget      text        NOT NULL,
  reason      text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE room_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON room_candidates FOR ALL TO public USING (true) WITH CHECK (true);

-- room_candidate_likes: heart reactions per candidate per member
CREATE TABLE IF NOT EXISTS room_candidate_likes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid        NOT NULL REFERENCES room_candidates(id) ON DELETE CASCADE,
  member_id    uuid        NOT NULL REFERENCES room_members(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT room_candidate_likes_unique UNIQUE (candidate_id, member_id)
);
ALTER TABLE room_candidate_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON room_candidate_likes FOR ALL TO public USING (true) WITH CHECK (true);
ALTER TABLE room_candidate_likes REPLICA IDENTITY FULL;

-- Enable Realtime for all three tables
ALTER PUBLICATION supabase_realtime ADD TABLE room_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE room_candidates;
ALTER PUBLICATION supabase_realtime ADD TABLE room_candidate_likes;
