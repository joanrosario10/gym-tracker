import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../hooks/useNotifications'
import {
  User,
  Bell,
  Save,
  LogOut,
  Target,
  Activity,
  Trophy,
  Shield,
  ChevronRight,
  Camera,
  Send,
  Mail,
  BellOff,
} from 'lucide-react'
import type { NotificationChannel } from '../types'

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}

export default function Profile() {
  const { currentUser, userProfile, signOut, refreshProfile, isAdmin } = useAuth()
  const { permission, requestPermission } = useNotifications()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (err) {
      console.error('Sign out failed', err)
      setSigningOut(false)
    }
  }

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !currentUser) return
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Image must be under 5 MB')
      return
    }

    setAvatarError('')
    setAvatarUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${currentUser.id}/avatar.${ext}`
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { contentType: file.type, upsert: true })
      if (uploadErr) throw uploadErr

      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = `${data.publicUrl}?t=${Date.now()}`

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ photo_url: url })
        .eq('id', currentUser.id)
      if (updateErr) throw updateErr

      await refreshProfile()
    } catch (err) {
      console.error(err)
      setAvatarError('Upload failed. Try a smaller image.')
    } finally {
      setAvatarUploading(false)
    }
  }

  const [displayName, setDisplayName] = useState(userProfile?.display_name || '')
  const [calorieGoal, setCalorieGoal] = useState(String(userProfile?.daily_calorie_goal || 2000))
  const [waterGoal, setWaterGoal] = useState(String(userProfile?.daily_water_goal || 8))
  const [instagramHandle, setInstagramHandle] = useState(userProfile?.instagram_handle ?? '')
  const [telegramChatId, setTelegramChatId] = useState(userProfile?.telegram_chat_id ?? '')
  const [notificationChannel, setNotificationChannel] = useState(userProfile?.notification_channel ?? 'none')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    setLoading(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          daily_calorie_goal: Number(calorieGoal) || 2000,
          daily_water_goal: Number(waterGoal) || 8,
          instagram_handle: instagramHandle.trim().replace(/^@/, '') || null,
          telegram_chat_id: telegramChatId.trim() || null,
          notification_channel: notificationChannel,
        })
        .eq('id', currentUser.id)
      if (error) throw error

      await supabase.auth.updateUser({ data: { display_name: displayName } })
      await refreshProfile()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (error) {
      console.error('Error updating profile:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <User className="w-6 h-6 text-emerald-400" />
        Profile & Settings
      </h1>

      <div className="flex flex-col items-center gap-3 py-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={avatarUploading}
          className="relative group focus:outline-none"
          aria-label="Change profile photo"
        >
          <div className="w-28 h-28 rounded-full overflow-hidden bg-gray-800 ring-2 ring-emerald-500/30 ring-offset-4 ring-offset-gray-950 flex items-center justify-center">
            {userProfile?.photo_url ? (
              <img
                src={userProfile.photo_url}
                alt={userProfile.display_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-3xl font-bold text-gray-300">
                {userProfile?.display_name?.charAt(0).toUpperCase() ?? '?'}
              </span>
            )}
          </div>
          <div className="absolute inset-0 rounded-full bg-black/55 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
            {avatarUploading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Camera className="w-7 h-7 text-white" />
            )}
          </div>
          <div className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-emerald-500 border-4 border-gray-950 flex items-center justify-center">
            <Camera className="w-3.5 h-3.5 text-white" />
          </div>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
        />
        <div className="text-center">
          <p className="text-white font-semibold">{userProfile?.display_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {avatarUploading ? 'Uploading…' : 'Tap to change photo'}
          </p>
          {avatarError && <p className="text-xs text-red-400 mt-1">{avatarError}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <HubLink to="/bmi"         icon={Activity} label="BMI Tracker"  accent="emerald" />
        <HubLink to="/leaderboard" icon={Trophy}   label="Leaderboard"  accent="amber" />
        {isAdmin && (
          <HubLink to="/admin"     icon={Shield}   label="Admin Panel"  accent="blue" wide />
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Personal Info</h2>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Email</label>
            <input
              type="email"
              value={currentUser?.email || ''}
              disabled
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-xl text-gray-500 cursor-not-allowed"
            />
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-400" />
            Daily Goals
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Calorie Goal (kcal)</label>
            <input
              type="number"
              value={calorieGoal}
              onChange={(e) => setCalorieGoal(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              min="500"
              max="10000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Water Goal (glasses)</label>
            <input
              type="number"
              value={waterGoal}
              onChange={(e) => setWaterGoal(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              min="1"
              max="20"
            />
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-emerald-400" />
            Reminders
          </h2>
          <p className="text-xs text-gray-500 -mt-1">
            Where should we send your daily nudges? Pick one and fill in the matching handle.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <ChannelOption
              channel="none"
              active={notificationChannel}
              onPick={setNotificationChannel}
              icon={<BellOff className="w-4 h-4" />}
              label="Off"
            />
            <ChannelOption
              channel="email"
              active={notificationChannel}
              onPick={setNotificationChannel}
              icon={<Mail className="w-4 h-4" />}
              label="Email"
            />
            <ChannelOption
              channel="telegram"
              active={notificationChannel}
              onPick={setNotificationChannel}
              icon={<Send className="w-4 h-4" />}
              label="Telegram"
            />
            <ChannelOption
              channel="instagram"
              active={notificationChannel}
              onPick={setNotificationChannel}
              icon={<InstagramIcon className="w-4 h-4" />}
              label="Instagram"
            />
          </div>

          {notificationChannel === 'instagram' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Instagram handle</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
                <input
                  type="text"
                  value={instagramHandle}
                  onChange={(e) => setInstagramHandle(e.target.value)}
                  className="w-full pl-8 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="your.handle"
                />
              </div>
              <p className="text-[11px] text-amber-400/80 mt-1.5">
                Heads up: Instagram only allows DMs after you message our bot first. Open the bot from the link the admin shares once setup is live.
              </p>
            </div>
          )}

          {notificationChannel === 'telegram' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Telegram chat ID</label>
              <input
                type="text"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="123456789"
              />
              <p className="text-[11px] text-gray-500 mt-1.5">
                Open <code className="text-gray-400">t.me/userinfobot</code>, type <code className="text-gray-400">/start</code>, copy the numeric ID it replies with.
              </p>
            </div>
          )}

          {notificationChannel === 'email' && (
            <p className="text-xs text-gray-500">
              We'll send to <span className="text-gray-300 font-medium">{currentUser?.email}</span>.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saved ? (
            'Saved!'
          ) : loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
      </form>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-3">
          <Bell className="w-5 h-5 text-amber-400" />
          Browser permissions
        </h2>
        <p className="text-gray-400 text-sm mb-4">
          Grants this site permission to show desktop notifications. Reminder delivery is not yet wired up — coming soon.
        </p>
        {permission === 'granted' ? (
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <div className="w-2 h-2 bg-emerald-400 rounded-full" />
            Permission granted
          </div>
        ) : permission === 'denied' ? (
          <p className="text-red-400 text-sm">
            Permission blocked in browser settings.
          </p>
        ) : (
          <button
            onClick={requestPermission}
            className="px-4 py-2.5 bg-amber-500/10 text-amber-400 rounded-xl hover:bg-amber-500/20 transition text-sm font-medium"
          >
            Allow notifications
          </button>
        )}
      </div>

      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="w-full py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {signingOut ? (
          <>
            <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
            Signing out…
          </>
        ) : (
          <>
            <LogOut className="w-4 h-4" />
            Sign Out
          </>
        )}
      </button>
    </div>
  )
}

function ChannelOption({
  channel,
  active,
  onPick,
  icon,
  label,
}: {
  channel: NotificationChannel
  active: NotificationChannel
  onPick: (c: NotificationChannel) => void
  icon: React.ReactNode
  label: string
}) {
  const isActive = active === channel
  return (
    <button
      type="button"
      onClick={() => onPick(channel)}
      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition border ${
        isActive
          ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
          : 'bg-gray-800/40 border-gray-700/60 text-gray-400 hover:bg-gray-800'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

const ACCENT = {
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'hover:border-emerald-500/40' },
  amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'hover:border-amber-500/40' },
  blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'hover:border-blue-500/40' },
} as const

function HubLink({
  to,
  icon: Icon,
  label,
  accent,
  wide,
}: {
  to: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  accent: keyof typeof ACCENT
  wide?: boolean
}) {
  const a = ACCENT[accent]
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 p-4 bg-gray-900 border border-gray-800 rounded-2xl transition ${a.border} ${wide ? 'col-span-2' : ''}`}
    >
      <div className={`w-10 h-10 ${a.bg} rounded-xl flex items-center justify-center`}>
        <Icon className={`w-5 h-5 ${a.text}`} />
      </div>
      <span className="text-white font-medium text-sm flex-1">{label}</span>
      <ChevronRight className="w-4 h-4 text-gray-600" />
    </Link>
  )
}
