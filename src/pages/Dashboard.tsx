import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cacheGet, cacheSet, cacheStale } from '../lib/cache'
import type { DietLog, HydrationLog } from '../types'
import { format } from 'date-fns'
import { Plus, Droplets, UtensilsCrossed, Trophy, TrendingUp, Camera, Dumbbell } from 'lucide-react'
import BodyDiagram from '../components/BodyDiagram'

export default function Dashboard() {
  const { currentUser, userProfile } = useAuth()
  const [todayDietLogs, setTodayDietLogs] = useState<DietLog[]>([])
  const [todayHydration, setTodayHydration] = useState<HydrationLog | null>(null)
  const [recentLogs, setRecentLogs] = useState<DietLog[]>([])
  const [loading, setLoading] = useState(true)

  const today = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    if (!currentUser) return
    const key = `dashboard:${currentUser.id}:${today}`
    type Snapshot = {
      todayDiet: DietLog[]
      todayHydration: HydrationLog | null
      recent: DietLog[]
    }

    const stale = cacheStale<Snapshot>(key)
    if (stale) {
      setTodayDietLogs(stale.todayDiet)
      setTodayHydration(stale.todayHydration)
      setRecentLogs(stale.recent)
      setLoading(false)
    }
    if (cacheGet<Snapshot>(key, 30_000)) return

    const fetchData = async () => {
      try {
        const [dietToday, hydrationToday, dietRecent] = await Promise.all([
          supabase.from('diet_logs').select('*').eq('user_id', currentUser.id).eq('log_date', today),
          supabase.from('hydration_logs').select('*').eq('user_id', currentUser.id).eq('log_date', today).maybeSingle(),
          supabase.from('diet_logs').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(5),
        ])

        const snap: Snapshot = {
          todayDiet: (dietToday.data ?? []) as DietLog[],
          todayHydration: (hydrationToday.data ?? null) as HydrationLog | null,
          recent: (dietRecent.data ?? []) as DietLog[],
        }
        setTodayDietLogs(snap.todayDiet)
        setTodayHydration(snap.todayHydration)
        setRecentLogs(snap.recent)
        cacheSet(key, snap)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [currentUser, today])

  const totalCalories = todayDietLogs.reduce((sum, log) => sum + log.calories, 0)
  const totalProtein = todayDietLogs.reduce((sum, log) => sum + Number(log.protein), 0)
  const totalCarbs = todayDietLogs.reduce((sum, log) => sum + Number(log.carbs), 0)
  const totalFats = todayDietLogs.reduce((sum, log) => sum + Number(log.fats), 0)
  const calorieGoal = userProfile?.daily_calorie_goal || 2000
  const waterGoal = userProfile?.daily_water_goal || 8
  const currentGlasses = todayHydration?.glasses || 0

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Hey, {userProfile?.display_name || 'Champ'}
          </h1>
          <p className="text-gray-400 mt-1">{format(new Date(), 'EEEE, MMM d')}</p>
        </div>
        <Link
          to="/leaderboard"
          className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-400 rounded-xl hover:bg-amber-500/20 transition text-sm font-medium"
        >
          <Trophy className="w-4 h-4" />
          Leaderboard
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Link
          to="/workouts/new"
          className="flex flex-col items-center gap-2 p-4 bg-gray-900 border border-gray-800 rounded-2xl hover:border-emerald-500/50 transition group"
        >
          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center group-hover:bg-emerald-500/20 transition">
            <Dumbbell className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-white font-medium text-xs">Log Workout</p>
        </Link>

        <Link
          to="/diet/new"
          className="flex flex-col items-center gap-2 p-4 bg-gray-900 border border-gray-800 rounded-2xl hover:border-amber-500/50 transition group"
        >
          <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center group-hover:bg-amber-500/20 transition">
            <Plus className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-white font-medium text-xs">Log Meal</p>
        </Link>

        <Link
          to="/hydration"
          className="flex flex-col items-center gap-2 p-4 bg-gray-900 border border-gray-800 rounded-2xl hover:border-blue-500/50 transition group"
        >
          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center group-hover:bg-blue-500/20 transition">
            <Droplets className="w-5 h-5 text-blue-400" />
          </div>
          <p className="text-white font-medium text-xs">{currentGlasses}/{waterGoal} water</p>
        </Link>
      </div>

      <BodyDiagram />

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Today's Nutrition
          </h2>
          <span className="text-sm text-gray-400">{todayDietLogs.length} meals logged</span>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-gray-400">Calories</span>
            <span className="text-white font-medium">{totalCalories} / {calorieGoal} kcal</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3">
            <div
              className="h-3 rounded-full transition-all duration-500 bg-emerald-500"
              style={{ width: `${Math.min((totalCalories / calorieGoal) * 100, 100)}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-gray-800/50 rounded-xl">
            <p className="text-xs text-gray-400 mb-1">Protein</p>
            <p className="text-lg font-bold text-emerald-400">{totalProtein}g</p>
          </div>
          <div className="text-center p-3 bg-gray-800/50 rounded-xl">
            <p className="text-xs text-gray-400 mb-1">Carbs</p>
            <p className="text-lg font-bold text-blue-400">{totalCarbs}g</p>
          </div>
          <div className="text-center p-3 bg-gray-800/50 rounded-xl">
            <p className="text-xs text-gray-400 mb-1">Fats</p>
            <p className="text-lg font-bold text-amber-400">{totalFats}g</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Droplets className="w-5 h-5 text-blue-400" />
            Hydration
          </h2>
          <span className="text-xs text-gray-400">
            {currentGlasses >= waterGoal
              ? 'Goal reached'
              : `${waterGoal - currentGlasses} to go`}
          </span>
        </div>
        <div className="grid grid-flow-col auto-cols-fr gap-1.5">
          {Array.from({ length: waterGoal }).map((_, i) => (
            <div
              key={i}
              className={`h-10 rounded-lg transition-all ${
                i < currentGlasses ? 'bg-blue-500' : 'bg-gray-800'
              }`}
            />
          ))}
        </div>
      </div>

      {recentLogs.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 text-emerald-400" />
              Recent Meals
            </h2>
            <Link to="/diet" className="text-emerald-400 text-sm hover:text-emerald-300">
              View All
            </Link>
          </div>
          <div className="space-y-3">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-xl">
                {log.photo_url ? (
                  <img src={log.photo_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                ) : (
                  <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                    <Camera className="w-5 h-5 text-gray-500" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{log.description}</p>
                  <p className="text-gray-500 text-xs capitalize">{log.meal_type} &middot; {log.calories} kcal</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
