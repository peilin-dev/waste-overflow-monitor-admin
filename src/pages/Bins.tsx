import { useCallback, useEffect, useState } from 'react'
import { message, Popconfirm, Modal, Form, Input, InputNumber, Select } from 'antd'
import type { Bin, Block } from '@/types'
import { getBins, createBin, updateBin, deleteBin, getBlocks } from '@/api'

function FillBar({ pct, status }: { pct: number; status: string }) {
  const color = status === 'full' ? '#d9534f' : status === 'warning' ? '#e89c3b' : '#5ca85c'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 4, height: 6, overflow: 'hidden', minWidth: 70 }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: color, borderRadius: 4, transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 32 }}>{pct}%</span>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    normal:  { bg: '#e9f3e9', color: '#5ca85c' },
    warning: { bg: '#fcf1e1', color: '#e89c3b' },
    full:    { bg: '#fbe9e8', color: '#d9534f' },
  }
  const s = map[status] ?? map.normal
  return (
    <span style={{ fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 11, background: s.bg, color: s.color }}>
      {status.toUpperCase()}
    </span>
  )
}

export default function Bins() {
  const [bins, setBins]       = useState<Bin[]>([])
  const [blocks, setBlocks]   = useState<Block[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Bin | null>(null)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    try {
      const [binsRes, blocksRes] = await Promise.all([getBins(), getBlocks()])
      setBins(binsRes.data)
      setBlocks(blocksRes.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (bin: Bin) => {
    setEditing(bin)
    form.setFieldsValue(bin)
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    try {
      if (editing) {
        await updateBin(editing.id, values)
        message.success('Bin updated')
      } else {
        await createBin(values)
        message.success('Bin created')
      }
      setModalOpen(false)
      void load()
    } catch {
      // ignore
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteBin(id)
      message.success('Bin deleted')
      void load()
    } catch {
      // ignore
    }
  }

  const getBlockName = (block_id: number) => blocks.find(b => b.id === block_id)?.name ?? `#${block_id}`

  const fmt = (s?: string | null) => s ? new Date(s).toLocaleString() : '—'

  if (loading) return <div style={{ padding: 40, color: '#999', textAlign: 'center' }}>Loading...</div>

  const fullCount    = bins.filter(b => b.status === 'full').length
  const warningCount = bins.filter(b => b.status === 'warning').length

  return (
    <div style={{ fontFamily: '"Helvetica Neue",Helvetica,Arial,sans-serif' }}>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14, marginBottom: 14 }}>
        {[
          { label: 'Total Bins',    value: bins.length,    color: '#333' },
          { label: 'Full (≥ 90%)',  value: fullCount,      color: fullCount > 0 ? '#d9534f' : '#999' },
          { label: 'Warning (≥ 60%)', value: warningCount, color: warningCount > 0 ? '#e89c3b' : '#999' },
          { label: 'Normal',        value: bins.length - fullCount - warningCount, color: '#5ca85c' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7, padding: '14px 15px' }}>
            <div style={{ fontSize: 11, color: '#999' }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 7, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Table panel */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #ededed', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: '#5b9bd5' }}>All Bins</span>
            <span style={{ fontSize: 11, color: '#999', fontWeight: 400, marginLeft: 8 }}>{bins.length} records</span>
          </div>
          <button onClick={openCreate} style={{
            background: '#4a90d9', color: '#fff', border: 'none',
            borderRadius: 5, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            + Add Bin
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 700, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Block', 'Floor', 'Bin #', 'Sensor ID', 'Fill Level', 'Status', 'Last Updated', 'Actions'].map(h => (
                <th key={h} style={{ background: '#f7f8fa', fontSize: 11, fontWeight: 600, color: '#666', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid #ededed' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bins.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#999', fontSize: 13 }}>No bins found</td>
              </tr>
            ) : bins.map(bin => (
              <tr key={bin.id}>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', fontSize: 12, fontWeight: 600, color: '#333' }}>
                  {getBlockName(bin.block_id)}
                </td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', fontSize: 12, color: '#666' }}>
                  {bin.floor}
                </td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', fontSize: 12, color: '#666' }}>
                  {bin.bin_number}
                </td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                  <span style={{ fontSize: 11.5, fontFamily: "'SF Mono',Consolas,monospace", color: '#555' }}>
                    {bin.sensor_id}
                  </span>
                </td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', minWidth: 140 }}>
                  <FillBar pct={bin.current_fill} status={bin.status} />
                </td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                  <StatusBadge status={bin.status} />
                </td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', fontSize: 11.5, color: '#999' }}>
                  {fmt(bin.updated_at)}
                </td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                  <span style={{ display: 'flex', gap: 12, fontSize: 11.5 }}>
                    <a onClick={() => openEdit(bin)} style={{ color: '#4a90d9', cursor: 'pointer', fontWeight: 500 }}>Edit</a>
                    <Popconfirm title="Delete this bin?" onConfirm={() => handleDelete(bin.id)} okText="Yes" cancelText="No">
                      <a style={{ color: '#d9534f', cursor: 'pointer', fontWeight: 500 }}>Delete</a>
                    </Popconfirm>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div style={{ padding: '10px 16px', borderTop: '1px solid #ededed', fontSize: 11.5, color: '#999' }}>
          {bins.length} bin{bins.length !== 1 ? 's' : ''} total
        </div>
      </div>

      <Modal
        title={editing ? 'Edit Bin' : 'Add Bin'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editing ? 'Update' : 'Create'}
        okButtonProps={{ style: { background: '#4a90d9', borderColor: '#4a90d9' } }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="block_id" label="Block" rules={[{ required: true, message: 'Required' }]}>
            <Select placeholder="Select block" disabled={!!editing}>
              {blocks.map(b => <Select.Option key={b.id} value={b.id}>{b.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="floor" label="Floor" rules={[{ required: true }]}>
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="bin_number" label="Bin Number" rules={[{ required: true }]}>
            <InputNumber min={1} max={10} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sensor_id" label="Sensor ID" rules={[{ required: true, message: 'Required' }]}>
            <Input placeholder="e.g. #1051" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
