// One-off notification sender.
// POST /functions/v1/send-notification  { user_id, message }
//
// Use for ad-hoc nudges (e.g. an admin clicking "remind to drink water"
// from the admin panel). For scheduled daily reminders, see daily-nudges.

// @ts-expect-error — Deno globals provided by Edge runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'
import { sendNotification, type NotifyProfile } from '../_shared/notify.ts'

// @ts-expect-error — Deno provided by Edge runtime
const env = (k: string) => Deno.env.get(k) ?? ''

interface RequestBody {
  user_id: string
  message: string
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  if (!body.user_id || !body.message) return json({ error: 'user_id_and_message_required' }, 400)
  if (body.message.length > 2000) return json({ error: 'message_too_long' }, 400)

  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, display_name, email, instagram_handle, telegram_chat_id, notification_channel')
    .eq('id', body.user_id)
    .maybeSingle()

  if (error || !profile) return json({ error: 'profile_not_found', detail: error?.message }, 404)

  const result = await sendNotification(profile as NotifyProfile, body.message)
  return json(result, result.ok ? 200 : 502)
})

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
