
# Fix & Generalize Plan

Four coordinated slices. Executed in this order so the destructive schema change lands once and everything downstream references the new shape.

## 1. Security — RLS lockdown (highest priority)

Today every child table (`budget_items`, `contributions`, `checklist_items`, `checklist_assignees`, `agenda_items`, `team_members`, `budget_receipts`, `contribution_receipts`, `event_documents`, `item_checklist`, `staff`) has `SELECT USING (true)` for `anon` + `authenticated`. Anyone signed in — or even signed out on some tables — can read every event's data regardless of `events.is_public`.

New rule for every event-scoped table:

```sql
USING (
  public.has_role(auth.uid(), 'admin')
  OR EXISTS (SELECT 1 FROM public.events e
             WHERE e.id = <table>.event_id AND e.is_public = true)
)
```

- Drop `anon` from all child-table SELECT policies (never intended).
- `staff`, `master_options`, `app_settings` stay readable to any authenticated user (they're catalog data, not event data).
- `user_roles` unchanged.
- `event_documents` and receipts already scope by admin — verify they now also allow public-event read for authenticated users (needed so team members can see docs for their event).

## 2. Schema generalization

Rename `events.dansala_type` → `events.event_category`. Nullable stays.
Add:
- `currency text NOT NULL DEFAULT 'LKR'`
- `timezone text NOT NULL DEFAULT 'Asia/Colombo'`
- `starts_at timestamptz`, `ends_at timestamptz` (keep `event_date` for back-compat; new UI writes both)
- `visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('public','internal','private'))` — kept alongside `is_public` for one release; trigger keeps them in sync.

Rename `master_options` rows: `dansala_type` → `event_category`. Seed generic categories (`Conference`, `Workshop`, `Wedding`, `Community Event`, `Fundraiser`, `Other`) alongside existing entries so old data still resolves.

## 3. Rebrand shell to Event Manager

Text-only pass — no behavior change:
- App title in `__root.tsx`, `auth.tsx`, `index.tsx`, every route `head()` — replace "Dansala Management System" / "Dansala Manager" with "Event Manager".
- `format.ts`: `lkr()` becomes `money(amount, currency)` reading the event's currency; keep a thin `lkr()` alias for one release.
- Sidebar / `route.tsx` copy: "Dansala type" → "Event category", "Dansala Manager" → "Event Manager".
- README, `.lovable/project.json` name.
- Field labels in `events.tsx`, `dashboard.tsx`, `setup.$type.tsx` — no Sinhala-phase-specific copy in generic screens.

## 4. Event templates

New table:

```
event_templates(id, name, description, event_category,
                default_agenda jsonb, default_checklist jsonb,
                default_budget_categories jsonb,
                created_by uuid, created_at, updated_at)
```

- Admin-only RLS.
- "Save as template" action on an existing event (snapshots agenda/checklist/budget skeleton).
- "New event from template" flow in `events.tsx` — pick template, event is created and seeded.
- Templates page added to sidebar under Settings.

## Technical Details

**Migration order (one migration file):**
1. `ALTER TABLE events RENAME COLUMN dansala_type TO event_category`.
2. Add new columns + check constraint + backfill `visibility` from `is_public`.
3. Sync trigger `is_public ↔ visibility`.
4. `UPDATE master_options SET option_type='event_category' WHERE option_type='dansala_type'`.
5. Insert generic category master options.
6. Create `event_templates` table with GRANTs, RLS, admin policy, `updated_at` trigger.
7. Drop every `USING (true)` SELECT policy on child tables and replace with visibility-aware policy scoped to `authenticated` only.

**Code updates after migration approval:**
- Regenerate types (automatic).
- `event-context.tsx` — `Event` type: rename field, add new fields.
- Every route file — replace `dansala_type` with `event_category`, update labels.
- `format.ts` — currency-aware helpers.
- `events.tsx` — visibility select (`public|internal|private`), template picker, "Save as template".
- New route `src/routes/_authenticated/templates.tsx`.
- Sidebar (`_authenticated/route.tsx`) — add Templates link, rebrand copy.
- `__root.tsx` / index / auth — new title + description.

**Not in this pass** (called out in the earlier review, deferred):
- Polymorphic attachments consolidation.
- Per-event `event_members` roles / workspaces.
- Public event landing pages.
- Notifications / email.
- Audit log.
- Versioned analyses.

Happy to tackle any of the deferred items in a follow-up.
