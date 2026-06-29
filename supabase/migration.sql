-- ============================================================================
-- Planner Postow — Twisted Pixel — SCHEMAT v1.4
-- 4 statusy + serie cykliczne (posts.recur_id) + rownouprawnienie ról
-- (obie role tworza posty/klientow i publikuja; akcept/odrzut tylko admin;
--  usuwanie wg wlasnosci). Zasady prowadzenia (client_rules) bez zmian.
-- Uruchom CALOSC raz na WLASCIWYM projekcie (xgjcglsmqiyhwtxfqcwp):
--   SQL Editor -> New query -> wklej -> Run. Idempotentna.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. TABELE BAZOWE
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('admin','worker')),
  created_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null,
  platforms text[] not null,
  dark_text boolean not null default false,
  note text,
  archived boolean not null default false,
  position int not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
-- dokladka kolumn jesli tabela istniala (v1.2)
alter table public.clients add column if not exists note text;
alter table public.clients add column if not exists created_by uuid references public.profiles(id);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  publish_date date not null,
  publish_time time,
  platforms text[] not null,
  format text not null check (format in ('Post','Rolka','Karuzela','Story')),
  title text not null,
  brief text,
  content text,
  content_linkedin text,
  graphic_url text,
  status text not null default 'Zaplanowany',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.client_rules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  body text not null,
  position int not null default 0,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 1. SERIE CYKLICZNE (nowe v1.4) + powiazanie z postami
-- ---------------------------------------------------------------------------
create table if not exists public.series (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  format text not null check (format in ('Post','Rolka','Karuzela','Story')),
  platforms text[] not null,
  brief text,
  frequency text not null check (frequency in ('weekly','biweekly','monthly','days')),
  interval_days int not null default 7,
  start_date date not null,
  end_date date,
  skip_dates date[] not null default '{}',   -- pojedyncze usuniete wystapienia
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.series add column if not exists skip_dates date[] not null default '{}';

-- posty: powiazanie z seria (wystapienie). recur_date = data wystapienia.
alter table public.posts add column if not exists recur_id uuid references public.series(id) on delete cascade;
alter table public.posts add column if not exists recur_date date;

-- recurring_tasks z v1.2 zastapione przez series — usuwamy.
drop table if exists public.recurring_tasks cascade;

-- 4-statusowy check (idempotentnie)
alter table public.posts drop constraint if exists posts_status_check;
alter table public.posts
  add constraint posts_status_check
  check (status in ('Zaplanowany','Do akceptacji','Zaakceptowany','Opublikowany'));

create index if not exists posts_client_idx on public.posts(client_id);
create index if not exists posts_date_idx   on public.posts(publish_date);
create index if not exists posts_status_idx  on public.posts(status);
create index if not exists posts_recur_idx   on public.posts(recur_id, recur_date);
create index if not exists comments_post_idx on public.post_comments(post_id);
create index if not exists rules_client_idx  on public.client_rules(client_id);
create index if not exists series_client_idx on public.series(client_id);

-- ---------------------------------------------------------------------------
-- 2. FUNKCJE POMOCNICZE
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns text language sql security definer set search_path = public stable
as $$ select role from public.profiles where id = auth.uid(); $$;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable
as $$ select coalesce(public.current_user_role() = 'admin', false); $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce(nullif(new.raw_user_meta_data->>'role',''), 'worker')
  )
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. STRAZNIK WORKFLOW (v1.4)
--   Zaplanowany   --(obie role)--> Do akceptacji
--   Do akceptacji --(admin)------> Zaakceptowany
--   Do akceptacji --(admin)------> Zaplanowany     (odeslanie do poprawy + komentarz)
--   dowolny       --(obie role)--> Opublikowany
--   Obie role moga edytowac wszystkie pola posta.
-- ---------------------------------------------------------------------------
create or replace function public.posts_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  r text := public.current_user_role();
begin
  new.updated_at := now();

  -- kontekst serwisowy (service_role / seed / n8n) omija straznika
  if auth.uid() is null then
    return new;
  end if;

  if new.status is distinct from old.status then
    if new.status = 'Opublikowany' then
      null;  -- publikacja dozwolona z dowolnego statusu przez obie role
    elsif old.status = 'Zaplanowany' and new.status = 'Do akceptacji' then
      null;  -- wyslanie do akceptacji (obie role)
    elsif old.status = 'Do akceptacji' and new.status = 'Zaakceptowany' then
      if r is distinct from 'admin' then
        raise exception 'Brak uprawnien: akceptacja wymaga roli admin.';
      end if;
    elsif old.status = 'Do akceptacji' and new.status = 'Zaplanowany' then
      if r is distinct from 'admin' then
        raise exception 'Brak uprawnien: odeslanie do poprawy wymaga roli admin.';
      end if;
      if not exists (
        select 1 from public.post_comments
        where post_id = new.id and created_at > old.updated_at
      ) then
        raise exception 'Odeslanie do poprawy wymaga komentarza z uwagami.';
      end if;
    else
      raise exception 'Niedozwolone przejscie statusu: % -> %.', old.status, new.status;
    end if;
  end if;

  return new;
