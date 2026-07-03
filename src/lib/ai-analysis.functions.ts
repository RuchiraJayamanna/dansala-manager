import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({ event_id: z.string().uuid() });

export const generateEventAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Admin only
    const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Response("Forbidden", { status: 403 });

    const eid = data.event_id;
    const [ev, budget, contrib, tasks, members, agenda] = await Promise.all([
      supabase.from("events").select("*").eq("id", eid).maybeSingle(),
      supabase.from("budget_items").select("*").eq("event_id", eid),
      supabase.from("contributions").select("*").eq("event_id", eid),
      supabase.from("checklist_items").select("*").eq("event_id", eid),
      supabase.from("team_members").select("*").eq("event_id", eid),
      supabase.from("agenda_items").select("*").eq("event_id", eid),
    ]);
    if (!ev.data) throw new Response("Event not found", { status: 404 });

    const planned = (budget.data ?? []).reduce((s, i: any) => s + Number(i.planned_amount || 0), 0);
    const actual = (budget.data ?? []).reduce((s, i: any) => s + Number(i.actual_amount || 0), 0);
    const collected = (contrib.data ?? []).filter((c: any) => c.status === "Paid" || c.status === "Completed").reduce((s, c: any) => s + Number(c.amount || 0), 0);
    const pending = (contrib.data ?? []).filter((c: any) => !["Paid", "Completed"].includes(c.status)).reduce((s, c: any) => s + Number(c.amount || 0), 0);
    const doneTasks = (tasks.data ?? []).filter((t: any) => t.status === "Done").length;
    const overdueTasks = (tasks.data ?? []).filter((t: any) => t.status !== "Done" && t.due_date && new Date(t.due_date) < new Date()).length;
    const byCat: Record<string, { p: number; a: number }> = {};
    for (const i of (budget.data ?? []) as any[]) {
      const c = i.category || "General";
      byCat[c] ??= { p: 0, a: 0 };
      byCat[c].p += Number(i.planned_amount || 0);
      byCat[c].a += Number(i.actual_amount || 0);
    }
    const overruns = Object.entries(byCat).filter(([, v]) => v.a > v.p).map(([c, v]) => `${c}: over by Rs. ${(v.a - v.p).toFixed(0)}`);
    const savings = Object.entries(byCat).filter(([, v]) => v.a < v.p && v.a > 0).map(([c, v]) => `${c}: saved Rs. ${(v.p - v.a).toFixed(0)}`);

    const payload = {
      event: {
        name: ev.data.name, year: ev.data.year, type: ev.data.event_category,
        location: ev.data.location, date: ev.data.event_date, status: ev.data.status,
        office_contribution: ev.data.office_contribution,
      },
      totals: { planned, actual, variance: planned - actual, collected, pending_contrib: pending, in_hand: Number(ev.data.office_contribution ?? 0) + collected - actual },
      counts: { budget_items: (budget.data ?? []).length, members: (members.data ?? []).length, tasks_total: (tasks.data ?? []).length, tasks_done: doneTasks, tasks_overdue: overdueTasks, agenda_items: (agenda.data ?? []).length, contributors: (contrib.data ?? []).length },
      budget_by_category: byCat,
      overruns,
      savings,
      notes: { agenda: ev.data.agenda_notes, checklist: ev.data.checklist_notes },
    };

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Response("AI not configured", { status: 500 });

    const prompt = `You are an event operations analyst reviewing a completed event. Based on the JSON data below, write a concise post-event analysis in clean Markdown with these sections:

## Overview
2-3 sentences describing the event outcome and financial health.

## What Went Well
Bullet points of successes based on the data (e.g. good task completion rate, categories under budget, strong contribution collection).

## What Could Be Improved
Bullet points of concerns (e.g. budget overruns, overdue tasks, low contribution rates, missing data).

## Suggestions for Next Year
Actionable, specific suggestions grounded in the numbers. Include budget adjustments where categories overran.

Keep the whole response under 400 words. Use the event's local currency formatting. Do not fabricate facts not in the data.

DATA:
${JSON.stringify(payload, null, 2)}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a helpful, concise event-operations analyst." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Response(`AI error: ${res.status} ${t}`, { status: 500 });
    }
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content ?? "";
    return { analysis: text as string };
  });