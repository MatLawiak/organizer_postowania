-- ============================================================================
-- Planner Postow — Twisted Pixel — SCHEMAT v1.2
-- Migracja schematu + RLS + workflow (4 statusy) + zadania cykliczne + zasady.
-- Uruchom CALOSC raz w: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Idempotentna i bezpieczna do ponownego uruchomienia na istniejacej bazie
-- (migruje dane ze starych 6 statusow do nowych 4).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. TABELE BAZOWE (jesli jeszcze nie istnieja)
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
  archived boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

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

-- ---------------------------------------------------------------------------
-- 1. MIGRACJA DANYCH: stare 6 statusow -> nowe 4
--    Najpierw zdejmujemy straznika, by UPDATE nie walidowal przejsc.
-- ---------------------------------------------------------------------------

drop trigger if exists posts_guard_trg on public.posts;

update public.posts set status = 'Zaplanowany'
  where status in ('W przygotowaniu','Do poprawy');

-- nowy check: dokladnie 4 statusy
alter table public.posts drop constraint if exists posts_status_check;
alter table public.posts
  add constraint posts_status_check
  check (status in ('Zaplanowany','Do akceptacji','Zaakceptowany','Opublikowany'));

create index if not exists posts_client_idx on public.posts(client_id);
create index if not exists posts_date_idx   on public.posts(publish_date);
create index if not exists posts_status_idx  on public.posts(status);
create index if not exists comments_post_idx on public.post_comments(post_id);

-- ---------------------------------------------------------------------------
-- 2. NOWE TABELE v1.2: zadania cykliczne + zasady prowadzenia
-- ---------------------------------------------------------------------------

create table if not exists public.recurring_tasks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,  -- NULL = ogolne
  label text not null,
  description text,
  weekday int not null check (weekday between 0 and 6),   -- 0=poniedzialek ... 6=niedziela
  frequency text not null default 'weekly' check (frequency in ('weekly')),
  created_by uuid references public.profiles(id),         -- wlasciciel (prawo usuniecia)
  created_at timestamptz not null default now()
);

create table if not exists public.client_rules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  body text not null,
  position int not null default 0,
  created_by uuid references public.profiles(id),         -- wlasciciel (prawo usuniecia)
  created_at timestamptz not null default now()
);

create index if not exists rt_client_idx    on public.recurring_tasks(client_id);
create index if not exists rules_client_idx on public.client_rules(client_id);

-- ---------------------------------------------------------------------------
-- 3. FUNKCJE POMOCNICZE (SECURITY DEFINER — omijaja RLS, brak rekurencji)
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns text language sql security definer set search_path = public stable
as $$ select role from public.profiles where id = auth.uid(); $$;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable
as $$ select coalesce(public.current_user_role() = 'admin', false); $$;

-- ---------------------------------------------------------------------------
-- 4. AUTOMATYCZNY PROFIL PRZY REJESTRACJI
-- ---------------------------------------------------------------------------

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
-- 5. STRAZNIK WORKFLOW (4 statusy)
--    Zaplanowany   --(worker)--> Do akceptacji
--    Do akceptacji --(admin)---> Zaakceptowany
--    Do akceptacji --(admin)---> Zaplanowany    (odeslanie do poprawy + komentarz)
--    Zaakceptowany --(worker)--> Opublikowany
-- ---------------------------------------------------------------------------

create or replace function public.posts_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  r text := public.current_user_role();
  required_role text;
begin
  new.updated_at := now();

  -- Kontekst serwisowy (service_role / seed / konserwacja / n8n) omija straznika.
  if auth.uid() is null then
    return new;
  end if;

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

  -- walidacja przejscia statusu
  if new.status is distinct from old.status then
    required_role := case
      when old.status = 'Zaplanowany'   and new.status = 'Do akceptacji' then 'worker'
      when old.status = 'Do akceptacji' and new.status = 'Zaakceptowany' then 'admin'
      when old.status = 'Do akceptacji' and new.status = 'Zaplanowany'   then 'admin'
      when old.status = 'Zaakceptowany' and new.status = 'Opublikowany'  then 'worker'
      else null
    end;

    if required_role is null then
      raise exception 'Niedozwolone przejscie statusu: % -> %.', old.status, new.status;
    end if;
    if r is distinct from required_role then
      raise exception 'Brak uprawnien: przejscie % -> % wymaga roli %.', old.status, new.status, required_role;
    end if;

    -- odeslanie do poprawy (Do akceptacji -> Zaplanowany) wymaga komentarza
    if old.status = 'Do akceptacji' and new.status = 'Zaplanowany' then
      if not exists (
        select 1 from public.post_comments
        where post_id = new.id and created_at > old.updated_at
      ) then
        raise exception 'Odeslanie do poprawy wymaga komentarza z uwagami.';
      end if;
    end if;
  end if;

  return new;
end; $$;

drop trigger if exists posts_guard_trg on public.posts;
create trigger posts_guard_trg
  before update on public.posts
  for each row execute function public.posts_guard();

-- ---------------------------------------------------------------------------
-- 6. RPC: odeslanie do poprawy (atomowo: komentarz + powrot do Zaplanowany)
-- ---------------------------------------------------------------------------

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
-- 7. RLS
-- ---------------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.clients         enable row level security;
alter table public.posts           enable row level security;
alter table public.post_comments   enable row level security;
alter table public.recurring_tasks enable row level security;
alter table public.client_rules    enable row level security;

-- PROFILES
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (public.is_admin());

-- CLIENTS: czyta kazdy; tworzy/edytuje/USUWA admin
drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select to authenticated using (true);
drop policy if exists clients_admin_write on public.clients;
create policy clients_admin_write on public.clients for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- POSTS: czyta kazdy; tworzy/USUWA admin; UPDATE pilnuje straznik
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select to authenticated using (true);
drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts for insert to authenticated with check (public.is_admin());
drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts for update to authenticated using (true) with check (true);
drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts for delete to authenticated using (public.is_admin());

-- POST_COMMENTS: czyta kazdy; bezposredni insert admin (reject_post omija RLS)
drop policy if exists comments_select on public.post_comments;
create policy comments_select on public.post_comments for select to authenticated using (true);
drop policy if exists comments_insert on public.post_comments;
create policy comments_insert on public.post_comments for insert to authenticated with check (public.is_admin());

-- RECURRING_TASKS: czyta kazdy; insert obie role (jako swoj); DELETE/UPDATE admin lub wlasciciel
drop policy if exists rt_select on public.recurring_tasks;
create policy rt_select on public.recurring_tasks for select to authenticated using (true);
drop policy if exists rt_insert on public.recurring_tasks;
create policy rt_insert on public.recurring_tasks for insert to authenticated with check (created_by = auth.uid());
drop policy if exists rt_update on public.recurring_tasks;
create policy rt_update on public.recurring_tasks for update to authenticated
  using (public.is_admin() or created_by = auth.uid()) with check (public.is_admin() or created_by = auth.uid());
drop policy if exists rt_delete on public.recurring_tasks;
create policy rt_delete on public.recurring_tasks for delete to authenticated
  using (public.is_admin() or created_by = auth.uid());

-- CLIENT_RULES: analogicznie wg wlasnosci
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

-- ---------------------------------------------------------------------------
-- 8. GRANTY
-- ---------------------------------------------------------------------------
grant execute on function public.reject_post(uuid, text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.current_user_role() to authenticated;

-- Gotowe (schemat v1.2).
