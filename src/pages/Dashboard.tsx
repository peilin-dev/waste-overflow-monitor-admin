import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTaskStats, getBins, getBlocks, getUsers, getTasks } from '@/api'
import type { Bin, Block, Task } from '@/types'

const POLL_MS = 30000

interface Stats { total: number; pending: number; in_progress: number; completed: number; rated: number }


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

const BinIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 18, height: 18, flexShrink: 0 }}>
    <rect x="6" y="7" width="12" height="14" rx="1"/>
    <rect x="3" y="5" width="18" height="2" rx="1"/>
    <rect x="9" y="3" width="6" height="2" rx="1"/>
  </svg>
)

function BinCell({ bin }: { bin: Bin | undefined }) {
  if (!bin) return <div style={{ width: 40, height: 40 }} />
  const color = bin.current_fill >= 90 ? '#d9534f' : bin.current_fill >= 60 ? '#e89c3b' : '#5ca85c'
  const bg    = bin.current_fill >= 90 ? '#fbe9e8' : bin.current_fill >= 60 ? '#fcf1e1' : '#e9f3e9'
  return (
    <div
      title={`${bin.sensor_id} — ${bin.current_fill}%`}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        padding: '4px 6px', borderRadius: 5, color, background: bg,
        minWidth: 38, cursor: 'default',
      }}
    >
      <BinIcon />
      <span style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}>{bin.current_fill}%</span>
    </div>
  )
}

