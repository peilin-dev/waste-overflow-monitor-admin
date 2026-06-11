import { useCallback, useEffect, useState } from 'react'
import { message, Popconfirm } from 'antd'
import type { Block } from '@/types'
import { getBlocks, createBlock, updateBlock, deleteBlock } from '@/api'

export default function Blocks() {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState(true)
  const [editValues, setEditValues] = useState<Record<number, Partial<Block>>>({})

  const load = useCallback(async () => {
    try {
      const res = await getBlocks()
      setBlocks(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const totalBins = blocks.reduce((sum, b) => sum + b.total_floors * b.bins_per_floor, 0)

  const getValue = (block: Block, field: keyof Block) =>
    editValues[block.id]?.[field] ?? block[field]

  const setValue = (id: number, field: keyof Block, value: string | number) => {
    setEditValues(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const handleSave = async (block: Block) => {
    const changes = editValues[block.id]
    if (!changes) return
    try {
      await updateBlock(block.id, changes)
      message.success('Saved')
      setEditValues(prev => { const n = { ...prev }; delete n[block.id]; return n })
      setLoading(true)
      void load()
    } catch {
      // ignore
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteBlock(id)
      message.success('Block deleted')
      setLoading(true)
      void load()
    } catch {
      // ignore
    }
  }

  const handleAdd = async () => {
    try {
      await createBlock({ name: 'New Block', total_floors: 10, bins_per_floor: 2 })
      message.success('Block added')
      setLoading(true)
      void load()
    } catch {
      // ignore
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 32, border: '1px solid #e0e0e0', borderRadius: 5,
    padding: '0 11px', fontSize: 12, fontFamily: 'inherit', color: '#333',
    background: '#fff', outline: 'none',
  }

  if (loading) return <div style={{ padding: 40, color: '#999', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ fontFamily: '"Helvetica Neue",Helvetica,Arial,sans-serif' }}>
      {/* Section 1: System title */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#5b9bd5', padding: '12px 16px', borderBottom: '1px solid #ededed' }}>
          1. Project General Settings
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, padding: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, color: '#666', fontWeight: 500, marginBottom: 5 }}>System Title</label>
            <input style={inputStyle} defaultValue="Smart Waste Overflow Monitoring System" readOnly />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11.5, color: '#666', fontWeight: 500, marginBottom: 5 }}>Total Blocks (auto)</label>
            <input style={{ ...inputStyle, background: '#f7f8fa', color: '#999', cursor: 'not-allowed' }} value={blocks.length} readOnly />
          </div>
        </div>
      </div>

      {/* Section 2: Block table */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#5b9bd5', padding: '12px 16px', borderBottom: '1px solid #ededed' }}>
          2. Block & Floor Layout Configuration
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Block Name', 'Total Floors per Block', 'Bins per Floor', 'Actions'].map(h => (
                <th key={h} style={{ background: '#f7f8fa', fontSize: 11, fontWeight: 600, color: '#666', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid #ededed' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {blocks.map(block => {
              const dirty = !!editValues[block.id]
              return (
                <tr key={block.id}>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid #ededed' }}>
                    <input
                      style={inputStyle}
                      value={String(getValue(block, 'name'))}
                      onChange={e => setValue(block.id, 'name', e.target.value)}
                      onBlur={() => dirty && handleSave(block)}
                    />
                  </td>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid #ededed' }}>
                    <input
                      style={{ ...inputStyle, textAlign: 'center' }}
                      type="number" min={1} max={100}
                      value={String(getValue(block, 'total_floors'))}
                      onChange={e => setValue(block.id, 'total_floors', parseInt(e.target.value) || 1)}
                      onBlur={() => dirty && handleSave(block)}
                    />
                  </td>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid #ededed' }}>
                    <input
                      style={{ ...inputStyle, textAlign: 'center' }}
                      type="number" min={1} max={10}
                      value={String(getValue(block, 'bins_per_floor'))}
                      onChange={e => setValue(block.id, 'bins_per_floor', parseInt(e.target.value) || 1)}
                      onBlur={() => dirty && handleSave(block)}
                    />
                  </td>
                  <td style={{ padding: '10px 16px', borderBottom: '1px solid #ededed' }}>
                    <Popconfirm title="Delete this block?" onConfirm={() => handleDelete(block.id)} okText="Yes" cancelText="No">
                      <a style={{ color: '#d9534f', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Delete</a>
                    </Popconfirm>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div style={{ padding: '14px 16px', borderTop: '1px solid #ededed', display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={handleAdd} style={{
            background: '#fff', color: '#4a90d9', border: '1px dashed #4a90d9',
            borderRadius: 5, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer'
          }}>
            + Add Block
          </button>
          <span style={{ fontSize: 12, color: '#666' }}>
            Total bins in system: <b>{totalBins}</b> ({blocks.length} blocks)
          </span>
        </div>
      </div>
    </div>
  )
}