import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { UserProfile, DietLog, HydrationLog, Workout, UserRole } from '../types'
import { format, subDays, parseISO } from 'date-fns'
import {
  Shield,
  Users,
  UtensilsCrossed,
  Droplets,
  Dumbbell,
  Camera,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import Comments from '../components/Comments'

interface UserActivity {
  diet: DietLog[]
  workouts: Workout[]
  hydration: HydrationLog[]
}

export default function Admin() {
  const { isAdmin, isSuperAdmin } = useAuth()
  const [users, setUsers] = useState<UserProfile[]>([])
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [activityByUser, setActivityByUser] = useState<Record<string, UserActivity>>({})
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ totalUsers: 0, totalLogs: 0, activeToday: 0 })

  useEffect(() => {
    if (!isAdmin) return
    const load = async () => {
      try {
        const today = format(new Date(), 'yyyy-MM-dd')
        const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd')

        const [profilesRes, dietRes] = await Promise.all([
          supabase.from('profiles').select('*').order('created_at', { ascending: true }),
          supabase
            .from('diet_logs')
            .select('id,user_id,log_date')
            .gte('log_date', weekAgo),
        ])

        const usersData = (profilesRes.data || []) as UserProfile[]
        const dietData = (dietRes.data || []) as Pick<DietLog, 'id' | 'user_id' | 'log_date'>[]

        setUsers(usersData)
        const activeUserIds = new Set(dietData.filter((l) => l.log_date === today).map((l) => l.user_id))
        setStats({
          totalUsers: usersData.length,
          totalLogs: dietData.length,
          activeToday: activeUserIds.size,
        })
      } catch (err) {
        console.error('Error fetching admin data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [isAdmin])

  const toggleUser = async (uid: string) => {
    if (expandedUser === uid) {
      setExpandedUser(null)
      return
    }
    setExpandedUser(uid)

    if (!activityByUser[uid]) {
      const [diet, workouts, hydration] = await Promise.all([
        supabase
          .from('diet_logs')
          .select('*')
          .eq('user_id', uid)
          .order('log_date', { ascending: false })
          .limit(10),
        supabase
          .from('workouts')
          .select('*')
          .eq('user_id', uid)
          .order('log_date', { ascending: false })
          .limit(10),
        supabase
          .from('hydration_logs')
          .select('*')
          .eq('user_id', uid)
          .order('log_date', { ascending: false })
          .limit(7),
      ])

      setActivityByUser((prev) => ({
        ...prev,
        [uid]: {
          diet: (diet.data ?? []) as DietLog[],
          workouts: (workouts.data ?? []) as Workout[],
          hydration: (hydration.data ?? []) as HydrationLog[],
        },
      }))
    }
  }

  const toggleAdmin = async (uid: string, currentRole: UserRole) => {
    const newRole: UserRole =
      currentRole === 'admin' || currentRole === 'super_admin' ? 'user' : 'admin'
    if (!confirm(`Change role to ${newRole}?`)) return
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', uid)
    if (error) {
      console.error(error)
      return
    }
    setUsers((prev) => prev.map((u) => (u.id === uid ? { ...u, role: newRole } : u)))
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-16">
        <Shield className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-white font-medium">Access Denied</p>
        <p className="text-gray-400 text-sm mt-1">Admin privileges required</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Shield className="w-6 h-6 text-emerald-400" />
        Admin Dashboard
      </h1>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={<Users className="w-6 h-6 text-blue-400 mx-auto mb-2" />} value={stats.totalUsers} label="Total Users" />
        <StatCard icon={<UtensilsCrossed className="w-6 h-6 text-emerald-400 mx-auto mb-2" />} value={stats.totalLogs} label="Logs (7d)" />
        <StatCard icon={<Droplets className="w-6 h-6 text-amber-400 mx-auto mb-2" />} value={stats.activeToday} label="Active Today" />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Members ({users.length})
          </h2>
          <p className="text-xs text-gray-500 mt-1">Tap a user to see their food, workouts, and hydration. Add coach notes inline — they'll see them on their own log pages.</p>
        </div>
        <div className="divide-y divide-gray-800">
          {users.map((user) => (
            <div key={user.id}>
              <div
                onClick={() => toggleUser(user.id)}
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-800/50 transition"
              >
                <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
                  {user.photo_url ? (
                    <img src={user.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    user.display_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium truncate">{user.display_name}</p>
                    {user.role !== 'user' && (
                      <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full capitalize">
                        {user.role.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs truncate">{user.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {isSuperAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleAdmin(user.id, user.role)
                      }}
                      className="text-xs px-3 py-1.5 bg-gray-800 text-gray-400 rounded-lg hover:bg-gray-700 transition"
                    >
                      {user.role === 'admin' || user.role === 'super_admin' ? 'Demote' : 'Make Admin'}
                    </button>
                  )}
                  {expandedUser === user.id ? (
                    <ChevronUp className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  )}
                </div>
              </div>

              {expandedUser === user.id && (
                <div className="px-4 pb-4 bg-gray-800/20 space-y-5">
                  <UserSection
                    title="Workouts"
                    icon={<Dumbbell className="w-4 h-4 text-emerald-400" />}
                    empty="No workouts logged"
                    items={activityByUser[user.id]?.workouts ?? []}
                    renderItem={(w) => (
                      <>
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-emerald-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Dumbbell className="w-5 h-5 text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{w.name}</p>
                            <p className="text-gray-500 text-xs mt-0.5">
                              {format(parseISO(w.log_date), 'EEE, MMM d')}
                              {w.duration_minutes != null && ` · ${w.duration_minutes} min`}
                              {w.calories_burned != null && ` · ${w.calories_burned} kcal`}
                            </p>
                          </div>
                        </div>
                        <Comments target={{ type: 'workout', id: w.id }} />
                      </>
                    )}
                  />

                  <UserSection
                    title="Meals"
                    icon={<UtensilsCrossed className="w-4 h-4 text-amber-400" />}
                    empty="No meals logged"
                    items={activityByUser[user.id]?.diet ?? []}
                    renderItem={(d) => (
                      <>
                        <div className="flex items-start gap-3">
                          {d.photo_url ? (
                            <img src={d.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                          ) : (
                            <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
                              <Camera className="w-4 h-4 text-gray-500" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{d.description}</p>
                            <p className="text-gray-500 text-xs mt-0.5 capitalize">
                              {d.meal_type} · {d.log_date} · {d.calories} kcal
                            </p>
                          </div>
                        </div>
                        <Comments target={{ type: 'diet', id: d.id }} />
                      </>
                    )}
                  />

                  <UserSection
                    title="Hydration"
                    icon={<Droplets className="w-4 h-4 text-blue-400" />}
                    empty="No hydration logged"
                    items={activityByUser[user.id]?.hydration ?? []}
                    renderItem={(h) => (
                      <>
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-blue-500/15 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Droplets className="w-5 h-5 text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium">
                              {h.glasses} / {h.goal} glasses
                            </p>
                            <p className="text-gray-500 text-xs mt-0.5">{format(parseISO(h.log_date), 'EEE, MMM d')}</p>
                          </div>
                        </div>
                        <Comments target={{ type: 'hydration', id: h.id }} />
                      </>
                    )}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 text-center">
      {icon}
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  )
}

function UserSection<T extends { id: string }>({
  title,
  icon,
  empty,
  items,
  renderItem,
}: {
  title: string
  icon: React.ReactNode
  empty: string
  items: T[]
  renderItem: (item: T) => React.ReactNode
}) {
  return (
    <div>
      <h4 className="text-xs uppercase tracking-wider text-gray-500 flex items-center gap-1.5 mb-2">
        {icon}
        {title}
      </h4>
      {items.length === 0 ? (
        <p className="text-gray-600 text-xs italic">{empty}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="bg-gray-900 rounded-xl p-3">
              {renderItem(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
