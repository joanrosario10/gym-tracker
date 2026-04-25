import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Dumbbell, Mail, Lock, User as UserIcon, Eye, EyeOff, ArrowRight } from 'lucide-react'

function passwordStrength(p: string) {
  let score = 0
  if (p.length >= 6) score++
  if (p.length >= 10) score++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++
  if (/\d/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p)) score++
  if (score >= 5) return { score: 4, label: 'Strong',  color: 'bg-emerald-500' }
  if (score >= 3) return { score: 3, label: 'Good',    color: 'bg-emerald-400' }
  if (score >= 2) return { score: 2, label: 'Fair',    color: 'bg-amber-400' }
  if (score >= 1) return { score: 1, label: 'Weak',    color: 'bg-red-400' }
  return                      { score: 0, label: '',        color: 'bg-gray-700' }
}

export default function Register() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signUp } = useAuth()
  const navigate = useNavigate()

  const strength = useMemo(() => passwordStrength(password), [password])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) return setError('Passwords do not match')
    if (password.length < 6) return setError('Password must be at least 6 characters')

    setLoading(true)
    try {
      await signUp(email, password, displayName)
      navigate('/')
    } catch {
      setError('Could not create account. Email may already be in use.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell tagline="Start tracking. Train with your crew.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Create account</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2.5 rounded-xl text-sm">
            {error}
          </div>
        )}

        <Field
          icon={<UserIcon className="w-4 h-4" />}
          type="text"
          placeholder="Display name"
          value={displayName}
          onChange={setDisplayName}
          required
          autoComplete="name"
        />

        <Field
          icon={<Mail className="w-4 h-4" />}
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={setEmail}
          required
          autoComplete="email"
        />

        <div>
          <Field
            icon={<Lock className="w-4 h-4" />}
            type={showPassword ? 'text' : 'password'}
            placeholder="Password"
            value={password}
            onChange={setPassword}
            required
            autoComplete="new-password"
            trailing={
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="text-gray-500 hover:text-gray-300 transition"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
          />
          {password && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 grid grid-cols-4 gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1 rounded-full transition-colors ${
                      i < strength.score ? strength.color : 'bg-gray-800'
                    }`}
                  />
                ))}
              </div>
              <span className="text-[11px] text-gray-500 w-12 text-right">{strength.label}</span>
            </div>
          )}
        </div>

        <Field
          icon={<Lock className="w-4 h-4" />}
          type={showPassword ? 'text' : 'password'}
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          required
          autoComplete="new-password"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              Create account
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </button>

        <p className="text-center text-gray-400 text-sm pt-1">
          Already have an account?{' '}
          <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}

export function AuthShell({
  children,
  tagline,
}: {
  children: React.ReactNode
  tagline: string
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gray-950 flex items-center justify-center px-4 py-10">
      <div className="absolute -top-40 -left-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/15 ring-1 ring-emerald-500/30 rounded-2xl mb-3">
            <Dumbbell className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">GymTracker</h1>
          <p className="text-gray-400 mt-1.5 text-sm">{tagline}</p>
        </div>

        <div className="bg-gray-900/70 backdrop-blur-xl rounded-2xl p-6 sm:p-7 border border-gray-800/80 shadow-2xl shadow-black/20">
          {children}
        </div>
      </div>
    </div>
  )
}

export function Field({
  icon,
  trailing,
  type,
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
}: {
  icon: React.ReactNode
  trailing?: React.ReactNode
  type: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  required?: boolean
  autoComplete?: string
}) {
  return (
    <label className="relative block">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
        {icon}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className="w-full pl-10 pr-10 py-3 bg-gray-800/60 border border-gray-700/70 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-transparent transition"
      />
      {trailing && (
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2">{trailing}</span>
      )}
    </label>
  )
}
