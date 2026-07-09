import { useCallback, useEffect, useState } from 'react'
import { message, Popconfirm } from 'antd'
import type { Block } from '@/types'
import { getBlocks, createBlock, updateBlock, deleteBlock } from '@/api'
import { useAuthStore } from '@/store/authStore'

export default function Blocks() {
  const { user: currentUser } = useAuthStore()
  const isLeader = currentUser?.role === 'leader'
  const [blocks, setBlocks]       = useState<Block[]>([])
  const [loading, setLoading]     = useState(true)
  const [saved, setSaved]         = useState<Block[]>([])   // snapshot for cancel
  const [drafts, setDrafts]       = useState<Record<number, Partial<Block>>>({})
  const [saving, setSaving]       = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await getBlocks()
      setBlocks(res.data)
      setSaved(res.data)
      setDrafts({})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const isDirty = Object.keys(drafts).length > 0

  const totalBins = blocks.reduce((sum, b) => {
    const floors = (drafts[b.id]?.total_floors as number | undefined) ?? b.total_floors
    const bpf    = (drafts[b.id]?.bins_per_floor as number | undefined) ?? b.bins_per_floor
    return sum + floors * bpf
  }, 0)

  const getValue = (block: Block, field: keyof Block) =>
    (drafts[block.id]?.[field] ?? block[field]) as string | number

  const setValue = (id: number, field: keyof Block, value: string | number) =>
    setDrafts(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await Promise.all(
        Object.entries(drafts).map(([id, changes]) =>
          updateBlock(Number(id), changes)
        )
      )
      message.success('Configuration saved')
      void load()
    } catch {
      // ignore — interceptor handles display
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setBlocks(saved)
    setDrafts({})
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteBlock(id)
      message.success('Block deleted')
      void load()
    } catch {
      // ignore
    }
  }

  const handleAdd = async () => {
    try {
      await createBlock({ name: 'New Block', total_floors: 10, bins_per_floor: 2 })
      message.success('Block added')
      void load()
    } catch {
      // ignore
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 32, border: '1px solid #e0e0e0', borderRadius: 5,
    padding: '0 11px', fontSize: 12, fontFamily: 'inherit', color: '#333',
    background: '#fff', outline: 'none', boxSizing: 'border-box',
  }

  if (loading) return <div style={{ padding: 40, color: '#999', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ fontFamily: '"Helvetica Neue",Helvetica,Arial,sans-serif' }}>

      {/* Section 1: System title */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7, marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#5b9bd5', padding: '12px 16px', borderBottom: '1px solid #ededed' }}>
          1. Project General Settings
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 18, padding: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, color: '#666', fontWeight: 500, marginBottom: 5 }}>System Title</label>
            <input style={{ ...inputStyle, background: '#f7f8fa', color: '#999', cursor: 'not-allowed' }}
              value="Smart Waste Overflow Monitoring System" readOnly />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, color: '#666', fontWeight: 500, marginBottom: 5 }}>Total Blocks (auto)</label>
            <input style={{ ...inputStyle, background: '#f7f8fa', color: '#999', cursor: 'not-allowed' }}
              value={blocks.length} readOnly />
          </div>
        </div>
      </div>

      {/* Section 2: Block table */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#5b9bd5', padding: '12px 16px', borderBottom: '1px solid #ededed' }}>
          2. Block &amp; Floor Layout Configuration
        </div>

        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Block Name', 'Total Floors per Block', 'Bins per Floor', 'Actions'].map(h => (
                <th key={h} style={{ background: '#f7f8fa', fontSize: 11, fontWeight: 600, color: '#666', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid #ededed' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {blocks.map(block => {
              const dirty = !!drafts[block.id]
              return (
                <tr key={block.id} style={{ background: dirty ? '#fffdf5' : undefined }}>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid #ededed' }}>
                    <input
                      style={inputStyle}
                      value={String(getValue(block, 'name'))}
                      onChange={e => setValue(block.id, 'name', e.target.value)}
                    />
                  </td>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid #ededed', width: 200 }}>
                    <input
                      style={{ ...inputStyle, textAlign: 'center' }}
                      type="number" min={1} max={100}
                      value={String(getValue(block, 'total_floors'))}
                      onChange={e => setValue(block.id, 'total_floors', parseInt(e.target.value) || 1)}
                    />
                  </td>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid #ededed', width: 180 }}>
                    <input
                      style={{ ...inputStyle, textAlign: 'center' }}
                      type="number" min={1} max={10}
                      value={String(getValue(block, 'bins_per_floor'))}
                      onChange={e => setValue(block.id, 'bins_per_floor', parseInt(e.target.value) || 1)}
                    />
                  </td>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid #ededed' }}>
                    {!isLeader && (
                      <Popconfirm title="Delete this block?" onConfirm={() => handleDelete(block.id)} okText="Yes" cancelText="No">
                        <a style={{ color: '#d9534f', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Delete</a>
                      </Popconfirm>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #ededed', display: 'flex', alignItems: 'center', gap: 14 }}>
          {!isLeader && (
            <button onClick={handleAdd} style={{
              background: '#fff', color: '#4a90d9', border: '1px dashed #4a90d9',
              borderRadius: 5, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>
              + Add Block
            </button>
          )}
          <span style={{ fontSize: 12, color: '#666' }}>
            Total bins in system: <b>{totalBins}</b> ({blocks.length} blocks)
          </span>
        </div>
      </div>

      {/* Save / Cancel */}
      {!isLeader && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
          <button
            onClick={handleCancel}
            disabled={!isDirty}
            style={{
              background: '#fff', color: isDirty ? '#666' : '#bbb',
              border: `1px solid ${isDirty ? '#d0d0d0' : '#e8e8e8'}`,
              borderRadius: 5, padding: '8px 18px', fontSize: 12.5, fontWeight: 500,
              cursor: isDirty ? 'pointer' : 'not-allowed',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            style={{
              background: isDirty ? '#4a90d9' : '#a8c8ef',
              color: '#fff', border: 'none',
              borderRadius: 5, padding: '8px 18px', fontSize: 12.5, fontWeight: 600,
              cursor: isDirty ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? 'Saving…' : 'Save Configuration'}
          </button>
        </div>
      )}

      <p style={{ fontSize: 11, color: '#bbb', marginTop: 10, lineHeight: 1.5 }}>
        The structure defined here determines what appears on the <b>Monitoring</b> page and what bins can generate overflow tasks.
      </p>
    </div>
  )
}
