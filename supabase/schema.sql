-- Ejecuta esto una sola vez en Supabase: Dashboard > SQL Editor > New query > pega y "Run".

create table if not exists public.raiz_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Seguridad a nivel de fila: cada usuario solo puede ver y tocar SU PROPIA fila.
alter table public.raiz_data enable row level security;

create policy "Cada usuario lee solo su fila"
  on public.raiz_data for select
  using (auth.uid() = user_id);

create policy "Cada usuario inserta solo su fila"
  on public.raiz_data for insert
  with check (auth.uid() = user_id);

create policy "Cada usuario actualiza solo su fila"
  on public.raiz_data for update
  using (auth.uid() = user_id);

create policy "Cada usuario borra solo su fila"
  on public.raiz_data for delete
  using (auth.uid() = user_id);
