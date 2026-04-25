import { useState, useRef, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { format } from 'date-fns'
import { Camera, ArrowLeft, Upload, Sparkles } from 'lucide-react'
import type { MealType } from '../types'

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export default function DietForm() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [mealType, setMealType] = useState<MealType>('breakfast')
  const [description, setDescription] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fats, setFats] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoFilling, setAutoFilling] = useState(false)
  const [error, setError] = useState('')

  const handleAutoFill = async () => {
    const desc = description.trim()
    if (!desc) {
      setError('Type what you ate first, then tap Auto-fill.')
      return
    }
    setError('')
    setAutoFilling(true)
    try {
      const res = await fetch('/api/nutrition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc }),
      })
      if (!res.ok) throw new Error(`status ${res.status}`)
      const macros = await res.json()
      if (typeof macros.calories === 'number') setCalories(String(macros.calories))
      if (typeof macros.protein  === 'number') setProtein(String(macros.protein))
      if (typeof macros.carbs    === 'number') setCarbs(String(macros.carbs))
      if (typeof macros.fats     === 'number') setFats(String(macros.fats))
    } catch (err) {
      console.error(err)
      setError('Auto-fill failed. Enter macros manually.')
    } finally {
      setAutoFilling(false)
    }
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhoto(file)
      const reader = new FileReader()
      reader.onloadend = () => setPhotoPreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const uploadPhoto = async (file: File): Promise<string> => {
    if (!currentUser) throw new Error('Not authenticated')
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${currentUser.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('diet-photos')
      .upload(path, file, { contentType: file.type, upsert: false })
    if (uploadError) throw uploadError
    const { data } = supabase.storage.from('diet-photos').getPublicUrl(path)
    return data.publicUrl
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!currentUser) return
    setError('')
    setLoading(true)

    try {
      let photoUrl: string | null = null
      if (photo) photoUrl = await uploadPhoto(photo)

      const { error: insertError } = await supabase.from('diet_logs').insert({
        user_id: currentUser.id,
        log_date: format(new Date(), 'yyyy-MM-dd'),
        meal_type: mealType,
        description,
        calories: Number(calories) || 0,
        protein: Number(protein) || 0,
        carbs: Number(carbs) || 0,
        fats: Number(fats) || 0,
        photo_url: photoUrl,
      })
      if (insertError) throw insertError

      navigate('/diet')
    } catch (err) {
      console.error(err)
      setError('Failed to save meal log')
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
        <h1 className="text-2xl font-bold text-white">Log Meal</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer border-2 border-dashed border-gray-700 rounded-2xl p-6 text-center hover:border-emerald-500/50 transition"
        >
          {photoPreview ? (
            <img src={photoPreview} alt="Preview" className="w-full max-h-48 object-cover rounded-xl" />
          ) : (
            <div className="space-y-2">
              <Camera className="w-10 h-10 text-gray-500 mx-auto" />
              <p className="text-gray-400 text-sm">Tap to add a photo of your meal</p>
              <p className="text-gray-600 text-xs">Photo proof keeps you accountable!</p>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoChange}
            className="hidden"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Meal Type</label>
          <div className="grid grid-cols-4 gap-2">
            {MEAL_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setMealType(type)}
                className={`py-2.5 px-3 rounded-xl text-sm font-medium capitalize transition ${
                  mealType === type
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-gray-300">Description</label>
            <button
              type="button"
              onClick={handleAutoFill}
              disabled={autoFilling || !description.trim()}
              className="flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {autoFilling ? (
                <>
                  <div className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  Estimating…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto-fill macros
                </>
              )}
            </button>
          </div>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            placeholder="e.g. Grilled chicken with rice"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Calories (kcal)</label>
            <input
              type="number"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              placeholder="0"
              min="0"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Protein (g)</label>
            <input
              type="number"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              placeholder="0"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Carbs (g)</label>
            <input
              type="number"
              value={carbs}
              onChange={(e) => setCarbs(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              placeholder="0"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Fats (g)</label>
            <input
              type="number"
              value={fats}
              onChange={(e) => setFats(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              placeholder="0"
              min="0"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Save Meal
            </>
          )}
        </button>
      </form>
    </div>
  )
}
