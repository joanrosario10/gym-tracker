// Daily reminder orchestrator.
// POST /functions/v1/daily-nudges?type=<breakfast|lunch|dinner|water|workout|goals>
//
// Runs the corresponding query, builds a per-user message, and dispatches
// via the user's preferred channel. Designed to be invoked by pg_cron at
// the appropriate local times (see schedule SQL in repo docs).

// @ts-expect-error — Deno globals provided by Supabase Edge runtime
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { sendNotification, type NotifyProfile, type NotifyResult } from '../_shared/notify.ts'

// @ts-expect-error — Deno is provided by Edge runtime
const env = (k: string) => Deno.env.get(k) ?? ''

type NudgeType = 'breakfast' | 'lunch' | 'dinner' | 'water' | 'workout' | 'goals'
const VALID: NudgeType[] = ['breakfast', 'lunch', 'dinner', 'water', 'workout', 'goals']

const PROFILE_COLS = 'id, display_name, email, instagram_handle, telegram_chat_id, notification_channel, daily_water_goal'

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const type = (url.searchParams.get('type') ?? '') as NudgeType

  if (!VALID.includes(type)) {
    return json({ error: 'invalid_type', allowed: VALID }, 400)
  }

  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  let results: NotifyResult[] = []
  try {
    switch (type) {
      case 'breakfast':
        results = await nudgeMissedMeal(supabase, today, 'breakfast')
        break
      case 'lunch':
        results = await nudgeMissedMeal(supabase, today, 'lunch')
        break
      case 'dinner':
        results = await nudgeMissedMeal(supabase, today, 'dinner')
        break
      case 'water':
        results = await nudgeWater(supabase, today)
        break
      case 'workout':
        results = await nudgeWorkout(supabase, today)
        break
      case 'goals':
        results = await nudgeGoals(supabase)
        break
    }
  } catch (err) {
    console.error('daily-nudges error', type, err)
    return json({ error: 'internal', detail: String((err as Error)?.message ?? err) }, 500)
  }

  const summary = {
    type,
    sent: results.filter((r) => r.ok && r.channel !== 'none').length,
    skipped: results.filter((r) => r.ok && r.channel === 'none').length,
    failed: results.filter((r) => !r.ok).length,
    results,
  }
  return json(summary, 200)
})

// ---------------- meal nudges ----------------

const MEAL_COPY: Record<'breakfast' | 'lunch' | 'dinner', { emoji: string; line: string }> = {
  breakfast: { emoji: '🍳', line: "Good morning, {name}! Don't forget to log your breakfast." },
  lunch:     { emoji: '🥗', line: 'Hey {name}, lunch time. Log it before you forget.' },
  dinner:    { emoji: '🍽️', line: '{name}, time to wrap the day — log dinner so we can track today.' },
}

async function nudgeMissedMeal(
  supabase: SupabaseClient,
  today: string,
  meal: 'breakfast' | 'lunch' | 'dinner',
): Promise<NotifyResult[]> {
  // 1) users who already logged this meal today (so we exclude them)
  const { data: logged } = await supabase
    .from('diet_logs')
    .select('user_id')
    .eq('log_date', today)
    .eq('meal_type', meal)
  const loggedSet = new Set((logged ?? []).map((r) => r.user_id))

  // 2) all users who opted into notifications
  const { data: profiles } = await supabase
    .from('profiles')
    .select(PROFILE_COLS)
    .neq('notification_channel', 'none')

  const targets = (profiles ?? []).filter((p) => !loggedSet.has(p.id))
  const copy = MEAL_COPY[meal]
  return Promise.all(
    targets.map((p) =>
      sendNotification(
        p as NotifyProfile,
        `${copy.emoji} ${copy.line.replace('{name}', p.display_name ?? 'there')}`,
      ),
    ),
  )
}

// ---------------- water ----------------

async function nudgeWater(supabase: SupabaseClient, today: string): Promise<NotifyResult[]> {
  const { data: profiles } = await supabase
    .from('profiles')
    .select(PROFILE_COLS)
    .neq('notification_channel', 'none')

  if (!profiles?.length) return []

  const userIds = profiles.map((p) => p.id)
  const { data: hydration } = await supabase
    .from('hydration_logs')
    .select('user_id, glasses')
    .eq('log_date', today)
    .in('user_id', userIds)

  const glassesByUser = new Map<string, number>(
    (hydration ?? []).map((h) => [h.user_id, h.glasses]),
  )

  const targets = profiles.filter((p) => {
    const goal = p.daily_water_goal ?? 8
    const had = glassesByUser.get(p.id) ?? 0
    return had < goal * 0.5
  })

  return Promise.all(
    targets.map((p) => {
      const goal = p.daily_water_goal ?? 8
      const had = glassesByUser.get(p.id) ?? 0
      const remaining = Math.max(0, goal - had)
      return sendNotification(
        p as NotifyProfile,
        `💧 ${p.display_name ?? 'Hey'}, only ${had}/${goal} glasses today. ${remaining} more to hit goal — top up now.`,
      )
    }),
  )
}

