import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { Exercise } from '../types'
import { format } from 'date-fns'
import { ArrowLeft, Plus, Trash2, Dumbbell, Save, Sparkles } from 'lucide-react'

interface DraftSet {
  exercise_id: string
  sets: string
  reps: string
  weight_kg: string
  duration_seconds: string
}

const PRESETS: { name: string; preset: string[] }[] = [
  { name: 'Push Day', preset: ['Bench Press', 'Overhead Press', 'Lateral Raise', 'Tricep Pushdown'] },
  { name: 'Pull Day', preset: ['Pull-up', 'Barbell Row', 'Bicep Curl'] },
  { name: 'Leg Day',  preset: ['Squat', 'Romanian Deadlift', 'Lunges', 'Calf Raise'] },
  { name: 'Core Day', preset: ['Plank', 'Russian Twist', 'Push-up'] },
]

export default function WorkoutForm() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [logDate, setLogDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [duration, setDuration] = useState('')
  const [calories, setCalories] = useState('')
  const [notes, setNotes] = useState('')
  const [drafts, setDrafts] = useState<DraftSet[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(false)
  const [aiGoal, setAiGoal] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [error, setError] = useState('')

  const askAi = async () => {
    const goal = aiGoal.trim()
    if (!goal) return
    setError('')
    setAiBusy(true)
    try {
      const res = await fetch('/api/workout-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal }),
      })
      if (!res.ok) throw new Error(`status ${res.status}`)
      const plan: {
        name: string
        exercises: Array<{
          name: string
          sets: number | null
          reps: number | null
          weight_kg: number
          duration_seconds: number | null
        }>
      } = await res.json()

      const matched: DraftSet[] = []
      for (const e of plan.exercises) {
        const ex = exercises.find((x) => x.name === e.name)
        if (!ex) continue
        matched.push({
          exercise_id: ex.id,
          sets: e.sets != null ? String(e.sets) : '3',
          reps: e.reps != null ? String(e.reps) : '',
          weight_kg: e.weight_kg ? String(e.weight_kg) : '',
          duration_seconds: e.duration_seconds != null ? String(e.duration_seconds) : '',
        })
      }
      if (matched.length === 0) {
        setError('AI returned no usable exercises. Try rephrasing.')
        return
      }
      if (!name) setName(plan.name)
      setDrafts(matched)
    } catch (err) {
      console.error(err)
      setError('AI suggest failed. Try a preset or add exercises manually.')
    } finally {
      setAiBusy(false)
    }
  }

  useEffect(() => {
    supabase
      .from('exercises')
      .select('*')
      .order('name')
      .then(({ data }) => setExercises((data ?? []) as Exercise[]))
  }, [])

  const addExercise = (exerciseId?: string) => {
    setDrafts((prev) => [
      ...prev,
      {
        exercise_id: exerciseId ?? exercises[0]?.id ?? '',
        sets: '3',
        reps: '10',
        weight_kg: '',
        duration_seconds: '',
      },
    ])
  }

  const updateDraft = (i: number, patch: Partial<DraftSet>) => {
    setDrafts((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)))
  }

  const removeDraft = (i: number) => {
    setDrafts((prev) => prev.filter((_, idx) => idx !== i))
  }

  const applyPreset = (presetNames: string[], presetTitle: string) => {
    if (!name) setName(presetTitle)
    const matched = presetNames
      .map((n) => exercises.find((e) => e.name === n))
      .filter((e): e is Exercise => Boolean(e))
    setDrafts(
      matched.map((e) => ({
        exercise_id: e.id,
        sets: '3',
        reps: e.category === 'cardio' ? '' : '10',
        weight_kg: '',
        duration_seconds: e.category === 'cardio' ? '600' : '',
      }))
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    if (drafts.length === 0) {
      setError('Add at least one exercise')
      return
    }
    setError('')
    setLoading(true)

    try {
      const { data: workout, error: workoutErr } = await supabase
        .from('workouts')
        .insert({
          user_id: currentUser.id,
          log_date: logDate,
          name: name || 'Workout',
          duration_minutes: duration ? Number(duration) : null,
          calories_burned: calories ? Number(calories) : null,
          notes: notes || null,
        })
        .select()
        .single()
      if (workoutErr || !workout) throw workoutErr

      const rows = drafts.map((d, position) => ({
        workout_id: workout.id,
        exercise_id: d.exercise_id,
        position,
        sets: d.sets ? Number(d.sets) : null,
        reps: d.reps ? Number(d.reps) : null,
        weight_kg: d.weight_kg ? Number(d.weight_kg) : null,
        duration_seconds: d.duration_seconds ? Number(d.duration_seconds) : null,
      }))

      const { error: setsErr } = await supabase.from('workout_exercises').insert(rows)
      if (setsErr) throw setsErr

      navigate('/workouts')
    } catch (err) {
      console.error(err)
      setError('Failed to save workout')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 text-gray-400 hover:text-white transition">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-white">Log Workout</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Workout Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="e.g. Push Day A"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Date</label>
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full px-3 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Min</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-3 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="60"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Kcal</label>
              <input
                type="number"
                value={calories}
                onChange={(e) => setCalories(e.target.value)}
                className="w-full px-3 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="450"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              Plan or log with AI
            </label>
            <div className="flex gap-2 items-start">
              <textarea
                value={aiGoal}
                onChange={(e) => setAiGoal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    askAi()
                  }
                }}
                disabled={aiBusy}
                rows={3}
                placeholder={'Plan: "30 min full body, no equipment"\nOr describe what you did: "chest day — bench 90kg 3x12, incline 50kg 3x12, ..."'}
                className="flex-1 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
              <button
                type="button"
                onClick={askAi}
                disabled={aiBusy || !aiGoal.trim()}
                className="px-4 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed text-emerald-300 font-medium rounded-xl text-sm transition flex items-center gap-1.5 self-stretch"
              >
                {aiBusy ? (
                  <div className="w-4 h-4 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {aiBusy ? '…' : 'Go'}
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5">
              Plan a session, or paste what you just did and we'll fill in the sets, reps, and weights. Edit before saving.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Quick Presets</label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => applyPreset(p.preset, p.name)}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-emerald-400" />
              Exercises ({drafts.length})
            </h2>
            <button
              type="button"
              onClick={() => addExercise()}
              disabled={exercises.length === 0}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-emerald-400 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 transition disabled:opacity-30"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {drafts.length === 0 ? (
            <div className="bg-gray-900 border border-gray-800 border-dashed rounded-2xl p-8 text-center">
              <p className="text-gray-500 text-sm">Pick a preset above, or add an exercise.</p>
            </div>
          ) : (
            drafts.map((d, i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <select
                    value={d.exercise_id}
                    onChange={(e) => updateDraft(i, { exercise_id: e.target.value })}
                    className="flex-1 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {exercises.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeDraft(i)}
                    className="p-2 text-gray-500 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <NumField label="Sets"   value={d.sets}             onChange={(v) => updateDraft(i, { sets: v })} />
                  <NumField label="Reps"   value={d.reps}             onChange={(v) => updateDraft(i, { reps: v })} />
                  <NumField label="kg"     value={d.weight_kg}        onChange={(v) => updateDraft(i, { weight_kg: v })} />
                  <NumField label="sec"    value={d.duration_seconds} onChange={(v) => updateDraft(i, { duration_seconds: v })} />
                </div>
              </div>
            ))
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Felt strong, hit a PR on bench…"
          />
        </div>

        <button
          type="submit"
          disabled={loading || drafts.length === 0}
          className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Workout
            </>
          )}
        </button>
      </form>
    </div>
  )
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
        min="0"
      />
    </div>
  )
}
