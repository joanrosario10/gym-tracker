import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { DietLog as DietLogType } from '../types'
import { format } from 'date-fns'
import { Plus, Camera, Trash2, UtensilsCrossed } from 'lucide-react'
import Comments from '../components/Comments'

export default function DietLog() {
  const { currentUser } = useAuth()
  const [logs, setLogs] = useState<DietLogType[]>([])
  const [loading, setLoading] = useState(true)
  const [filterDate, setFilterDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  useEffect(() => {
    if (!currentUser) return
    const fetchLogs = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('diet_logs')
          .select('*')
          .eq('user_id', currentUser.id)
          .eq('log_date', filterDate)
          .order('created_at', { ascending: false })
        if (error) throw error
        setLogs((data || []) as DietLogType[])
      } catch (error) {
        console.error('Error fetching diet logs:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchLogs()
  }, [currentUser, filterDate])

  const handleDelete = async (logId: string) => {
    if (!confirm('Delete this meal log?')) return
    try {
      const { error } = await supabase.from('diet_logs').delete().eq('id', logId)
      if (error) throw error
      setLogs((prev) => prev.filter((l) => l.id !== logId))
    } catch (error) {
      console.error('Error deleting log:', error)
    }
  }

  const totalCalories = logs.reduce((sum, l) => sum + l.calories, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <UtensilsCrossed className="w-6 h-6 text-emerald-400" />
          Diet Log
        </h1>
        <Link
          to="/diet/new"
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition font-medium text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Meal
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="px-4 py-2.5 bg-gray-900 border border-gray-800 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
        />
        <div className="text-sm text-gray-400">
          Total: <span className="text-white font-semibold">{totalCalories} kcal</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl">
          <UtensilsCrossed className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No meals logged for this date</p>
          <Link
            to="/diet/new"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500/20 transition text-sm"
          >
            <Plus className="w-4 h-4" />
            Log your first meal
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <div className="flex gap-4">
                {log.photo_url ? (
                  <img src={log.photo_url} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-20 h-20 bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Camera className="w-6 h-6 text-gray-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-medium">{log.description}</p>
                      <p className="text-gray-500 text-sm capitalize mt-0.5">{log.meal_type}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(log.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span className="text-emerald-400">{log.calories} kcal</span>
                    <span className="text-gray-500">P: {log.protein}g</span>
                    <span className="text-gray-500">C: {log.carbs}g</span>
                    <span className="text-gray-500">F: {log.fats}g</span>
                  </div>
                </div>
              </div>
              <Comments target={{ type: 'diet', id: log.id }} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
