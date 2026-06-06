## Dansala Management System — Major Restructure

Transform the app from a single-event tool into a multi-project event management system with public read-only access, admin-only edits, and full referential integrity.

### 1. Branding & Access Model
- Rebrand from "MISL Dansala 2026" → **Dansala Management System** (no hardcoded company name or year). App settings (company name, current year) become configurable in a small Settings page.
- **Public read-only**: Remove auth gate from all data pages. Anyone visiting the site sees dashboards/budget/teams/checklist/contributions in read-only mode.
- **Admin edits only**: Keep `/auth` login for admins. Disable public sign-up (login only, no "create account" UI). All mutation buttons (Add / Edit / Delete / status changes) only render when an admin is signed in.
- Seed admin must be created via Supabase (we'll display a one-time setup message). No in-app admin creation.

### 2. Multi-Project Architecture
- New `events` table: `name`, `year`, `location`, `dansala_type` (Morning Dansala / Heel Dansala / Gilan Pasa, etc. — master-driven), `event_date`, `status` (Planning / Active / Completed).
- Add `event_id` to `budget_items`, `team_members`, `checklist_items`, `contributions`, and a new `agenda_items` table.
- Add a **Project switcher** in the top bar. All pages filter by the selected event.
- Landing page lists all events as cards → click to open that project's dashboard.

### 3. Referential Integrity Fix (Master Data Sync)
Root cause: today we copy `name` into `team_members.name`, `contributions.member_name`, `checklist_items.owner` (text). Renaming staff doesn't propagate.

Fix: Always **join** to source-of-truth tables at read time instead of storing copies.
- `checklist_items.owner_staff_id` (FK → `staff.id`) — drop free-text owner.
- `team_members`: keep `staff_id` FK; remove duplicated `name/department/contact` from display logic (read from joined staff row).
- `contributions`: same — display staff name via join.
- Budget category becomes `category_id` (FK → `master_options`) so renaming a category updates everywhere.
- Team name becomes `team_id` (FK → `master_options` of type `team`).

### 4. Budget — Quantity × Rate Model
- Add `unit` (kg, pcs, packs…) and ensure `planned_qty × planned_unit_price = planned_amount` (auto-computed).
- Same for actuals: `actual_qty`, `actual_unit_price`, `actual_amount`.
- Inline editing supports the qty/rate form.
- **Receipts**: new `receipts` storage bucket (private, admin-write, public-read). `budget_items` gets a `receipt_url` (or a `budget_receipts` child table for multiple bills per item). Show file links / preview thumbnails.

### 5. Reports / Exports
On Summary page, three export modes per project:
- **Budget Estimation only** (planned columns).
- **Full Budget** (planned + actual + variance).
- **Complete Summary** (budget + teams + checklist + contributions + agenda).
Both Excel (clean multi-sheet with headers like the original Excel) and PDF for each.

### 6. Agenda / Event-Day Timeline
- New `agenda_items` table per event: `start_time`, `end_time`, `title`, `location`, `responsible_staff_id`, `notes`, `sort_order`.
- New **Agenda** page with timeline visualization + add/edit (admin) + export.

### 7. Navigation Restructure (no "Master Data" section)
Replace the single "Master Data" page with dedicated, friendly sections under a "Setup" group in the sidebar:
- Budget Categories
- Team Groups
- Departments
- Designations
- Dansala Types
- Checklist Statuses
- Contribution Statuses
- Units of Measure
Each is a thin CRUD page over `master_options` filtered by `option_type`.
"Staff" stays as its own top-level section.

### 8. Final Sidebar
```
Events (project list)
— per selected event —
  Dashboard
  Agenda
  Budget
  Teams
  Checklist
  Contributions
  Summary / Reports
Setup
  Staff
  Budget Categories
  Team Groups
  Departments
  Designations
  Dansala Types
  Units
  Statuses (checklist & contribution)
Settings (company name, current year, admin info)
```

### Technical Section (for review)

**DB migration:**
1. Create `events`, `agenda_items`, `app_settings` tables.
2. Add `event_id` (FK) to existing transactional tables; seed a default event from current data.
3. Replace text references with FKs: `checklist_items.owner_staff_id`, `budget_items.category_id`, `team_members.team_id`, `contributions.staff_id` (already exists) + `team_id`.
4. Add `units` master option type, `dansala_type` option type.
5. `budget_items`: add `unit`, `actual_qty`, `actual_unit_price`; generated columns or triggers to compute amounts.
6. `budget_receipts` table: `budget_item_id`, `file_path`, `file_name`, `uploaded_at`.
7. **RLS**: SELECT to `anon` + `authenticated` for all data tables (public read). INSERT/UPDATE/DELETE only to `authenticated` users in `admin_users` table (new `user_roles` table with `app_role` enum, `has_role()` security-definer fn).
8. Disable public signup via `configure_auth` (`disable_signup: true`).

**Storage:**
- Bucket `receipts` (public for reading). RLS: anyone read, only admins write.

**Frontend:**
- New `EventProvider` (React context) holding selected event id, persisted in localStorage.
- New `useIsAdmin()` hook: returns true if session user has admin role.
- Conditionally render all action buttons / form dialogs behind `isAdmin`.
- Replace `master.tsx` with per-type pages under `/setup/*`.
- Update all queries to filter by `event_id` and to join staff/categories/teams.
- Add `agenda.tsx`, `settings.tsx`, `events.tsx` (list/create projects).
- Update export utilities to support the three report modes.

**Routing:**
- `/` → public events list.
- `/event/$eventId/dashboard|budget|teams|checklist|contributions|agenda|summary` (public read).
- `/setup/*` (admin-only via inline gate, still SSR-public but UI shows "Sign in to edit").
- `/auth` login only (signup removed).
- `/_authenticated/*` no longer wraps data routes — only mutations.

This is a substantial refactor touching the schema, every page, auth model, and exports. After approval I'll execute it in this order: migration → seed default event → settings/role infra → events list + project switcher → rebuild each module on the new schema → agenda → receipts upload → reports → cleanup of old master page and 2026/MISL strings.
