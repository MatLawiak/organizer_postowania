# Planner Postów — Twisted Pixel

Wewnętrzne narzędzie agencji: planner postów social media z workflow akceptacji.
React (Vite) + Supabase (PostgreSQL + Auth + RLS) + czysty CSS z design tokenami.
Narzędzie **nie publikuje** automatycznie — to planner + system akceptacji.

## Stack

| Warstwa | Technologia |
|---|---|
| Frontend | React 18 + TypeScript (Vite), SPA |
| Backend / baza | Supabase (PostgreSQL) |
| Auth | Supabase Auth (e-mail + hasło) |
| Hosting | Vercel |
| Styl | czysty CSS + custom properties (bez Tailwind/Bootstrap) |

## Konfiguracja lokalna

1. Zainstaluj zależności:
   ```bash
   npm install
   ```
2. Skopiuj `.env.example` do `.env.local` i uzupełnij:
   ```
   VITE_SUPABASE_URL=https://<projekt>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
   ```
   Klucz **publishable** (publiczny) jest bezpieczny w przeglądarce — chroni go RLS.
3. Uruchom:
   ```bash
   npm run dev
   ```

## Konfiguracja Supabase (jednorazowo)

1. Wejdź w **SQL Editor → New query** i uruchom całość pliku [`supabase/migration.sql`](supabase/migration.sql).
   Tworzy tabele, RLS, walidację workflow statusów (trigger) i RPC `reject_post`.
2. Załóż 2 konta użytkowników (Authentication → Users, albo Auth Admin API).
   Rola i nazwa idą z `user_metadata`:
   ```json
   { "display_name": "Wojciech", "role": "admin" }
   { "display_name": "Pracownik", "role": "worker" }
   ```
   Trigger `handle_new_user` automatycznie tworzy wpis w `profiles` (domyślnie `worker`).

## Model danych (schemat v1.4)

- `profiles` — rozszerzenie `auth.users` (display_name, role: admin/worker)
- `clients` — klienci = dashboardy (name, color, platforms[], dark_text, **note**, **created_by**)
- `posts` — posty (data, platformy, format, tytuł, brief, treść, wariant LI, link grafiki, status, **recur_id/recur_date**)
- `post_comments` — historia uwag do poprawek
- `series` — serie cykliczne (frequency: weekly/biweekly/monthly/days, interval_days, start/end, skip_dates)
- `client_rules` — zasady prowadzenia klienta (lista punktów); własność po `created_by`

Wystąpienia serii generowane są **wirtualnie** w aplikacji (horyzont: bieżący miesiąc + 3 / 12 wstecz);
realny rekord `posts` powstaje dopiero przy uzupełnieniu treści lub publikacji wystąpienia (materializacja „na dotyk").

## Role (v1.4) i workflow — 4 statusy (egzekwowane w bazie)

Obie role tworzą/edytują posty i klientów oraz **publikują dowolny post**. Tylko admin akceptuje / odsyła do poprawy.
Usuwanie wg własności (worker tylko swoje i niezaakceptowane).

```
Zaplanowany   ──(obie role: „Wyślij do akceptacji")──► Do akceptacji
Do akceptacji ──(admin: „Akceptuj")──────────────────► Zaakceptowany
Do akceptacji ──(admin: „Do poprawy" + komentarz)────► Zaplanowany   (UI: „Do poprawek")
dowolny       ──(obie role: „Oznacz: Opublikowany")──► Opublikowany
```

Post w `Zaplanowany` z ≥1 komentarzem to **„Do poprawek"** (stan pochodny). Wystąpienia serii (♻)
nie przechodzą akceptacji. Przejścia i uprawnienia pilnuje trigger `posts_guard` + RLS; `reject_post` (RPC)
atomowo wstawia komentarz i cofa status.

## Widoki

Zaplanowane (kolejka, domyślny) · Do poprawy · Kalendarz (miesiąc/tydzień, drag&drop, filtr, Dziś) ·
Statystyki (KPI, m/m, przekroje, eksport CSV) · dashboardy klientów · powiadomienia (dzwonek, role-aware).

## Uprawnienia (RLS = źródło prawdy)

- **admin**: CRUD klientów, planowanie postów, edycja briefu, akceptacja / odsyłanie do poprawy.
- **worker**: uzupełnia treść + link grafiki, zmienia statusy w swoim zakresie. Nie edytuje briefu/pól planistycznych, nie akceptuje, nie zarządza klientami.

## Deploy na Vercel

1. Zaimportuj repo w Vercel (Framework: **Vite**).
2. Ustaw zmienne środowiskowe (Project Settings → Environment Variables):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
3. Deploy. Build command `npm run build`, output `dist`.

## Skrypty

| Komenda | Opis |
|---|---|
| `npm run dev` | serwer deweloperski (localhost:5173) |
| `npm run build` | build produkcyjny (typecheck + vite) |
| `npm run preview` | podgląd builda |
| `npm run lint` | typecheck bez emisji |

## Furtki rozwojowe (faza 2)

- **Powiadomienia e-mail przez n8n** — Supabase Database Webhook na zmianę statusu `posts` → webhook n8n → e-mail (Do akceptacji → admin, Do poprawy → worker) + przypomnienia o terminach (cron).
- Supabase Realtime (live-sync), upload grafik (Storage), auto-publikacja przez API Meta/LinkedIn — schemat już to przewiduje (`publish_time`, semantyka pól).
