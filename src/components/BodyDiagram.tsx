import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { MuscleActivity, MuscleGroup } from '../types'

const FRONT_MUSCLES: { id: MuscleGroup; label: string; d: string }[] = [
  { id: 'shoulders', label: 'L Delt',  d: 'M62,80 q-14,-2 -22,12 q-2,12 4,22 q14,-4 22,-14 z' },
  { id: 'shoulders', label: 'R Delt',  d: 'M138,80 q14,-2 22,12 q2,12 -4,22 q-14,-4 -22,-14 z' },
  { id: 'chest',     label: 'L Chest', d: 'M70,92 q-2,18 0,34 q14,8 28,4 q2,-22 -2,-38 q-14,-4 -26,0 z' },
  { id: 'chest',     label: 'R Chest', d: 'M130,92 q2,18 0,34 q-14,8 -28,4 q-2,-22 2,-38 q14,-4 26,0 z' },
  { id: 'biceps',    label: 'L Bicep', d: 'M44,118 q-8,18 -4,38 q10,4 18,-2 q4,-18 -2,-38 z' },
  { id: 'biceps',    label: 'R Bicep', d: 'M156,118 q8,18 4,38 q-10,4 -18,-2 q-4,-18 2,-38 z' },
  { id: 'forearms',  label: 'L Fore',  d: 'M40,160 q-6,22 -2,40 q12,2 18,-4 q4,-20 -4,-38 z' },
  { id: 'forearms',  label: 'R Fore',  d: 'M160,160 q6,22 2,40 q-12,2 -18,-4 q-4,-20 4,-38 z' },
  { id: 'abs',       label: 'Abs',     d: 'M86,128 q14,-4 28,0 l-2,52 q-12,4 -24,0 z' },
  { id: 'obliques',  label: 'L Obl',   d: 'M70,134 q-2,30 4,46 q8,2 12,-2 l-2,-46 q-8,2 -14,2 z' },
  { id: 'obliques',  label: 'R Obl',   d: 'M130,134 q2,30 -4,46 q-8,2 -12,-2 l2,-46 q8,2 14,2 z' },
  { id: 'quads',     label: 'L Quad',  d: 'M76,196 q-6,38 0,72 q14,4 22,-2 q2,-38 -4,-72 q-10,-2 -18,2 z' },
  { id: 'quads',     label: 'R Quad',  d: 'M124,196 q6,38 0,72 q-14,4 -22,-2 q-2,-38 4,-72 q10,-2 18,2 z' },
  { id: 'calves',    label: 'L Calf',  d: 'M78,278 q-4,30 2,52 q12,2 16,-2 q2,-30 -4,-52 z' },
  { id: 'calves',    label: 'R Calf',  d: 'M122,278 q4,30 -2,52 q-12,2 -16,-2 q-2,-30 4,-52 z' },
]

const BACK_MUSCLES: { id: MuscleGroup; label: string; d: string }[] = [
  { id: 'traps',      label: 'Traps',     d: 'M86,72 q14,-6 28,0 l-2,22 q-12,4 -24,0 z' },
  { id: 'shoulders',  label: 'L Rear',    d: 'M62,80 q-14,-2 -22,12 q-2,12 4,22 q14,-4 22,-14 z' },
  { id: 'shoulders',  label: 'R Rear',    d: 'M138,80 q14,-2 22,12 q2,12 -4,22 q-14,-4 -22,-14 z' },
  { id: 'upper_back', label: 'Upper Back',d: 'M70,98 q14,-6 30,-4 q16,-2 30,4 l-4,28 q-26,4 -52,0 z' },
  { id: 'lats',       label: 'L Lat',     d: 'M64,116 q-4,28 4,52 q10,2 16,-4 q-2,-30 -4,-50 z' },
  { id: 'lats',       label: 'R Lat',     d: 'M136,116 q4,28 -4,52 q-10,2 -16,-4 q2,-30 4,-50 z' },
  { id: 'triceps',    label: 'L Tri',     d: 'M44,118 q-8,18 -4,38 q10,4 18,-2 q4,-18 -2,-38 z' },
  { id: 'triceps',    label: 'R Tri',     d: 'M156,118 q8,18 4,38 q-10,4 -18,-2 q-4,-18 2,-38 z' },
  { id: 'lower_back', label: 'Lower Back',d: 'M82,166 q18,-2 36,0 l-2,28 q-16,4 -32,0 z' },
  { id: 'glutes',     label: 'L Glute',   d: 'M76,196 q-2,22 4,36 q12,2 18,-4 q-2,-22 -4,-34 q-10,-2 -18,2 z' },
  { id: 'glutes',     label: 'R Glute',   d: 'M124,196 q2,22 -4,36 q-12,2 -18,-4 q2,-22 4,-34 q10,-2 18,2 z' },
  { id: 'hamstrings', label: 'L Ham',     d: 'M76,234 q-4,28 2,54 q14,2 22,-2 q-2,-32 -4,-54 q-10,-2 -20,2 z' },
  { id: 'hamstrings', label: 'R Ham',     d: 'M124,234 q4,28 -2,54 q-14,2 -22,-2 q2,-32 4,-54 q10,-2 20,2 z' },
  { id: 'calves',     label: 'L Calf',    d: 'M78,290 q-4,28 2,46 q12,2 16,-2 q2,-26 -4,-44 z' },
  { id: 'calves',     label: 'R Calf',    d: 'M122,290 q4,28 -2,46 q-12,2 -16,-2 q-2,-26 4,-44 z' },
]

