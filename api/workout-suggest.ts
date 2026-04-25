export const config = { runtime: 'edge' }

const SYSTEM = `You are a workout assistant for a gym tracker app.

The user will either (A) describe a goal for a workout they want to do
("chest day", "30 min cardio") and you plan one, OR (B) describe in
detail a workout they already completed with weights/sets/reps and you
extract it into structured form. Either way return ONLY valid JSON in
this shape:

{
  "name": "<short workout name, max 40 chars>",
  "exercises": [
    {
      "name": "<exercise name from the allowed list, EXACT spelling>",
      "sets": <int 1-10>,
      "reps": <int 1-50, or null for time-based>,
      "weight_kg": <number 0-300, 0 for bodyweight>,
      "duration_seconds": <int seconds, or null if reps-based>
    }
  ]
}

Allowed exercise names (case-sensitive):
"Bench Press","Incline Dumbbell Press","Push-up","Pull-up","Barbell Row","Deadlift","Squat","Lunges","Romanian Deadlift","Hip Thrust","Calf Raise","Overhead Press","Lateral Raise","Bicep Curl","Tricep Pushdown","Plank","Russian Twist","Treadmill Run","Cycling","Rowing Machine","Jump Rope","Yoga Flow"

Mapping rules for parse mode (B) — map freeform names to the closest allowed entry:
- "military press" / "shoulder press" → "Overhead Press"
- "incline press" / "incline bench" → "Incline Dumbbell Press"
- "decline bench" → "Bench Press"
- "skull crusher" / "tricep extension" → "Tricep Pushdown"
- "fly" / "chest fly" / "cable fly" → keep mapping to "Incline Dumbbell Press" if unsure
- "lateral raise" / "side raise" / "reverse fly" → "Lateral Raise"
- "lat pulldown" / "pulldown" → "Pull-up"
- "leg press" / "front squat" → "Squat"
- Drop any exercise that has no reasonable mapping.

Typo / number tolerance:
- "reputation" / "reps" / "rep" all mean reps.
- Patterns like "312" or "612" usually mean "3x12" or "6x12" — split into sets×reps.
- "kg" / "KG" / "kilos" all mean kilograms.

Mode A planning: pick 3-6 exercises matching the goal, leave weight_kg=0
unless obviously implied. Mode B parse: include every exercise the user
named, with the weights/sets/reps they specified.

Time-based exercises (Plank, Treadmill Run, Cycling, Rowing Machine,
Jump Rope, Yoga Flow): set reps=null, provide duration_seconds. Other
exercises: set duration_seconds=null, provide sets and reps.

Output JSON only, no prose, no markdown fences.`

const ALLOWED = new Set([
  'Bench Press', 'Incline Dumbbell Press', 'Push-up', 'Pull-up', 'Barbell Row',
  'Deadlift', 'Squat', 'Lunges', 'Romanian Deadlift', 'Hip Thrust', 'Calf Raise',
  'Overhead Press', 'Lateral Raise', 'Bicep Curl', 'Tricep Pushdown',
  'Plank', 'Russian Twist',
  'Treadmill Run', 'Cycling', 'Rowing Machine', 'Jump Rope', 'Yoga Flow',
])

interface ExerciseSuggestion {
  name: string
  sets: number | null
  reps: number | null
  weight_kg: number
  duration_seconds: number | null
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let body: { goal?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const goal = body.goal?.trim()
  if (!goal || goal.length < 2) return json({ error: 'goal_required' }, 400)
  if (goal.length > 2000) return json({ error: 'goal_too_long' }, 400)

  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) return json({ error: 'server_not_configured' }, 500)

  const upstream = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'nvidia/nemotron-3-super-120b-a12b',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: goal },
      ],
      temperature: 0.3,
      top_p: 0.9,
      max_tokens: 1500,
      stream: false,
      // Nemotron has reasoning enabled by default which eats the token budget
      // before any JSON gets emitted. We just want a structured response.
      chat_template_kwargs: { enable_thinking: false },
    }),
  })

  if (!upstream.ok) return json({ error: 'upstream_failed', status: upstream.status }, 502)

  const data = await upstream.json()
  const text: string = data?.choices?.[0]?.message?.content ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return json({ error: 'unparseable' }, 502)

  try {
    const parsed = JSON.parse(match[0])
    const name: string = String(parsed.name ?? 'Suggested Workout').slice(0, 60)
    const rawExercises = Array.isArray(parsed.exercises) ? parsed.exercises : []

    const exercises: ExerciseSuggestion[] = rawExercises
      .filter((e: unknown): e is { name: string } =>
        typeof e === 'object' && e !== null && typeof (e as { name?: unknown }).name === 'string',
      )
      .map((e) => ({
        name: e.name,
        sets: clampOpt((e as { sets?: unknown }).sets, 1, 10),
        reps: clampOpt((e as { reps?: unknown }).reps, 1, 50),
        weight_kg: clamp(Number((e as { weight_kg?: unknown }).weight_kg), 0, 300) || 0,
        duration_seconds: clampOpt((e as { duration_seconds?: unknown }).duration_seconds, 1, 7200),
      }))
      .filter((e: ExerciseSuggestion) => ALLOWED.has(e.name))
      .slice(0, 8)

    if (exercises.length === 0) return json({ error: 'no_valid_exercises' }, 502)

    return json({ name, exercises }, 200)
  } catch {
    return json({ error: 'unparseable' }, 502)
  }
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, Math.round(n)))
}

function clampOpt(v: unknown, min: number, max: number): number | null {
  if (v == null) return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.max(min, Math.min(max, Math.round(n)))
}
