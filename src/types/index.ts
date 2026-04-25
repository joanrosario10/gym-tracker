export type UserRole = 'user' | 'admin' | 'super_admin'

export type NotificationChannel = 'email' | 'telegram' | 'instagram' | 'none'

export interface UserProfile {
  id: string
  display_name: string
  email: string
  photo_url: string | null
  role: UserRole
  created_at: string
  daily_calorie_goal: number
  daily_water_goal: number
  instagram_handle: string | null
  telegram_chat_id: string | null
  notification_channel: NotificationChannel
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface DietLog {
  id: string
  user_id: string
  log_date: string
  meal_type: MealType
  description: string
  calories: number
  protein: number
  carbs: number
  fats: number
  photo_url: string | null
  created_at: string
}

export interface HydrationLog {
  id: string
  user_id: string
  log_date: string
  glasses: number
  goal: number
  created_at: string
  updated_at: string
}

export interface LeaderboardEntry {
  uid: string
  display_name: string
  photo_url: string | null
  streak: number
  total_logs: number
  avg_calories: number
  score: number
}

export type MuscleGroup =
  | 'chest' | 'upper_back' | 'lats' | 'lower_back' | 'traps' | 'shoulders'
  | 'biceps' | 'triceps' | 'forearms'
  | 'abs' | 'obliques'
  | 'glutes' | 'quads' | 'hamstrings' | 'calves'
  | 'cardio' | 'full_body'

export type ExerciseCategory = 'strength' | 'cardio' | 'flexibility' | 'sport'

export interface Exercise {
  id: string
  name: string
  category: ExerciseCategory
  primary_muscle: MuscleGroup
  secondary_muscles: MuscleGroup[]
  description: string | null
  created_at: string
}

export interface Workout {
  id: string
  user_id: string
  log_date: string
  name: string
  duration_minutes: number | null
  calories_burned: number | null
  notes: string | null
  created_at: string
}

export interface WorkoutExercise {
  id: string
  workout_id: string
  exercise_id: string
  position: number
  sets: number | null
  reps: number | null
  weight_kg: number | null
  duration_seconds: number | null
  distance_m: number | null
  notes: string | null
  exercise?: Exercise
}

export interface BmiLog {
  id: string
  user_id: string
  log_date: string
  height_cm: number
  weight_kg: number
  bmi: number
  body_fat_percent: number | null
  notes: string | null
  created_at: string
}

export interface MuscleActivity {
  user_id: string
  muscle: MuscleGroup
  last_worked_on: string
  sessions_7d: number
  sessions_30d: number
  sessions_total: number
}

export type GoalType =
  | 'weight_loss' | 'weight_gain' | 'muscle_gain'
  | 'daily_calories' | 'daily_water' | 'workout_frequency'
  | 'bmi_target' | 'custom'

export type GoalStatus = 'active' | 'achieved' | 'abandoned'

export interface Goal {
  id: string
  user_id: string
  goal_type: GoalType
  title: string
  target_value: number | null
  target_unit: string | null
  target_date: string | null
  start_value: number | null
  status: GoalStatus
  notes: string | null
  created_at: string
  achieved_at: string | null
}