const HEAD_FRONT = 'M100,30 q-22,2 -22,28 q0,22 22,28 q22,-6 22,-28 q0,-26 -22,-28 z'
const HEAD_BACK  = HEAD_FRONT

function colorFor(sessions7d: number): string {
  if (sessions7d <= 0) return 'rgb(31, 41, 55)'           // gray-800
  if (sessions7d < 1)  return 'rgb(239, 68, 68, 0.25)'    // faint red
  if (sessions7d < 2)  return 'rgb(239, 68, 68, 0.45)'
  if (sessions7d < 4)  return 'rgb(239, 68, 68, 0.7)'
  return 'rgb(220, 38, 38)'                                // deep red
}

export default function BodyDiagram() {
  const { currentUser } = useAuth()
  const [activity, setActivity] = useState<Record<MuscleGroup, MuscleActivity> | null>(null)

  useEffect(() => {
    if (!currentUser) return
    supabase
      .from('muscle_activity')
      .select('*')
      .eq('user_id', currentUser.id)
      .then(({ data }) => {
        const map = {} as Record<MuscleGroup, MuscleActivity>
        for (const row of (data ?? []) as MuscleActivity[]) {
          // keep the highest sessions_7d if a muscle appears more than once
          if (!map[row.muscle] || row.sessions_7d > map[row.muscle].sessions_7d) {
            map[row.muscle] = row
          }
        }
        setActivity(map)
      })
  }, [currentUser])

  const fillFor = (id: MuscleGroup) => colorFor(activity?.[id]?.sessions_7d ?? 0)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Muscle Activity (7d)</h2>
        <Legend />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <BodyView label="Front" headPath={HEAD_FRONT} muscles={FRONT_MUSCLES} fillFor={fillFor} />
        <BodyView label="Back"  headPath={HEAD_BACK}  muscles={BACK_MUSCLES}  fillFor={fillFor} />
      </div>
    </div>
  )
}

function BodyView({
  label,
  headPath,
  muscles,
  fillFor,
}: {
  label: string
  headPath: string
  muscles: { id: MuscleGroup; label: string; d: string }[]
  fillFor: (id: MuscleGroup) => string
}) {
  return (
    <div className="flex flex-col items-center min-w-0">
      <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">{label}</p>
      <svg viewBox="0 0 200 350" className="w-full">
        {/* head */}
        <path d={headPath} fill="rgb(31, 41, 55)" stroke="rgb(55, 65, 81)" strokeWidth="1" />
        {/* torso outline */}
        <path
          d="M70,86 q-14,4 -22,16 q-12,8 -10,30 q4,30 12,52 q-2,22 6,40 q4,30 14,60 q4,18 12,38 l28,2 q8,-22 12,-40 q10,-30 14,-60 q8,-18 6,-40 q8,-22 12,-52 q2,-22 -10,-30 q-8,-12 -22,-16 q-26,-8 -52,0 z"
          fill="transparent"
          stroke="rgb(55, 65, 81)"
          strokeWidth="1.5"
        />
        {muscles.map((m, i) => (
          <path
            key={`${m.id}-${i}`}
            d={m.d}
            fill={fillFor(m.id)}
            stroke="rgb(55, 65, 81)"
            strokeWidth="0.6"
            data-muscle={m.id}
          >
            <title>{m.label}</title>
          </path>
        ))}
      </svg>
    </div>
  )
}

function Legend() {
  const stops = [
    { label: 'rest', color: 'rgb(31, 41, 55)' },
    { label: 'light', color: 'rgb(239, 68, 68, 0.45)' },
    { label: 'mod', color: 'rgb(239, 68, 68, 0.7)' },
    { label: 'heavy', color: 'rgb(220, 38, 38)' },
  ]
  return (
    <div className="flex items-center gap-2">
      {stops.map((s) => (
        <div key={s.label} className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ background: s.color }} />
          <span className="text-[10px] text-gray-500">{s.label}</span>
        </div>
      ))}
    </div>
  )
}