end; $$;

drop trigger if exists posts_guard_trg on public.posts;
create trigger posts_guard_trg
  before update on public.posts
  for each row execute function public.posts_guard();

create or replace function public.reject_post(p_post_id uuid, p_comment text)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Tylko admin moze odsylac do poprawy.';
  end if;
  if coalesce(trim(p_comment), '') = '' then
    raise exception 'Komentarz z uwagami jest wymagany.';
  end if;
  insert into public.post_comments (post_id, author_id, body)
  values (p_post_id, auth.uid(), p_comment);
  update public.posts set status = 'Zaplanowany' where id = p_post_id;
end; $$;

-- ---------------------------------------------------------------------------
-- 4. RLS (v1.4 — obie role tworza/edytuja; usuwanie wg wlasnosci)
-- ---------------------------------------------------------------------------
alter table public.profiles      enable row level security;
alter table public.clients       enable row level security;
alter table public.posts         enable row level security;
alter table public.post_comments enable row level security;
alter table public.client_rules  enable row level security;
alter table public.series        enable row level security;

-- PROFILES
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (public.is_admin());

-- CLIENTS: czyta kazdy; tworzy/edytuje obie role; usuwa admin lub wlasciciel
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select to authenticated using (true);
drop policy if exists clients_admin_write on public.clients;   -- stara polityka v1.2
drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients for insert to authenticated with check (created_by = auth.uid());
drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update to authenticated using (true) with check (true);
drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- POSTS: czyta kazdy; tworzy/edytuje obie role; delete admin lub wlasne (nie zaakcept./opublik.)
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select to authenticated using (true);
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated with check (created_by = auth.uid());
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated using (true) with check (true);
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete to authenticated
  using (public.is_admin() or (created_by = auth.uid() and status not in ('Zaakceptowany','Opublikowany')));

-- POST_COMMENTS: czyta kazdy; insert admin (reject_post omija RLS)
drop policy if exists comments_select on public.post_comments;
create policy comments_select on public.post_comments for select to authenticated using (true);
drop policy if exists comments_insert on public.post_comments;
create policy comments_insert on public.post_comments for insert to authenticated with check (public.is_admin());

-- CLIENT_RULES: czyta kazdy; insert wlasne; delete/update admin lub wlasciciel
drop policy if exists rules_select on public.client_rules;
create policy rules_select on public.client_rules for select to authenticated using (true);
drop policy if exists rules_insert on public.client_rules;
create policy rules_insert on public.client_rules for insert to authenticated with check (created_by = auth.uid());
drop policy if exists rules_update on public.client_rules;
create policy rules_update on public.client_rules for update to authenticated
  using (public.is_admin() or created_by = auth.uid()) with check (public.is_admin() or created_by = auth.uid());
drop policy if exists rules_delete on public.client_rules;
create policy rules_delete on public.client_rules for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- SERIES: czyta kazdy; insert wlasne; update/delete admin lub wlasciciel
drop policy if exists series_select on public.series;
create policy series_select on public.series for select to authenticated using (true);
drop policy if exists series_insert on public.series;
create policy series_insert on public.series for insert to authenticated with check (created_by = auth.uid());
drop policy if exists series_update on public.series;
create policy series_update on public.series for update to authenticated
  using (public.is_admin() or created_by = auth.uid()) with check (public.is_admin() or created_by = auth.uid());
drop policy if exists series_delete on public.series;
create policy series_delete on public.series for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 5. GRANTY
-- ---------------------------------------------------------------------------
grant execute on function public.reject_post(uuid, text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_user_role() to authenticated;

-- Gotowe (schemat v1.4).
