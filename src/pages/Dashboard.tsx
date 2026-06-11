import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTaskStats, getBins, getBinStats, getBlocks, getUsers, getTasks } from '@/api'
import type { Bin, BinStats, Block, Task } from '@/types'

const POLL_MS = 30000

interface Stats { total: number; pending: number; in_progress: number; completed: number; rated: number }

function FillBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? '#d9534f' : pct >= 70 ? '#e89c3b' : '#5ca85c'
  return (
    <div style={{ background: '#f0f0f0', borderRadius: 4, height: 6, width: '100%', overflow: 'hidden' }}>
      <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .3s' }} />
    </div>
  )
}

function StatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: '#e89c3b', in_progress: '#5ca85c', completed: '#4a90d9', rated: '#999',
  }
  const labels: Record<string, string> = {
    pending: 'Pending', in_progress: 'In Progress', completed: 'Completed', rated: 'Rated',
  }
  const c = colors[status] ?? '#999'
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 600,
      padding: '2px 8px', borderRadius: 10, background: `${c}18`, color: c }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c }} />
      {labels[status] ?? status}
    </span>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [binStats, setBinStats] = useState<BinStats | null>(null)
  const [overflowBins, setOverflowBins] = useState<Bin[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [cleanerCount, setCleanerCount] = useState(0)
  const [recentTasks, setRecentTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [statsRes, binStatsRes, binsRes, blocksRes, usersRes, tasksRes] = await Promise.all([
        getTaskStats(),
        getBinStats(),
        getBins({ min_fill: 90 }),
        getBlocks(),
        getUsers({ role: 'cleaner', status: 'active' }),
        getTasks({ status: 'pending' }),
      ])
      setStats(statsRes.data as Stats)
      setBinStats(binStatsRes.data)
      setOverflowBins(binsRes.data)
      setBlocks(blocksRes.data)
      setCleanerCount(usersRes.data.length)
      setRecentTasks(tasksRes.data.slice(0, 8))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const id = setInterval(() => { void load() }, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  const getBinLocation = (bin: Bin) => {
    const block = blocks.find(b => b.id === bin.block_id)
    return { block: block?.name ?? `Block #${bin.block_id}`, detail: `Floor ${bin.floor} · Bin ${bin.bin_number}` }
  }

  const fmt = (s?: string | null) => s ? new Date(s).toLocaleString() : '—'

  if (loading) return <div style={{ padding: 40, color: '#999', textAlign: 'center' }}>Loading...</div>

  const statCards = [
    { label: 'Overflow Bins',   value: overflowBins.length, color: overflowBins.length > 0 ? '#d9534f' : '#5ca85c', sub: 'fill ≥ 90%' },
    { label: 'Pending Tasks',   value: stats?.pending ?? 0,     color: '#e89c3b', sub: 'awaiting cleaner' },
    { label: 'In Progress',     value: stats?.in_progress ?? 0, color: '#5ca85c', sub: 'being handled' },
    { label: 'Active Cleaners', value: cleanerCount,            color: '#4a90d9', sub: 'on duty' },
  ]

  return (
    <div style={{ fontFamily: '"Helvetica Neue",Helvetica,Arial,sans-serif' }}>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {statCards.map(({ label, value, color, sub }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: '#999', fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color, marginTop: 6, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 10.5, color: '#bbb', marginTop: 5 }}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>

        {/* Overflow alerts */}
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #ededed', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#5b9bd5' }}>Overflow Alerts</span>
              {overflowBins.length > 0 && (
                <span style={{ marginLeft: 8, fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#fbe9e8', color: '#d9534f' }}>
                  {overflowBins.length} bin{overflowBins.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <a onClick={() => navigate('/bins')} style={{ fontSize: 11, color: '#4a90d9', cursor: 'pointer' }}>View all →</a>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {overflowBins.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#5ca85c', fontSize: 13 }}>
                ✓ No overflow detected
              </div>
            ) : overflowBins.map(bin => {
              const loc = getBinLocation(bin)
              return (
                <div key={bin.id} style={{ padding: '10px 16px', borderBottom: '1px solid #f5f5f5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>{loc.block}</span>
                      <span style={{ fontSize: 11, color: '#999', marginLeft: 6 }}>{loc.detail}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#d9534f' }}>{bin.current_fill}%</span>
                  </div>
                  <FillBar pct={bin.current_fill} />
                  <div style={{ fontSize: 10, color: '#bbb', marginTop: 4, fontFamily: "'SF Mono',Consolas,monospace" }}>
                    {bin.sensor_id}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pending tasks */}
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #ededed', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#5b9bd5' }}>Pending Tasks</span>
            <a onClick={() => navigate('/tasks')} style={{ fontSize: 11, color: '#4a90d9', cursor: 'pointer' }}>View all →</a>
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {recentTasks.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#5ca85c', fontSize: 13 }}>
                ✓ No pending tasks
              </div>
            ) : recentTasks.map(task => {
              const taskLocation = task.bin
                ? (() => { const b = blocks.find(bl => bl.id === task.bin!.block_id); return `${b?.name ?? 'Block ?'} · Floor ${task.bin!.floor} · Bin ${task.bin!.bin_number}` })()
                : `Bin #${task.bin_id}`
              return (
                <div key={task.id} style={{ padding: '10px 16px', borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <b style={{ fontSize: 11.5, fontFamily: "'SF Mono',Consolas,monospace", color: '#555' }}>#{task.id}</b>
                      <StatusDot status={task.status} />
                    </div>
                    <div style={{ fontSize: 11, color: '#999' }}>{taskLocation}</div>
                  </div>
                  <div style={{ fontSize: 10.5, color: '#bbb', textAlign: 'right' }}>{fmt(task.created_at)}</div>
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 14 }}>
        {[
          { label: 'Total Tasks',  value: stats?.total ?? 0 },
          { label: 'Completed',    value: (stats?.completed ?? 0) + (stats?.rated ?? 0) },
          { label: 'Total Blocks', value: blocks.length },
        ].map(({ label, value }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#666' }}>{label}</span>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#333' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Bin status breakdown */}
      {binStats && (
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7, padding: '14px 18px', marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#999', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Bin Status — {binStats.total} total
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            {[
              { label: 'Normal',  value: binStats.normal,  color: '#5ca85c', bg: '#e9f3e9' },
              { label: 'Warning', value: binStats.warning, color: '#e89c3b', bg: '#fcf1e1' },
              { label: 'Full',    value: binStats.full,    color: '#d9534f', bg: '#fbe9e8' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} style={{ flex: 1, textAlign: 'center', padding: '10px 0', borderRadius: 6, margin: '0 4px', background: bg }}>
                <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
                <div style={{ fontSize: 10.5, color, fontWeight: 600, marginTop: 3 }}>{label}</div>
                <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>
                  {binStats.total > 0 ? Math.round(value / binStats.total * 100) : 0}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 12, fontSize: 11, color: '#bbb' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5ca85c', display: 'inline-block' }} />
        Auto-refresh every 30s
      </div>
    </div>
  )
}