export const config = { runtime: 'edge' }

const SYSTEM = `You are a personal-trainer assistant for a gym tracker app.

Given a short goal description ("chest day", "30-min cardio", "leg-focused full body"), return ONLY valid JSON in this exact shape:
{
  "name": "<short workout name, max 40 chars>",
  "exercises": [
    {
      "name": "<exercise name from the allowed list, exactly>",
      "sets": <int 1-6>,
      "reps": <int 1-30, or null for time-based>,
      "weight_kg": <number 0-300, 0 for bodyweight>,
      "duration_seconds": <int seconds, or null if reps-based>
    }
  ]
}

Choose exercises ONLY from this allowed list (case-sensitive, exact spelling):
"Bench Press","Incline Dumbbell Press","Push-up","Pull-up","Barbell Row","Deadlift","Squat","Lunges","Romanian Deadlift","Hip Thrust","Calf Raise","Overhead Press","Lateral Raise","Bicep Curl","Tricep Pushdown","Plank","Russian Twist","Treadmill Run","Cycling","Rowing Machine","Jump Rope","Yoga Flow"

Pick 3-6 exercises that fit the goal. For time-based exercises (Plank, Treadmill Run, Cycling, Rowing Machine, Jump Rope, Yoga Flow), set reps=null and provide duration_seconds. For all others, set duration_seconds=null and provide sets+reps. Output JSON only, no prose.`

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
  if (goal.length > 200) return json({ error: 'goal_too_long' }, 400)

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
      temperature: 0.4,
      top_p: 0.9,
      max_tokens: 600,
      stream: false,
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
