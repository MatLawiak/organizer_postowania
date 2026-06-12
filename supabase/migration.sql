-- ============================================================================
-- Planner Postow — Twisted Pixel
-- Migracja schematu + RLS + walidacja workflow statusow.
-- Uruchom CALOSC raz w: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Idempotentna (mozna odpalic ponownie).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. TABELE
-- ---------------------------------------------------------------------------

-- Profile uzytkownikow (rozszerzenie auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('admin','worker')),
  created_at timestamptz not null default now()
);

-- Klienci = dashboardy
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null,                 -- hex, kolor w kalendarzu/zakladkach
  platforms text[] not null,           -- np. '{IG,FB,LI}'
  dark_text boolean not null default false, -- czy numer dnia ma byc ciemny na tle koloru
  archived boolean not null default false,
  position int not null default 0,     -- kolejnosc zakladek
  created_at timestamptz not null default now()
);

-- Posty
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  publish_date date not null,
  publish_time time,                   -- furtka na przyszlosc (auto-publikacja)
  platforms text[] not null,           -- podzbior platform klienta: IG/FB/LI
  format text not null check (format in ('Post','Rolka','Karuzela','Story')),
  title text not null,
  brief text,
  content text,                        -- tresc Meta (IG/FB)
  content_linkedin text,               -- opcjonalny wariant LinkedIn
  graphic_url text,                    -- link do grafiki (Canva/Drive)
  status text not null default 'Zaplanowany' check (status in
    ('Zaplanowany','W przygotowaniu','Do akceptacji','Do poprawy','Zaakceptowany','Opublikowany')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_client_idx  on public.posts(client_id);
create index if not exists posts_date_idx     on public.posts(publish_date);
create index if not exists posts_status_idx   on public.posts(status);

-- Komentarze do poprawek (historia uwag)
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid references public.profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists comments_post_idx on public.post_comments(post_id);

-- ---------------------------------------------------------------------------
-- 2. FUNKCJE POMOCNICZE (SECURITY DEFINER — omijaja RLS, brak rekurencji)
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

-- ---------------------------------------------------------------------------
-- 3. AUTOMATYCZNY PROFIL PRZY REJESTRACJI
--    Rola i nazwa brane z user_metadata; domyslnie worker.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4. updated_at + STRAZNIK WORKFLOW NA POSTACH
-- ---------------------------------------------------------------------------

-- Dozwolone przejscia statusow -> rola, ktora moze je wykonac.
create or replace function public.posts_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text := public.current_user_role();
  required_role text;
begin
  -- zawsze odswiezamy znacznik czasu
  new.updated_at := now();

  -- worker nie moze ruszac pol planistycznych (admin: tak)
  if r is distinct from 'admin' then
    if new.brief        is distinct from old.brief
       or new.title       is distinct from old.title
       or new.publish_date is distinct from old.publish_date
       or new.publish_time is distinct from old.publish_time
       or new.platforms   is distinct from old.platforms
       or new.format      is distinct from old.format
       or new.client_id   is distinct from old.client_id then
      raise exception 'Brak uprawnien: pracownik nie moze edytowac pol planistycznych posta.';
    end if;
  end if;

  -- walidacja przejscia statusu (tylko gdy status sie zmienil)
  if new.status is distinct from old.status then
    required_role := case
      when old.status = 'Zaplanowany'     and new.status = 'W przygotowaniu' then 'worker'
      when old.status = 'W przygotowaniu' and new.status = 'Do akceptacji'   then 'worker'
      when old.status = 'Do poprawy'      and new.status = 'Do akceptacji'   then 'worker'
      when old.status = 'Do akceptacji'   and new.status = 'Zaakceptowany'   then 'admin'
      when old.status = 'Do akceptacji'   and new.status = 'Do poprawy'      then 'admin'
      when old.status = 'Zaakceptowany'   and new.status = 'Opublikowany'    then 'worker'
      else null
    end;

    if required_role is null then
      raise exception 'Niedozwolone przejscie statusu: % -> %.', old.status, new.status;
    end if;

    if r is distinct from required_role then
      raise exception 'Brak uprawnien: przejscie % -> % wymaga roli %.', old.status, new.status, required_role;
    end if;

    -- "Do poprawy" wymaga komentarza dodanego w tej samej operacji (przez reject_post)
    if new.status = 'Do poprawy' then
      if not exists (
        select 1 from public.post_comments
        where post_id = new.id and created_at > old.updated_at
      ) then
        raise exception 'Status "Do poprawy" wymaga komentarza z uwagami.';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists posts_guard_trg on public.posts;
create trigger posts_guard_trg
  before update on public.posts
  for each row execute function public.posts_guard();

-- ---------------------------------------------------------------------------
-- 5. RPC: odeslanie do poprawy (atomowo: komentarz + status)
-- ---------------------------------------------------------------------------

create or replace function public.reject_post(p_post_id uuid, p_comment text)
returns void
language plpgsql
security definer
set search_path = public
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

  update public.posts set status = 'Do poprawy' where id = p_post_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.clients       enable row level security;
alter table public.posts         enable row level security;
alter table public.post_comments enable row level security;

-- PROFILES: kazdy zalogowany czyta; edycja siebie lub admin
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (public.is_admin());

-- CLIENTS: czyta kazdy zalogowany; zmienia tylko admin
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients
  for select to authenticated using (true);

drop policy if exists clients_admin_write on public.clients;
create policy clients_admin_write on public.clients
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- POSTS: czyta kazdy; tworzy/usuwa admin; UPDATE pilnuje straznik (trigger)
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts
  for select to authenticated using (true);

drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts
  for insert to authenticated with check (public.is_admin());

drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts
  for update to authenticated using (true) with check (true);

drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts
  for delete to authenticated using (public.is_admin());

-- POST_COMMENTS: czyta kazdy; bezposredni insert tylko admin (reject_post i tak omija RLS)
drop policy if exists comments_select on public.post_comments;
create policy comments_select on public.post_comments
  for select to authenticated using (true);

drop policy if exists comments_insert on public.post_comments;
create policy comments_insert on public.post_comments
  for insert to authenticated with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. GRANTY DLA RPC
-- ---------------------------------------------------------------------------
grant execute on function public.reject_post(uuid, text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_user_role() to authenticated;

-- Gotowe. Konta uzytkownikow zaklada osobny krok (Auth Admin API / seed).
