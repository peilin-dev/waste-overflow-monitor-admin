import { useCallback, useEffect, useState } from 'react'
import { getUsers, getTasks, getBlocks } from '@/api'
import type { User, Task, Block } from '@/types'

const POLL_MS = 30000

type WorkState = 'On Duty' | 'Idle' | 'Offline'

interface CleanerRow {
  user: User
  workState: WorkState
  currentTask: string
  tasksDoneToday: number
}

function WorkBadge({ state }: { state: WorkState }) {
  const map = {
    'On Duty': { bg: '#e9f3e9', color: '#5ca85c', dot: '#5ca85c' },
    'Idle':    { bg: '#fcf1e1', color: '#e89c3b', dot: '#e89c3b' },
    'Offline': { bg: '#eef0f2', color: '#999',    dot: '#999'    },
  }
  const s = map[state]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600,
      padding: '3px 9px', borderRadius: 11, background: s.bg, color: s.color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
      {state}
    </span>
  )
}

export default function WorkStatus() {
  const [rows, setRows] = useState<CleanerRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [usersRes, tasksRes, blocksRes] = await Promise.all([
        getUsers({ role: 'cleaner' }),
        getTasks(),
        getBlocks(),
      ])

      const users: User[] = usersRes.data
      const tasks: Task[] = tasksRes.data
      const blocks: Block[] = blocksRes.data

      const todayStr = new Date().toDateString()

      const getTaskLocation = (task: Task) => {
        if (!task.bin) return `Bin #${task.bin_id}`
        const block = blocks.find(bl => bl.id === task.bin!.block_id)
        return `${block?.name ?? 'Block ?'} · Floor ${task.bin.floor} · Bin ${task.bin.bin_number}`
      }

      const result: CleanerRow[] = users.map(user => {
        const activeTask = tasks.find(t => t.cleaner_id === user.id && t.status === 'in_progress')
        const tasksDoneToday = tasks.filter(t => {
          if (t.cleaner_id !== user.id) return false
          const ts = t.completed_at ?? t.rated_at
          return ts && new Date(ts).toDateString() === todayStr
        }).length

        let workState: WorkState = 'Idle'
        if (user.status === 'inactive') workState = 'Offline'
        else if (activeTask) workState = 'On Duty'

        return {
          user,
          workState,
          currentTask: activeTask ? getTaskLocation(activeTask) : '—',
          tasksDoneToday,
        }
      })

      setRows(result)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    const id = setInterval(() => { void load() }, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  if (loading) return <div style={{ padding: 40, color: '#999', textAlign: 'center' }}>Loading...</div>

  const total = rows.length
  const onDuty = rows.filter(r => r.workState === 'On Duty').length
  const tasksDoneToday = rows.reduce((s, r) => s + r.tasksDoneToday, 0)
  const active = rows.filter(r => r.workState !== 'Offline').length

  return (
    <div style={{ fontFamily: '"Helvetica Neue",Helvetica,Arial,sans-serif' }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14 }}>
        {[
          { label: 'Total Cleaners',         value: total,          color: '#333' },
          { label: 'On Duty Now',             value: onDuty,         color: '#5ca85c' },
          { label: 'Tasks Completed Today',   value: tasksDoneToday, color: '#333' },
          { label: 'Active Accounts',         value: active,         color: '#4a90d9' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7, padding: '14px 15px' }}>
            <div style={{ fontSize: 11, color: '#999' }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 7, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7, marginTop: 16 }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid #ededed', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: '#5b9bd5' }}>Employee Status</span>
            <span style={{ fontSize: 11, color: '#999', fontWeight: 400, marginLeft: 8 }}>Live · {total} staff</span>
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#5ca85c', fontWeight: 500 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5ca85c', display: 'inline-block' }} />
            Auto-refresh · 30s
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 750, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Employee', 'Status', 'Current Task', 'Zone', 'Shift', 'Tasks Done Today', 'Last Seen'].map(h => (
                <th key={h} style={{ background: '#f7f8fa', fontSize: 11, fontWeight: 600, color: '#666', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid #ededed' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#999', fontSize: 13 }}>No cleaners found</td>
              </tr>
            ) : rows.map(({ user, workState, currentTask, tasksDoneToday: done }) => (
              <tr key={user.id} style={{ opacity: workState === 'Offline' ? 0.55 : 1 }}>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', background: '#eaf2fb', color: '#3a7bc0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>
                      {user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <b style={{ fontSize: 12, fontWeight: 600, display: 'block' }}>{user.name}</b>
                      <span style={{ fontSize: 10, color: '#999' }}>{user.username}</span>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                  <WorkBadge state={workState} />
                </td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', fontSize: 11.5, color: currentTask === '—' ? '#bbb' : '#333' }}>
                  {currentTask}
                </td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', fontSize: 12, color: '#666' }}>{user.zone || '—'}</td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', fontSize: 12, color: '#666' }}>{user.shift || '—'}</td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', fontSize: 13, fontWeight: 700, color: done > 0 ? '#5ca85c' : '#999' }}>
                  {done}
                </td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', fontSize: 11.5, color: '#999' }}>
                  {user.last_seen ? new Date(user.last_seen).toLocaleString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
