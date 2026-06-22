import { useCallback, useEffect, useState } from 'react'
import { message } from 'antd'
import type { Task, Block } from '@/types'
import { getTasks, getBlocks, rateTask } from '@/api'

export default function TaskScoring() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState(true)
  // per-task draft state: { [taskId]: { rating, comment } }
  const [drafts, setDrafts] = useState<Record<number, { rating: number; comment: string }>>({})
  // tasks being edited (re-rating already rated tasks)
  const [editing, setEditing] = useState<Set<number>>(new Set())
  const [hoveredStar, setHoveredStar] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [tasksRes, blocksRes] = await Promise.all([
        getTasks(),
        getBlocks(),
      ])
      const scorable = (tasksRes.data as Task[]).filter(t => t.status === 'completed' || t.status === 'rated')
      setTasks(scorable)
      setBlocks(blocksRes.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const getDraft = (taskId: number) => drafts[taskId] ?? { rating: 0, comment: '' }

  const setDraftRating = (taskId: number, rating: number) =>
    setDrafts(prev => ({ ...prev, [taskId]: { ...getDraft(taskId), rating } }))

  const setDraftComment = (taskId: number, comment: string) =>
    setDrafts(prev => ({ ...prev, [taskId]: { ...getDraft(taskId), comment } }))

  const handleSubmit = async (task: Task) => {
    const draft = getDraft(task.id)
    if (draft.rating === 0) { message.warning('Please select a rating'); return }
    try {
      await rateTask(task.id, draft.rating, draft.comment || undefined)
      message.success('Rating submitted')
      // clear draft and editing state
      setDrafts(prev => { const n = { ...prev }; delete n[task.id]; return n })
      setEditing(prev => { const n = new Set(prev); n.delete(task.id); return n })
      void load()
    } catch {
      // ignore
    }
  }

  const getBinLocation = (task: Task) => {
    if (!task.bin) return `Bin #${task.bin_id}`
    const block = blocks.find(bl => bl.id === task.bin!.block_id)
    return `${block?.name ?? 'Block ?'} · Floor ${task.bin.floor} · Bin ${task.bin.bin_number}`
  }

  const getCleanerName = (task: Task) => {
    if (task.cleaner) return task.cleaner.name
    if (task.cleaner_id) return `Cleaner #${task.cleaner_id}`
    return null
  }

  const fmt = (s?: string | null) => s ? new Date(s).toLocaleString() : '—'

  if (loading) return <div style={{ padding: 40, color: '#999', textAlign: 'center' }}>Loading...</div>

  const pendingCount = tasks.filter(t => t.status === 'completed').length
  const ratedCount = tasks.filter(t => t.status === 'rated').length

  return (
    <div style={{ fontFamily: '"Helvetica Neue",Helvetica,Arial,sans-serif' }}>
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7 }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid #ededed', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: '#5b9bd5' }}>Completed Tasks</span>
            {pendingCount > 0 && (
              <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#fcf1e1', color: '#e89c3b' }}>
                {pendingCount} awaiting your score
              </span>
            )}
            {pendingCount === 0 && (
              <span style={{ marginLeft: 8, fontSize: 11, color: '#999', fontWeight: 400 }}>{ratedCount} rated</span>
            )}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 680, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Employee', 'Task Location', 'Completed', 'Rating', 'Comment', 'Action'].map(h => (
                <th key={h} style={{ background: '#f7f8fa', fontSize: 11, fontWeight: 600, color: '#666', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid #ededed' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#999', fontSize: 13 }}>
                  No completed tasks to score
                </td>
              </tr>
            ) : tasks.map(task => {
              const cleanerName = getCleanerName(task)
              const draft = getDraft(task.id)
              const isEditing = task.status !== 'rated' || editing.has(task.id)

              return (
                <tr key={task.id}>
                  {/* Employee */}
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                    {cleanerName ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', background: '#eaf2fb', color: '#3a7bc0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0,
                        }}>
                          {cleanerName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <b style={{ fontSize: 12, fontWeight: 600, display: 'block' }}>{cleanerName}</b>
                          <span style={{ fontSize: 10, color: '#999', fontFamily: "'SF Mono',Consolas,monospace" }}>#{task.id}</span>
                        </div>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>— Unassigned —</span>
                    )}
                  </td>

                  {/* Location */}
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', fontSize: 12, color: '#333' }}>
                    {getBinLocation(task)}
                  </td>

                  {/* Completed At */}
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', fontSize: 11.5, color: '#999' }}>
                    {fmt(task.completed_at ?? task.rated_at)}
                  </td>

                  {/* Rating */}
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                    {isEditing ? (
                      <span style={{ display: 'inline-flex', gap: 3 }}>
                        {[1, 2, 3, 4, 5].map(n => {
                          const activeRating = draft.rating
                          const starKey = `${task.id}-${n}`
                          return (
                            <svg
                              key={n}
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              width={18}
                              height={18}
                              style={{
                                cursor: 'pointer',
                                color: n <= activeRating ? '#e8a93b' : '#dfe3e8',
                                transition: 'color .1s, transform .1s',
                                transform: hoveredStar === starKey ? 'scale(1.1)' : 'none',
                                flexShrink: 0,
                              }}
                              onMouseEnter={() => setHoveredStar(starKey)}
                              onMouseLeave={() => setHoveredStar(null)}
                              onClick={() => setDraftRating(task.id, n)}
                            >
                              <path d="M12 2l3 6.5 7 .8-5 4.9 1.3 7-6.3-3.4L5.7 21 7 14.2 2 9.3l7-.8z"/>
                            </svg>
                          )
                        })}
                      </span>
                    ) : (
                      <span style={{ fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 11, background: '#e9f3e9', color: '#5ca85c' }}>
                        ★ {task.rating}.0 · Rated
                      </span>
                    )}
                  </td>

                  {/* Comment */}
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                    {isEditing ? (
                      <input
                        style={{
                          border: '1px solid #e0e0e0', borderRadius: 5, height: 30,
                          padding: '0 9px', fontSize: 11, color: '#333',
                          minWidth: 170, fontFamily: 'inherit', outline: 'none',
                        }}
                        placeholder="Add a comment…"
                        value={draft.comment}
                        onChange={e => setDraftComment(task.id, e.target.value)}
                      />
                    ) : (
                      <span style={{ fontSize: 11.5, color: '#666' }}>{task.comment || '—'}</span>
                    )}
                  </td>

                  {/* Action */}
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                    {isEditing ? (
                      <button
                        onClick={() => handleSubmit(task)}
                        style={{
                          background: '#4a90d9', color: '#fff', border: 'none',
                          borderRadius: 5, padding: '5px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        {task.status === 'rated' ? 'Update' : 'Submit'}
                      </button>
                    ) : (
                      <a
                        onClick={() => {
                          setEditing(prev => new Set(prev).add(task.id))
                          setDrafts(prev => ({ ...prev, [task.id]: { rating: task.rating ?? 0, comment: task.comment ?? '' } }))
                        }}
                        style={{ fontSize: 11.5, color: '#4a90d9', cursor: 'pointer', fontWeight: 500 }}
                      >Edit</a>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
