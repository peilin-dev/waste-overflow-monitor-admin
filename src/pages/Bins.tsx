import { useCallback, useEffect, useState } from 'react'
import { Table, Button, Modal, Form, Input, InputNumber, Select, Popconfirm, message, Tag, Progress } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { Bin, Block } from '@/types'
import { getBins, createBin, updateBin, deleteBin, getBlocks } from '@/api'

const statusColor = { normal: 'green', warning: 'orange', full: 'red' }

export default function Bins() {
  const [bins, setBins] = useState<Bin[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
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

  const openEdit = (record: Bin) => {
    setEditing(record)
    form.setFieldsValue(record)
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
      setLoading(true)
      void load()
    } catch {
      // ignore
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteBin(id)
      message.success('Bin deleted')
      setLoading(true)
      void load()
    } catch {
      // ignore
    }
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: 'Block', dataIndex: 'block_id', width: 100,
      render: (v: number) => blocks.find(b => b.id === v)?.name || v
    },
    { title: 'Floor', dataIndex: 'floor', width: 80 },
    { title: 'Bin #', dataIndex: 'bin_number', width: 80 },
    { title: 'Sensor ID', dataIndex: 'sensor_id', width: 120 },
    {
      title: 'Fill Level', dataIndex: 'current_fill', width: 160,
      render: (v: number, r: Bin) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Progress percent={v} size="small" strokeColor={r.status === 'full' ? '#d9534f' : r.status === 'warning' ? '#e89c3b' : '#5ca85c'} style={{ width: 80, margin: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 700 }}>{v}%</span>
        </div>
      )
    },
    {
      title: 'Status', dataIndex: 'status', width: 100,
      render: (v: string) => <Tag color={statusColor[v as keyof typeof statusColor]}>{v.toUpperCase()}</Tag>
    },
    {
      title: 'Last Updated', dataIndex: 'last_updated', width: 160,
      render: (v: string) => v ? new Date(v).toLocaleString() : '—'
    },
    {
      title: 'Actions', width: 120,
      render: (_: unknown, r: Bin) => (
        <span style={{ display: 'flex', gap: 12 }}>
          <a onClick={() => openEdit(r)} style={{ color: '#4a90d9' }}><EditOutlined /> Edit</a>
          <Popconfirm title="Delete this bin?" onConfirm={() => handleDelete(r.id)} okText="Yes" cancelText="No">
            <a style={{ color: '#d9534f' }}><DeleteOutlined /> Delete</a>
          </Popconfirm>
        </span>
      )
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>Bins</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>Manage waste bins across all blocks</div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
          style={{ background: '#4a90d9', borderColor: '#4a90d9' }}>
          Add Bin
        </Button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7, overflow: 'hidden' }}>
        <Table
          dataSource={bins}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="middle"
        />
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