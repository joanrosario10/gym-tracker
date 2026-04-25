import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MessageSquare, Send, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export type CommentTarget =
  | { type: 'diet';      id: string }
  | { type: 'workout';   id: string }
  | { type: 'hydration'; id: string }

interface CoachComment {
  id: string
  author_id: string
  body: string
  created_at: string
  author?: { display_name: string; photo_url: string | null } | null
}

const COLUMN: Record<CommentTarget['type'], 'diet_log_id' | 'workout_id' | 'hydration_log_id'> = {
  diet:      'diet_log_id',
  workout:   'workout_id',
  hydration: 'hydration_log_id',
}

export default function Comments({ target }: { target: CommentTarget }) {
  const { currentUser, isAdmin } = useAuth()
  const [comments, setComments] = useState<CoachComment[]>([])
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [posting, setPosting] = useState(false)

  const column = COLUMN[target.type]

  useEffect(() => {
    let cancelled = false
    supabase
      .from('coach_comments')
      .select('*, author:profiles!author_id(display_name, photo_url)')
      .eq(column, target.id)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error(error)
        setComments((data ?? []) as CoachComment[])
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [column, target.id])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!currentUser || !body.trim()) return
    setPosting(true)
    try {
      const { data, error } = await supabase
        .from('coach_comments')
        .insert({ author_id: currentUser.id, body: body.trim(), [column]: target.id })
        .select('*, author:profiles!author_id(display_name, photo_url)')
        .single()
      if (error) throw error
      setComments((prev) => [...prev, data as CoachComment])
      setBody('')
    } catch (err) {
      console.error('Failed to post comment', err)
    } finally {
      setPosting(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this comment?')) return
    const { error } = await supabase.from('coach_comments').delete().eq('id', id)
    if (error) {
      console.error(error)
      return
    }
    setComments((prev) => prev.filter((c) => c.id !== id))
  }

  if (loading) return null

  if (!isAdmin && comments.length === 0) return null

  return (
    <div className="mt-3 pt-3 border-t border-gray-800/70">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
        <MessageSquare className="w-3.5 h-3.5" />
        {comments.length === 0 ? 'No comments yet' : `${comments.length} comment${comments.length === 1 ? '' : 's'}`}
      </div>

      {comments.length > 0 && (
        <div className="space-y-2 mb-2">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2 bg-gray-800/40 rounded-lg p-2.5">
              <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center flex-shrink-0">
                {c.author?.photo_url ? (
                  <img src={c.author.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[11px] font-bold text-gray-300">
                    {c.author?.display_name?.charAt(0).toUpperCase() ?? '?'}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-emerald-400 font-medium">{c.author?.display_name ?? 'Coach'}</span>
                  <span className="text-gray-600">{format(parseISO(c.created_at), 'MMM d · h:mma')}</span>
                </div>
                <p className="text-sm text-gray-200 whitespace-pre-wrap break-words mt-0.5">{c.body}</p>
              </div>
              {currentUser?.id === c.author_id && (
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  className="text-gray-600 hover:text-red-400 transition flex-shrink-0"
                  aria-label="Delete comment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <form onSubmit={submit} className="flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a coach note…"
            disabled={posting}
            className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            maxLength={2000}
          />
          <button
            type="submit"
            disabled={posting || !body.trim()}
            className="px-3 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition flex items-center gap-1.5"
          >
            {posting ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </button>
        </form>
      )}
    </div>
  )
}
