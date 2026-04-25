export const config = { runtime: 'edge' }

const SYSTEM = `You are a nutrition estimation API. Given a short meal description, return ONLY valid JSON in this exact shape:
{"calories": <integer kcal>, "protein": <grams>, "carbs": <grams>, "fats": <grams>}
Use realistic averages for typical serving sizes. Do not include any prose, markdown, or units — only the JSON object.`

interface NutritionResponse {
  calories: number
  protein: number
  carbs: number
  fats: number
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  let body: { description?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const description = body.description?.trim()
  if (!description || description.length < 2) {
    return json({ error: 'description_required' }, 400)
  }
  if (description.length > 200) {
    return json({ error: 'description_too_long' }, 400)
  }

  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) return json({ error: 'server_not_configured' }, 500)

  const upstream = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      // 70B llama is plenty for nutrition extraction and ~9x faster than the
      // 120B Nemotron we used initially (which over-reasons simple lookups).
      model: 'meta/llama-3.3-70b-instruct',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: description },
      ],
      temperature: 0.2,
      top_p: 0.9,
      max_tokens: 200,
      stream: false,
    }),
  })

  if (!upstream.ok) {
    return json({ error: 'upstream_failed', status: upstream.status }, 502)
  }

  const data = await upstream.json()
  const text: string = data?.choices?.[0]?.message?.content ?? ''
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return json({ error: 'unparseable' }, 502)

  try {
    const parsed = JSON.parse(match[0])
    const macros: NutritionResponse = {
      calories: clamp(Number(parsed.calories), 0, 5000),
      protein:  clamp(Number(parsed.protein),  0, 500),
      carbs:    clamp(Number(parsed.carbs),    0, 500),
      fats:     clamp(Number(parsed.fats),     0, 500),
    }
    return json(macros, 200)
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
  if (!Number.isFinite(n)) return 0
  return Math.max(min, Math.min(max, Math.round(n)))
}
