import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Workout } from '../types'
import { format, parseISO } from 'date-fns'
import { Dumbbell, Plus, Clock, Flame, Trash2 } from 'lucide-react'
import BodyDiagram from '../components/BodyDiagram'
import Comments from '../components/Comments'

export default function Workouts() {
  const { currentUser } = useAuth()
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) return
    const load = async () => {
      const { data, error } = await supabase
        .from('workouts')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('log_date', { ascending: false })
        .limit(60)
      if (error) console.error(error)
      setWorkouts((data ?? []) as Workout[])
      setLoading(false)
    }
    load()
  }, [currentUser])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this workout? Sets logged inside will be removed too.')) return
    const { error } = await supabase.from('workouts').delete().eq('id', id)
    if (error) {
      console.error(error)
      return
    }
    setWorkouts((prev) => prev.filter((w) => w.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Dumbbell className="w-6 h-6 text-emerald-400" />
          Workouts
        </h1>
        <Link
          to="/workouts/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Log Workout
        </Link>
      </div>

      <BodyDiagram />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : workouts.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl">
          <Dumbbell className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No workouts logged yet</p>
          <Link
            to="/workouts/new"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition text-sm"
          >
            <Plus className="w-4 h-4" />
            Log your first workout
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {workouts.map((w) => (
            <div
              key={w.id}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Dumbbell className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{w.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {format(parseISO(w.log_date), 'EEE, MMM d, yyyy')}
                  </p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-400">
                    {w.duration_minutes != null && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {w.duration_minutes} min
                      </span>
                    )}
                    {w.calories_burned != null && (
                      <span className="flex items-center gap-1">
                        <Flame className="w-3 h-3" />
                        {w.calories_burned} kcal
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(w.id)}
                  className="p-1.5 text-gray-500 hover:text-red-400 transition"
                  aria-label="Delete workout"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <Comments target={{ type: 'workout', id: w.id }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
