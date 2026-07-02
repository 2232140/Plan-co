create table if not exists rooms (
  id          text primary key,
  created_at  timestamptz not null default now(),
  suggestions jsonb not null default '[]',
  location    text not null default 'どこでも'
);

-- Allow anonymous read/insert (no auth required)
alter table rooms enable row level security;

create policy "Public read rooms"
  on rooms for select using (true);

create policy "Public insert rooms"
  on rooms for insert with check (true);