function MonitorGrid({ blocks, allBins }: { blocks: Block[]; allBins: Bin[] }) {
  const stamp = new Date().toLocaleString()
  const fullBins    = allBins.filter(b => b.current_fill >= 90)
  const warningBins = allBins.filter(b => b.current_fill >= 60 && b.current_fill < 90)
  const normalBins  = allBins.filter(b => b.current_fill < 60)

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7, marginTop: 14 }}>
      {/* Title bar */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #ededed', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '.04em', color: '#2c3e50' }}>
          SMART WASTE OVERFLOW MONITORING SYSTEM
        </span>
        <span style={{ fontSize: 11, color: '#aab7b8' }}>🕘 {stamp}</span>
      </div>

      {/* Blocks grid */}
      <div style={{ padding: 14, overflowX: 'auto' }}>
        {blocks.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#aab7b8', padding: 32, fontSize: 13 }}>
            No blocks configured
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, minWidth: 'max-content' }}>
            {blocks.map(block => {
              const blockBins = allBins.filter(b => b.block_id === block.id)
              return (
                <div key={block.id} style={{ border: '1px solid #e0e0e0', borderRadius: 7, overflow: 'hidden', minWidth: 0 }}>
                  {/* Block header */}
                  <div style={{ background: '#f7f8fa', padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #ededed' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#5b9bd5" strokeWidth="2" style={{ width: 13, height: 13, flexShrink: 0 }}>
                      <path d="M3 21h18M5 21V7l8-4 8 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01"/>
                    </svg>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.03em', color: '#2c3e50', whiteSpace: 'nowrap' }}>
                      {block.name.toUpperCase()}
                    </span>
                  </div>

                  {/* Floors: top-down */}
                  {Array.from({ length: block.total_floors }, (_, i) => block.total_floors - i).map(floor => {
                    const floorBins = Array.from({ length: block.bins_per_floor }, (_, j) =>
                      blockBins.find(b => b.floor === floor && b.bin_number === j + 1)
                    )
                    return (
                      <div key={floor} style={{
                        display: 'flex', alignItems: 'center', gap: 5, padding: '3px 8px',
                        borderBottom: '1px solid #f5f5f5',
                        background: floor % 2 === 0 ? '#fafafa' : '#fff',
                      }}>
                        <span style={{ fontSize: 9.5, color: '#aab7b8', fontWeight: 700, letterSpacing: '.02em', minWidth: 24, flexShrink: 0 }}>
                          F{floor}
                        </span>
                        {floorBins.map((bin, idx) => (
                          <BinCell key={idx} bin={bin} />
                        ))}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer: summary + alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 12, padding: '12px 16px', borderTop: '1px solid #ededed' }}>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10, color: '#2c3e50' }}>System Summary</div>
          {[
            { label: 'TOTAL BINS',          value: allBins.length,      color: '#2c3e50' },
            { label: 'FULL BINS (RED)',      value: fullBins.length,    color: '#d9534f' },
            { label: 'WARNING BINS (YELLOW)', value: warningBins.length, color: '#e89c3b' },
            { label: 'NORMAL BINS (GREEN)', value: normalBins.length,   color: '#5ca85c' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ fontSize: 12, lineHeight: 2 }}>
              <b style={{ color }}>{label}:</b>
              <span style={{ color: '#566573', marginLeft: 6 }}>{value}</span>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10, color: '#d9534f' }}>ALERT</div>
          {fullBins.length === 0 ? (
            <p style={{ fontSize: 12, color: '#aab7b8' }}>No alerts at the moment.</p>
          ) : fullBins.map(b => {
            const block = blocks.find(bl => bl.id === b.block_id)
            return (
              <div key={b.id} style={{ fontSize: 12, color: '#d9534f', lineHeight: 1.9 }}>
                Alert: {block?.name ?? 'Block ?'} — Floor {b.floor} — Bin {b.bin_number} — FULL ({b.current_fill}%)
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats]           = useState<Stats | null>(null)
  const [allBins, setAllBins]       = useState<Bin[]>([])
  const [blocks, setBlocks]         = useState<Block[]>([])
  const [cleanerCount, setCleanerCount] = useState(0)
  const [recentTasks, setRecentTasks]   = useState<Task[]>([])
  const [loading, setLoading]       = useState(true)

  const load = useCallback(async () => {
    try {
      const [statsRes, binsRes, blocksRes, usersRes, tasksRes] = await Promise.all([
        getTaskStats(),
        getBins(),
        getBlocks(),
        getUsers({ role: 'cleaner', status: 'active' }),
        getTasks({ status: 'pending' }),
      ])
      setStats(statsRes.data as Stats)
      setAllBins(binsRes.data)
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

  const fmt = (s?: string | null) => s ? new Date(s).toLocaleString() : '—'

  if (loading) return <div style={{ padding: 40, color: '#999', textAlign: 'center' }}>Loading...</div>

  const overflowCount = allBins.filter(b => b.current_fill >= 90).length

  const statCards = [
    { label: 'Overflow Bins',   value: overflowCount,           color: overflowCount > 0 ? '#d9534f' : '#5ca85c', sub: 'fill ≥ 90%' },
    { label: 'Pending Tasks',   value: stats?.pending ?? 0,     color: '#e89c3b', sub: 'awaiting cleaner' },
    { label: 'In Progress',     value: stats?.in_progress ?? 0, color: '#5ca85c', sub: 'being handled' },
    { label: 'Active Cleaners', value: cleanerCount,            color: '#4a90d9', sub: 'on duty' },
  ]

  return (
    <div style={{ fontFamily: '"Helvetica Neue",Helvetica,Arial,sans-serif' }}>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {statCards.map(({ label, value, color, sub }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, color: '#999', fontWeight: 500 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color, marginTop: 6, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 10.5, color: '#bbb', marginTop: 5 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Building monitor */}
      <MonitorGrid blocks={blocks} allBins={allBins} />

      {/* Pending tasks */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7, marginTop: 14 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #ededed', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#5b9bd5' }}>Pending Tasks</span>
          <a onClick={() => navigate('/tasks')} style={{ fontSize: 11, color: '#4a90d9', cursor: 'pointer' }}>View all →</a>
        </div>
        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
          {recentTasks.length === 0 ? (
            <div style={{ padding: 28, textAlign: 'center', color: '#5ca85c', fontSize: 13 }}>✓ No pending tasks</div>
          ) : recentTasks.map(task => (
            <div key={task.id} style={{ padding: '10px 16px', borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <b style={{ fontSize: 11.5, fontFamily: "'SF Mono',Consolas,monospace", color: '#555' }}>#{task.id}</b>
                  <StatusDot status={task.status} />
                </div>
                <div style={{ fontSize: 11, color: '#999' }}>Bin #{task.bin_id}</div>
              </div>
              <div style={{ fontSize: 10.5, color: '#bbb' }}>{fmt(task.created_at)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 10, fontSize: 11, color: '#bbb' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5ca85c', display: 'inline-block' }} />
        Auto-refresh every 30s
      </div>
    </div>
  )
}
