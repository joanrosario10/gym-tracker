import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { AuthShell, Field } from './Register'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch {
      setError('Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell tagline="Track diet, hydration, and gains.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Welcome back</h2>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2.5 rounded-xl text-sm">
            {error}
          </div>
        )}

        <Field
          icon={<Mail className="w-4 h-4" />}
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={setEmail}
          required
          autoComplete="email"
        />

        <Field
          icon={<Lock className="w-4 h-4" />}
          type={showPassword ? 'text' : 'password'}
          placeholder="Password"
          value={password}
          onChange={setPassword}
          required
          autoComplete="current-password"
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

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              Sign in
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </button>

        <p className="text-center text-gray-400 text-sm pt-1">
          New here?{' '}
          <Link to="/register" className="text-emerald-400 hover:text-emerald-300 font-medium">
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
