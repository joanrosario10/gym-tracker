// Shared notification sender — picks channel based on the user's profile
// and dispatches via Telegram, Email (Resend), or Instagram.
//
// Used by both `send-notification` (one-off sends) and `daily-nudges`
// (cron-driven reminder digest). Keep all channel-specific glue here.

// @ts-expect-error — Deno globals provided by Supabase Edge runtime
const env = (k: string) => Deno.env.get(k) ?? ''

export type NotificationChannel = 'email' | 'telegram' | 'instagram' | 'none'

export interface NotifyProfile {
  id: string
  display_name: string | null
  email: string | null
  instagram_handle: string | null
  telegram_chat_id: string | null
  notification_channel: NotificationChannel
}

export interface NotifyResult {
  user_id: string
  channel: NotificationChannel
  ok: boolean
  detail?: string
}

export async function sendNotification(
  profile: NotifyProfile,
  message: string,
): Promise<NotifyResult> {
  switch (profile.notification_channel) {
    case 'telegram':
      return sendTelegram(profile, message)
    case 'instagram':
      return sendInstagram(profile, message)
    case 'email':
      return sendEmail(profile, message)
    default:
      return { user_id: profile.id, channel: 'none', ok: true, detail: 'channel_disabled' }
  }
}

async function sendTelegram(profile: NotifyProfile, message: string): Promise<NotifyResult> {
  const token = env('TELEGRAM_BOT_TOKEN')
  if (!token) return { user_id: profile.id, channel: 'telegram', ok: false, detail: 'telegram_not_configured' }
  if (!profile.telegram_chat_id) return { user_id: profile.id, channel: 'telegram', ok: false, detail: 'no_chat_id' }

  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: profile.telegram_chat_id, text: message, parse_mode: 'HTML' }),
  })
  if (!r.ok) {
    return { user_id: profile.id, channel: 'telegram', ok: false, detail: `${r.status} ${await r.text()}` }
  }
  return { user_id: profile.id, channel: 'telegram', ok: true }
}

async function sendInstagram(profile: NotifyProfile, message: string): Promise<NotifyResult> {
  const igUserId = env('META_IG_USER_ID')
  const token = env('META_PAGE_ACCESS_TOKEN')
  if (!igUserId || !token) return { user_id: profile.id, channel: 'instagram', ok: false, detail: 'instagram_not_configured' }
  if (!profile.instagram_handle) return { user_id: profile.id, channel: 'instagram', ok: false, detail: 'no_handle' }

  // The "handle" should actually be the IG-scoped user id captured from
  // the Messenger webhook — Meta does not expose handle→id lookup.
  const r = await fetch(
    `https://graph.instagram.com/v21.0/${igUserId}/messages?access_token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: profile.instagram_handle },
        message: { text: message },
      }),
    },
  )
  if (!r.ok) {
    return { user_id: profile.id, channel: 'instagram', ok: false, detail: `${r.status} ${await r.text()}` }
  }
  return { user_id: profile.id, channel: 'instagram', ok: true }
}

async function sendEmail(profile: NotifyProfile, message: string): Promise<NotifyResult> {
  const apiKey = env('RESEND_API_KEY')
  const fromAddr = env('REMINDER_FROM_EMAIL') || 'GymTracker <noreply@yourdomain.com>'
  if (!apiKey) return { user_id: profile.id, channel: 'email', ok: false, detail: 'email_not_configured' }
  if (!profile.email) return { user_id: profile.id, channel: 'email', ok: false, detail: 'no_email' }

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: fromAddr,
      to: [profile.email],
      subject: 'GymTracker reminder',
      text: `Hi ${profile.display_name ?? 'there'},\n\n${message}\n\n— GymTracker`,
    }),
  })
  if (!r.ok) {
    return { user_id: profile.id, channel: 'email', ok: false, detail: `${r.status} ${await r.text()}` }
  }
  return { user_id: profile.id, channel: 'email', ok: true }
}
