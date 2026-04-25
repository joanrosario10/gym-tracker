import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { BmiLog } from '../types'
import { format, parseISO } from 'date-fns'
import { Activity, Save, TrendingDown, TrendingUp } from 'lucide-react'

const FT_TO_CM = 30.48
const IN_TO_CM = 2.54

function categorize(bmi: number) {
  if (bmi < 18.5) return { label: 'Underweight', color: 'text-blue-400',    bg: 'bg-blue-500/10' }
  if (bmi < 25)   return { label: 'Healthy',     color: 'text-emerald-400', bg: 'bg-emerald-500/10' }
  if (bmi < 30)   return { label: 'Overweight',  color: 'text-amber-400',   bg: 'bg-amber-500/10' }
  return            { label: 'Obese',          color: 'text-red-400',     bg: 'bg-red-500/10' }
}

export default function Bmi() {
  const { currentUser } = useAuth()
  const [logs, setLogs] = useState<BmiLog[]>([])
  const [unit, setUnit] = useState<'metric' | 'imperial'>('metric')

  const [heightCm, setHeightCm] = useState('')
  const [feet, setFeet] = useState('')
  const [inches, setInches] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!currentUser) return
    supabase
      .from('bmi_logs')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('log_date', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const rows = (data ?? []) as BmiLog[]
        setLogs(rows)
        if (rows.length) {
          const last = rows[0]
          setHeightCm(String(last.height_cm))
          setFeet(String(Math.floor(last.height_cm / FT_TO_CM)))
          setInches(String(Math.round((last.height_cm - Math.floor(last.height_cm / FT_TO_CM) * FT_TO_CM) / IN_TO_CM)))
        }
      })
  }, [currentUser])

  const heightInCm = useMemo(() => {
    if (unit === 'metric') return Number(heightCm) || 0
    return Number(feet) * FT_TO_CM + Number(inches) * IN_TO_CM
  }, [unit, heightCm, feet, inches])

  const previewBmi = useMemo(() => {
    const h = heightInCm / 100
    const w = Number(weightKg)
    if (!h || !w) return 0
    return Math.round((w / (h * h)) * 10) / 10
  }, [heightInCm, weightKg])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    if (!heightInCm || !Number(weightKg)) {
      setError('Enter a height and weight')
      return
    }
    setError('')
    setLoading(true)

    try {
      const { data, error: insertErr } = await supabase
        .from('bmi_logs')
        .upsert(
          {
            user_id: currentUser.id,
            log_date: format(new Date(), 'yyyy-MM-dd'),
            height_cm: heightInCm,
            weight_kg: Number(weightKg),
            body_fat_percent: bodyFat ? Number(bodyFat) : null,
            notes: notes || null,
          },
          { onConflict: 'user_id,log_date' }
        )
        .select()
        .single()

      if (insertErr) throw insertErr
      setLogs((prev) => [data as BmiLog, ...prev.filter((l) => l.log_date !== (data as BmiLog).log_date)])
      setWeightKg('')
      setBodyFat('')
      setNotes('')
    } catch (err) {
      console.error(err)
      setError('Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const latest = logs[0]
  const previous = logs[1]
  const trend = latest && previous ? Number(latest.weight_kg) - Number(previous.weight_kg) : 0

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Activity className="w-6 h-6 text-emerald-400" />
        BMI Tracker
      </h1>

      {latest && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">Latest reading</span>
            <span className="text-xs text-gray-500">{format(parseISO(latest.log_date), 'MMM d, yyyy')}</span>
          </div>
          <div className="flex items-end gap-4">
            <div>
              <div className="text-5xl font-bold text-white">{Number(latest.bmi).toFixed(1)}</div>
              <div className={`inline-flex mt-2 px-2.5 py-1 rounded-full text-xs font-medium ${categorize(Number(latest.bmi)).bg} ${categorize(Number(latest.bmi)).color}`}>
                {categorize(Number(latest.bmi)).label}
              </div>
            </div>
            <div className="ml-auto text-right space-y-1">
              <p className="text-sm text-gray-400">{Number(latest.weight_kg).toFixed(1)} kg · {Number(latest.height_cm).toFixed(0)} cm</p>
              {previous && (
                <p className={`text-xs flex items-center gap-1 justify-end ${trend < 0 ? 'text-emerald-400' : trend > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
                  {trend < 0 ? <TrendingDown className="w-3 h-3" /> : trend > 0 ? <TrendingUp className="w-3 h-3" /> : null}
                  {trend === 0 ? 'no change' : `${trend > 0 ? '+' : ''}${trend.toFixed(1)} kg vs ${format(parseISO(previous.log_date), 'MMM d')}`}
                </p>
              )}
              {latest.body_fat_percent != null && (
                <p className="text-xs text-gray-500">{Number(latest.body_fat_percent).toFixed(1)}% body fat</p>
              )}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-white">New reading</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2.5 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          {(['metric', 'imperial'] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUnit(u)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${
                unit === u ? 'bg-emerald-500 text-white' : 'bg-gray-800 text-gray-400'
              }`}
            >
              {u === 'metric' ? 'cm / kg' : 'ft·in / kg'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {unit === 'metric' ? (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Height (cm)</label>
              <input
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="185"
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Feet</label>
                <input
                  type="number"
                  value={feet}
                  onChange={(e) => setFeet(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="6"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Inches</label>
                <input
                  type="number"
                  value={inches}
                  onChange={(e) => setInches(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="1"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="82.0"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Body fat % (optional)</label>
          <input
            type="number"
            step="0.1"
            value={bodyFat}
            onChange={(e) => setBodyFat(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="16.0"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Notes</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="optional"
          />
        </div>

        {previewBmi > 0 && (
          <div className="text-center text-sm text-gray-400">
            BMI preview: <span className="text-white font-semibold">{previewBmi}</span>{' '}
            <span className={categorize(previewBmi).color}>({categorize(previewBmi).label})</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Reading
            </>
          )}
        </button>
      </form>

      {logs.length > 1 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-lg font-semibold text-white mb-4">History</h2>
          <div className="divide-y divide-gray-800">
            {logs.map((l) => {
              const cat = categorize(Number(l.bmi))
              return (
                <div key={l.id} className="py-3 flex items-center gap-3">
                  <div className={`w-1 h-8 rounded-full ${cat.color.replace('text-', 'bg-')}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm">{Number(l.weight_kg).toFixed(1)} kg</p>
                    <p className="text-gray-500 text-xs">{format(parseISO(l.log_date), 'MMM d, yyyy')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm font-semibold">{Number(l.bmi).toFixed(1)}</p>
                    <p className={`text-xs ${cat.color}`}>{cat.label}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
