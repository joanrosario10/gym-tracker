import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { HydrationLog } from '../types'
import { format, subDays } from 'date-fns'
import { Droplets, Plus, Minus, TrendingUp } from 'lucide-react'

export default function Hydration() {
  const { currentUser, userProfile } = useAuth()
  const [todayLog, setTodayLog] = useState<HydrationLog | null>(null)
  const [weekLogs, setWeekLogs] = useState<HydrationLog[]>([])
  const [loading, setLoading] = useState(true)

  const today = format(new Date(), 'yyyy-MM-dd')
  const waterGoal = userProfile?.daily_water_goal || 8

  useEffect(() => {
    if (!currentUser) return
    const fetchData = async () => {
      try {
        const weekAgo = format(subDays(new Date(), 6), 'yyyy-MM-dd')
        const [todayRes, weekRes] = await Promise.all([
          supabase
            .from('hydration_logs')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('log_date', today)
            .maybeSingle(),
          supabase
            .from('hydration_logs')
            .select('*')
            .eq('user_id', currentUser.id)
            .gte('log_date', weekAgo)
            .lte('log_date', today),
        ])

        if (todayRes.data) setTodayLog(todayRes.data as HydrationLog)
        if (weekRes.data) setWeekLogs(weekRes.data as HydrationLog[])
      } catch (error) {
        console.error('Error fetching hydration:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [currentUser, today])

  const updateGlasses = async (delta: number) => {
    if (!currentUser) return
    const newGlasses = Math.max(0, (todayLog?.glasses || 0) + delta)

    try {
      const { data, error } = await supabase
        .from('hydration_logs')
        .upsert(
          {
            user_id: currentUser.id,
            log_date: today,
            glasses: newGlasses,
            goal: waterGoal,
          },
          { onConflict: 'user_id,log_date' }
        )
        .select()
        .single()
      if (error) throw error
      setTodayLog(data as HydrationLog)
    } catch (error) {
      console.error('Error updating hydration:', error)
    }
  }

  const currentGlasses = todayLog?.glasses || 0
  const percentage = Math.min((currentGlasses / waterGoal) * 100, 100)

  const getWeekData = () => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const log = weekLogs.find((l) => l.log_date === dateStr)
      return {
        day: format(date, 'EEE'),
        glasses: log?.glasses || 0,
        goal: waterGoal,
      }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Droplets className="w-6 h-6 text-blue-400" />
        Hydration Tracker
      </h1>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
        <div className="relative w-40 h-40 mx-auto mb-6">
          <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r="70" fill="none" stroke="#1f2937" strokeWidth="12" />
            <circle
              cx="80"
              cy="80"
              r="70"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 70}`}
              strokeDashoffset={`${2 * Math.PI * 70 * (1 - percentage / 100)}`}
              className="transition-all duration-500"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-white">{currentGlasses}</span>
            <span className="text-gray-400 text-sm">of {waterGoal} glasses</span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => updateGlasses(-1)}
            disabled={currentGlasses <= 0}
            className="w-14 h-14 bg-gray-800 hover:bg-gray-700 rounded-2xl flex items-center justify-center text-white transition disabled:opacity-30"
          >
            <Minus className="w-6 h-6" />
          </button>
          <button
            onClick={() => updateGlasses(1)}
            className="w-14 h-14 bg-blue-500 hover:bg-blue-600 rounded-2xl flex items-center justify-center text-white transition"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {currentGlasses >= waterGoal && (
          <p className="mt-4 text-blue-400 font-medium">Goal reached! Great job staying hydrated!</p>
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          This Week
        </h2>
        <div className="flex items-end justify-between gap-2 h-32">
          {getWeekData().map((day, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-gray-800 rounded-lg relative" style={{ height: '100px' }}>
                <div
                  className={`absolute bottom-0 w-full rounded-lg transition-all ${
                    day.glasses >= day.goal ? 'bg-blue-500' : 'bg-blue-500/40'
                  }`}
                  style={{ height: `${Math.min((day.glasses / day.goal) * 100, 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">{day.day}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
