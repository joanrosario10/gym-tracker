// Supabase Edge Function: send-notification
//
// Looks up a user's preferred channel and sends them a message.
// Deploy:    supabase functions deploy send-notification
// Invoke:    POST /functions/v1/send-notification  { user_id, message }
// Cron:      Use pg_cron + supabase.functions.http_request() to schedule.
//
// Required Vault secrets (set with `supabase secrets set NAME=value`):
//   SUPABASE_URL                — auto-populated in edge runtime
//   SUPABASE_SERVICE_ROLE_KEY   — auto-populated in edge runtime
//   TELEGRAM_BOT_TOKEN          — from BotFather (only if you support Telegram)
//   META_PAGE_ACCESS_TOKEN      — from Meta Business (only if you support Instagram)
//   META_IG_USER_ID             — your IG business account id (only if Instagram)
//   RESEND_API_KEY              — only if you support Email through Resend

// @ts-expect-error — Deno globals are provided by Edge runtime
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

interface RequestBody {
  user_id: string
  message: string
}

// @ts-expect-error — Deno is provided by Edge runtime
const env = (k: string) => Deno.env.get(k) ?? ''

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  if (!body.user_id || !body.message) {
    return json({ error: 'user_id_and_message_required' }, 400)
  }
  if (body.message.length > 2000) {
    return json({ error: 'message_too_long' }, 400)
  }

  const supabase = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('display_name, email, instagram_handle, telegram_chat_id, notification_channel')
    .eq('id', body.user_id)
    .maybeSingle()

  if (error || !profile) {
    return json({ error: 'profile_not_found', detail: error?.message }, 404)
  }

  switch (profile.notification_channel) {
    case 'telegram':
      return await sendTelegram(profile.telegram_chat_id, body.message)
    case 'instagram':
      return await sendInstagram(profile.instagram_handle, body.message)
    case 'email':
      return await sendEmail(profile.email, body.message, profile.display_name)
    case 'none':
    default:
      return json({ skipped: true, reason: 'channel_disabled' }, 200)
  }
})

// ----------------- Channels -----------------

async function sendTelegram(chatId: string | null, message: string): Promise<Response> {
  if (!chatId) return json({ error: 'no_telegram_chat_id' }, 400)
  const token = env('TELEGRAM_BOT_TOKEN')
  if (!token) return json({ error: 'telegram_not_configured' }, 500)

  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
  })
  if (!r.ok) {
    const detail = await r.text()
    return json({ error: 'telegram_send_failed', status: r.status, detail }, 502)
  }
  return json({ delivered: 'telegram' }, 200)
}

async function sendInstagram(handle: string | null, message: string): Promise<Response> {
  if (!handle) return json({ error: 'no_instagram_handle' }, 400)

  const igUserId = env('META_IG_USER_ID')
  const token = env('META_PAGE_ACCESS_TOKEN')
  if (!igUserId || !token) return json({ error: 'instagram_not_configured' }, 500)

  // Instagram Graph API: POST /<IG_USER_ID>/messages
  // Recipient must have messaged your business account first; you store
  // their IG-scoped id from the webhook. Looking up by handle alone is
  // NOT supported — that lookup is the part Meta does not expose.
  //
  // For now, we treat the stored "handle" as the IG-scoped id you got
  // from the messages webhook. Update your collection flow to grab that
  // id rather than the @handle for this to work in production.
  const recipientId = handle

  const r = await fetch(
    `https://graph.instagram.com/v21.0/${igUserId}/messages?access_token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message },
      }),
    },
  )
  if (!r.ok) {
    const detail = await r.text()
    return json({ error: 'instagram_send_failed', status: r.status, detail }, 502)
  }
  return json({ delivered: 'instagram' }, 200)
}

async function sendEmail(toEmail: string, message: string, name: string | null): Promise<Response> {
  const apiKey = env('RESEND_API_KEY')
  if (!apiKey) return json({ error: 'email_not_configured' }, 500)

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: 'GymTracker <noreply@yourdomain.com>',
      to: [toEmail],
      subject: 'Your daily check-in',
      text: `Hey ${name ?? 'there'},\n\n${message}\n\n— GymTracker`,
    }),
  })
  if (!r.ok) {
    const detail = await r.text()
    return json({ error: 'email_send_failed', status: r.status, detail }, 502)
  }
  return json({ delivered: 'email' }, 200)
}

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
