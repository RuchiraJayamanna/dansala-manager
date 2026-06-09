
## Scope
Multiple related improvements across exports, teams, checklist, and contributions.

### 1. Exports (PDF + Excel)
- **Teams export**: Group by Phase → Team (matching web view), include members under each team, plus team's important notes as bullets. One sheet per phase in Excel with team sub-headers; PDF gets a section per phase with sub-tables per team + notes.
- **Checklist export**: include "Important notes" as bulleted block. Rename "Owner" column to "Responsible person(s)" and list multiple staff when assigned.
- **Agenda export**: keep bulleted "Important notes" (already done; verify).
- **Excel formulas**: replace hardcoded totals (e.g., `["TOTAL", planned, actual]`) with `=SUM(...)` formulas referencing the rows above. Applies in budget summary, contributions, checklist counts, complete summary.
- **Scrollable list panels in web view**: wrap long lists (contributions table, checklist items, teams cards, agenda) in scroll containers with sticky headers so page header/actions stay visible.

### 2. Checklist — multi-staff responsible person
- Add `checklist_assignees` join table: `(checklist_item_id, staff_id)` with admin write / public read policies and grants.
- UI: rename "Owner" → "Responsible person(s)". Show primary responsible + chips for added staff. Admin can add additional staff via a popover (multi-select). Display all names in list view, exports.
- Keep existing `owner_staff_id` as the primary.

### 3. Contributions — receipt attachments + office top-up
- Add `contribution_receipts` table mirroring `budget_receipts`: `(contribution_id, file_path, file_name, uploaded_at)` + RLS + grants. Store files in existing `receipts` bucket under `contributions/` prefix.
- UI: per-row paperclip button to upload + list/download/delete attached receipts (admin only). Public sees view link.
- **Office top-up**: add `office_contribution` numeric column on `events` (or a per-contribution `funded_by` flag). Simpler: a single event-level "Office funded amount" (sometimes used). Show in contributions summary: Collected from staff + Office funded = Total available vs budget.

### 4. Teams — smarter staff picker + remove attendance checkbox
- In "Assign member" dialog, filter staff list: hide staff already assigned to the **same (phase, team_name)** pair. Still show them when adding to a different team in the same phase, or different phase.
- Remove the per-member attendance Checkbox in team cards (no current use); drop the `toggle` mutation. (Keep `attended` column in DB for historical data.)

### 5. Scroll containers
- For Contributions table, Checklist list, Teams (per-phase grid), and Agenda list: wrap in `max-h-[calc(100vh-Xrem)] overflow-y-auto` with a `sticky top-0` table header where applicable. Page chrome stays put.

## Technical notes
- New migration: `checklist_assignees` table, `contribution_receipts` table, `events.office_contribution` numeric column.
- Update `event-context.tsx` type to include `office_contribution`.
- `lib/export.ts`: extend `exportXlsx` to accept formula cells. Simplest: just inject `{ f: "SUM(F4:F12)" }` cells where needed. Switch from `aoa_to_sheet` rows to assembling rows with cell objects when a formula is needed (XLSX supports `{ t: 'n', f: 'SUM(...)' }`).
- Web scroll containers: keep header outside, list body inside `ScrollArea` (already imported in some pages) or plain `overflow-y-auto` div.

## Out of scope
- Renaming the contributions module/labels beyond the office top-up addition.
- Reworking master data screens.
- Changing PDF visual theming.

## Confirmation
This is a large change set. Confirming this is the right shape before I implement; once approved I'll create the migration + edits in a single pass.