// ---------------- workout ----------------

async function nudgeWorkout(supabase: SupabaseClient, today: string): Promise<NotifyResult[]> {
  // who has an active workout-frequency goal AND opted into notifications
  const { data: profiles } = await supabase
    .from('profiles')
    .select(PROFILE_COLS)
    .neq('notification_channel', 'none')
  if (!profiles?.length) return []

  const userIds = profiles.map((p) => p.id)
  const { data: goals } = await supabase
    .from('goals')
    .select('user_id, target_value')
    .in('user_id', userIds)
    .eq('goal_type', 'workout_frequency')
    .eq('status', 'active')

  const goalUsers = new Set((goals ?? []).map((g) => g.user_id))

  // who already logged a workout today
  const { data: workouts } = await supabase
    .from('workouts')
    .select('user_id')
    .eq('log_date', today)
    .in('user_id', userIds)
  const trainedToday = new Set((workouts ?? []).map((w) => w.user_id))

  const targets = profiles.filter((p) => goalUsers.has(p.id) && !trainedToday.has(p.id))
  return Promise.all(
    targets.map((p) =>
      sendNotification(
        p as NotifyProfile,
        `💪 ${p.display_name ?? 'Hey'}, you haven't trained today. 30 minutes is enough — open the app and log it when you're done.`,
      ),
    ),
  )
}

// ---------------- weekly goal digest ----------------

async function nudgeGoals(supabase: SupabaseClient): Promise<NotifyResult[]> {
  const { data: profiles } = await supabase
    .from('profiles')
    .select(PROFILE_COLS)
    .neq('notification_channel', 'none')
  if (!profiles?.length) return []

  const userIds = profiles.map((p) => p.id)

  // active goals for these users
  const { data: goals } = await supabase
    .from('goals')
    .select('user_id, title, target_value, target_unit, target_date, start_value')
    .in('user_id', userIds)
    .eq('status', 'active')

  const goalsByUser = new Map<string, typeof goals>()
  for (const g of goals ?? []) {
    if (!goalsByUser.has(g.user_id)) goalsByUser.set(g.user_id, [])
    goalsByUser.get(g.user_id)!.push(g)
  }

  // latest BMI per user for weight progress
  const { data: bmis } = await supabase
    .from('bmi_logs')
    .select('user_id, weight_kg, log_date')
    .in('user_id', userIds)
    .order('log_date', { ascending: false })
  const latestWeight = new Map<string, number>()
  for (const b of bmis ?? []) {
    if (!latestWeight.has(b.user_id)) latestWeight.set(b.user_id, Number(b.weight_kg))
  }

  const targets = profiles.filter((p) => goalsByUser.get(p.id)?.length)
  return Promise.all(
    targets.map((p) => {
      const userGoals = goalsByUser.get(p.id) ?? []
      const lines = userGoals.slice(0, 5).map((g) => formatGoalLine(g, latestWeight.get(p.id)))
      const msg = `📊 ${p.display_name ?? 'Hey'}, weekly goal check-in:\n\n${lines.join('\n')}`
      return sendNotification(p as NotifyProfile, msg)
    }),
  )
}

function formatGoalLine(
  g: { title: string; target_value: number | null; target_unit: string | null; target_date: string | null; start_value: number | null },
  currentWeight?: number,
): string {
  const target = g.target_value ?? '?'
  const unit = g.target_unit ?? ''
  const dueLine = g.target_date ? ` (by ${g.target_date})` : ''

  let progress = ''
  if (currentWeight != null && g.start_value != null && g.target_value != null) {
    const total = g.start_value - g.target_value
    const done = g.start_value - currentWeight
    const pct = total !== 0 ? Math.round((done / total) * 100) : 0
    progress = `  → ${currentWeight}${unit} now, ${Math.max(0, Math.min(100, pct))}% there.`
  }

  return `• ${g.title}: ${target}${unit}${dueLine}${progress}`
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
