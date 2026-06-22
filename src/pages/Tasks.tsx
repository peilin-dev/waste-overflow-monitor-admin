import { useCallback, useEffect, useState } from 'react'
import { message, Popconfirm, Modal, Select } from 'antd'
import type { Task, Block, User } from '@/types'
import { getTasks, getBlocks, getUsers, assignTask, deleteTask } from '@/api'

const POLL_MS = 15000

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; dot: string; label: string }> = {
    pending:     { bg: '#fcf1e1', color: '#e89c3b', dot: '#e89c3b', label: 'Pending' },
    in_progress: { bg: '#e9f3e9', color: '#5ca85c', dot: '#5ca85c', label: 'In Progress' },
    completed:   { bg: '#eaf2fb', color: '#3a7bc0', dot: '#4a90d9', label: 'Completed' },
    rated:       { bg: '#eef0f2', color: '#999',    dot: '#999',    label: 'Rated' },
  }
  const s = map[status] ?? map.pending
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 11, background: s.bg, color: s.color }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
        {s.label}
      </span>
      {status === 'pending' && (
        <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: '#fbe9e8', color: '#d9534f' }}>
          URGENT
        </span>
      )}
    </span>
  )
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [cleaners, setCleaners] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [assignModal, setAssignModal] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null })
  const [selectedCleaner, setSelectedCleaner] = useState<number | null>(null)
  const [assigning, setAssigning] = useState(false)

  const load = useCallback(async () => {
    try {
      const [tasksRes, blocksRes, cleanersRes] = await Promise.all([
        getTasks(),
        getBlocks(),
        getUsers({ role: 'cleaner', status: 'active' }),
      ])
      setTasks(tasksRes.data)
      setBlocks(blocksRes.data)
      setCleaners(cleanersRes.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // Auto-poll: sync with cleaner app activity every 15s
  useEffect(() => {
    const id = setInterval(() => { void load() }, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  const handleDelete = async (id: number) => {
    try {
      await deleteTask(id)
      message.success('Task deleted')
      void load()
    } catch {
      // ignore
    }
  }

  const handleAssign = async () => {
    if (!assignModal.task || !selectedCleaner) return
    setAssigning(true)
    try {
      await assignTask(assignModal.task.id, selectedCleaner)
      message.success('Task assigned')
      setAssignModal({ open: false, task: null })
      setSelectedCleaner(null)
      void load()
    } catch {
      // ignore
    } finally {
      setAssigning(false)
    }
  }

  const getBinLocation = (task: Task) => {
    if (!task.bin) return `Bin #${task.bin_id}`
    const block = blocks.find(bl => bl.id === task.bin!.block_id)
    return `${block?.name ?? 'Block ?'} · Floor ${task.bin.floor} · Bin ${task.bin.bin_number}`
  }

  const getSensorId = (task: Task) => task.bin?.sensor_id ?? '—'

  const getCleanerName = (task: Task) => {
    if (task.cleaner) return task.cleaner.name
    if (task.cleaner_id) return `Cleaner #${task.cleaner_id}`
    return null
  }

  const getLastUpdate = (t: Task) => t.rated_at ?? t.completed_at ?? t.accepted_at ?? t.created_at

  const fmt = (s?: string | null) => s ? new Date(s).toLocaleString() : '—'

  const filtered = statusFilter === 'all' ? tasks : tasks.filter(t => t.status === statusFilter)

  const stats = [
    { label: 'Total Tasks',  value: tasks.length,                                                   color: '#333' },
    { label: 'Pending',      value: tasks.filter(t => t.status === 'pending').length,                color: '#e89c3b' },
    { label: 'In Progress',  value: tasks.filter(t => t.status === 'in_progress').length,            color: '#5ca85c' },
    { label: 'Completed',    value: tasks.filter(t => t.status === 'completed' || t.status === 'rated').length, color: '#333' },
  ]

  const filters = [
    { key: 'all',         label: 'All' },
    { key: 'pending',     label: 'Pending' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'completed',   label: 'Completed' },
    { key: 'rated',       label: 'Rated' },
  ]

  if (loading) return <div style={{ padding: 40, color: '#999', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ fontFamily: '"Helvetica Neue",Helvetica,Arial,sans-serif' }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14 }}>
        {stats.map(({ label, value, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7, padding: '14px 15px' }}>
            <div style={{ fontSize: 11, color: '#999' }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 7, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Filter chips + live indicator */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 14 }}>
        {filters.map(({ key, label }) => (
          <button key={key} onClick={() => setStatusFilter(key)} style={{
            fontSize: 11.5, fontWeight: 500, padding: '6px 14px', borderRadius: 14,
            background: statusFilter === key ? '#4a90d9' : '#fff',
            color: statusFilter === key ? '#fff' : '#666',
            border: `1px solid ${statusFilter === key ? '#4a90d9' : '#e0e0e0'}`,
            cursor: 'pointer',
          }}>{label}</button>
        ))}
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#5ca85c', fontWeight: 500 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5ca85c', display: 'inline-block', animation: 'pulse 2s infinite' }} />
          Auto-refresh · 15s
        </span>
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7, marginTop: 14 }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid #ededed', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: '#5b9bd5' }}>All Tasks</span>
            <span style={{ fontSize: 11, color: '#999', fontWeight: 400, marginLeft: 8 }}>
              {filtered.length} of {tasks.length} shown
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 750, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Task ID', 'Bin Location', 'Status', 'Assigned To', 'Created', 'Last Update', 'Actions'].map(h => (
                <th key={h} style={{ background: '#f7f8fa', fontSize: 11, fontWeight: 600, color: '#666', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid #ededed' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#999', fontSize: 13 }}>
                  No tasks in this filter
                </td>
              </tr>
            ) : filtered.map(task => {
              const cleanerName = getCleanerName(task)
              return (
                <tr key={task.id}>
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                    <b style={{ fontFamily: "'SF Mono',Consolas,monospace", fontSize: 11.5 }}>#{task.id}</b>
                  </td>
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: '#333' }}>{getBinLocation(task)}</div>
                    <div style={{ fontSize: 10, color: '#999', marginTop: 2, fontFamily: "'SF Mono',Consolas,monospace" }}>
                      Sensor: {getSensorId(task)}
                    </div>
                  </td>
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                    <StatusBadge status={task.status} />
                  </td>
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                    {cleanerName ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: '50%', background: '#eaf2fb', color: '#3a7bc0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0,
                        }}>
                          {cleanerName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500 }}>{cleanerName}</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: '#999', fontStyle: 'italic' }}>— Unassigned —</span>
                    )}
                  </td>
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', fontSize: 11.5, color: '#999' }}>
                    {fmt(task.created_at)}
                  </td>
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', fontSize: 11.5, color: '#999' }}>
                    {fmt(getLastUpdate(task))}
                  </td>
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5 }}>
                      {task.status === 'rated' && (
                        <span style={{ color: '#e8a93b', fontWeight: 600, fontSize: 12 }}>★ {task.rating}</span>
                      )}
                      {task.status === 'pending' && !task.cleaner_id && (
                        <a
                          onClick={() => { setAssignModal({ open: true, task }); setSelectedCleaner(null) }}
                          style={{ color: '#5ca85c', cursor: 'pointer', fontWeight: 500 }}
                        >Assign</a>
                      )}
                      <Popconfirm title="Delete this task?" onConfirm={() => handleDelete(task.id)} okText="Yes" cancelText="No">
                        <a style={{ color: '#d9534f', cursor: 'pointer', fontWeight: 500 }}>Delete</a>
                      </Popconfirm>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      <p style={{ fontSize: 11, color: '#bbb', marginTop: 12, lineHeight: 1.5 }}>
        Tasks are auto-created when a bin's fill level exceeds 90%. Cleaners accept and report tasks from the mobile app; completed tasks appear in <b>Task Scoring</b> for the admin to rate.
      </p>

      <Modal
        title="Assign Task"
        open={assignModal.open}
        onOk={handleAssign}
        onCancel={() => { setAssignModal({ open: false, task: null }); setSelectedCleaner(null) }}
        okText="Assign"
        okButtonProps={{ disabled: !selectedCleaner, loading: assigning }}
      >
        <p style={{ marginBottom: 12, fontSize: 13, color: '#666' }}>
          Select a cleaner to assign{assignModal.task ? ` Task #${assignModal.task.id}` : ''} to:
        </p>
        <Select
          style={{ width: '100%' }}
          placeholder="Select cleaner..."
          value={selectedCleaner}
          onChange={setSelectedCleaner}
          options={cleaners.map(c => ({ value: c.id, label: c.name }))}
        />
      </Modal>
    </div>
  )
}
