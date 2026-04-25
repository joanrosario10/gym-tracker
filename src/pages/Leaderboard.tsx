import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { LeaderboardEntry } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { Trophy, Medal, Award, TrendingUp } from 'lucide-react'

export default function Leaderboard() {
  const { currentUser } = useAuth()
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('leaderboard')
          .select('*')
          .order('score', { ascending: false })
        if (error) throw error
        setEntries((data || []) as LeaderboardEntry[])
      } catch (error) {
        console.error('Error fetching leaderboard:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchLeaderboard()
  }, [])

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="w-6 h-6 text-amber-400" />
    if (index === 1) return <Medal className="w-6 h-6 text-gray-300" />
    if (index === 2) return <Award className="w-6 h-6 text-amber-600" />
    return <span className="w-6 h-6 flex items-center justify-center text-gray-500 font-bold text-sm">#{index + 1}</span>
  }

  const getRankBg = (index: number) => {
    if (index === 0) return 'bg-amber-500/5 border-amber-500/20'
    if (index === 1) return 'bg-gray-500/5 border-gray-500/20'
    if (index === 2) return 'bg-amber-700/5 border-amber-700/20'
    return 'bg-gray-900 border-gray-800'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-400" />
          Leaderboard
        </h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 bg-gray-900 border border-gray-800 rounded-2xl">
          <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No data yet. Start logging to compete!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <div
              key={entry.uid}
              className={`border rounded-2xl p-4 transition ${getRankBg(index)} ${
                entry.uid === currentUser?.id ? 'ring-2 ring-emerald-500/30' : ''
              }`}
            >
              <div className="flex items-center gap-4">
                {getRankIcon(index)}
                <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
                  {entry.photo_url ? (
                    <img src={entry.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    entry.display_name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-medium truncate">{entry.display_name}</p>
                    {entry.uid === currentUser?.id && (
                      <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">You</span>
                    )}
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      {entry.streak}d streak
                    </span>
                    <span>{entry.total_logs} meals</span>
                    <span>{entry.avg_calories} avg kcal</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-emerald-400">{entry.score}</p>
                  <p className="text-xs text-gray-500">points</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
