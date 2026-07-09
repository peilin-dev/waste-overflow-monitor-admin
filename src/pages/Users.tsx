import { useCallback, useEffect, useState } from 'react'
import { message, Popconfirm, Select, Modal, Form, Input } from 'antd'
import type { User, UserCreate, Block, Role } from '@/types'
import {
  getUsers, createUser, updateUser, deleteUser, resetPassword,
  getBlocks, getCleanerBlocks, assignBlock, removeBlock, getRoles,
} from '@/api'
import { useAuthStore } from '@/store/authStore'

const roleColorMap: Record<string, string> = { admin: '#4a90d9', cleaner: '#5ca85c' }
const getRoleColor = (role: string) => roleColorMap[role.toLowerCase()] ?? '#8e69c9'
const getRoleBg = (role: string) => {
  const m: Record<string, string> = { admin: '#eaf2fb', cleaner: '#e9f3e9' }
  return m[role.toLowerCase()] ?? '#f0ebfa'
}
const statusColor = { active: '#5ca85c', inactive: '#999' }
const shiftOptions = ['morning', 'evening', 'night']

export default function Users() {
  const { user: currentUser } = useAuthStore()
  const isLeader = currentUser?.role === 'leader'
  const [users, setUsers] = useState<User[]>([])
  const [blocks, setBlocks] = useState<Block[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [assignments, setAssignments] = useState<Record<number, number[]>>({})
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [resetModal, setResetModal] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    try {
      const params = roleFilter !== 'all' ? { role: roleFilter } : {}
      const [usersRes, blocksRes, rolesRes] = await Promise.all([getUsers(params), getBlocks(), getRoles()])
      setUsers(usersRes.data)
      setBlocks(blocksRes.data)
      setRoles(rolesRes.data.filter(r => r.status === 'active'))

      const cleaners = usersRes.data.filter(u => u.role === 'cleaner')
      const map: Record<number, number[]> = {}
      await Promise.all(
        cleaners.map(async (c) => {
          const res = await getCleanerBlocks(c.id)
          map[c.id] = res.data.map((b: Block) => b.id)
        })
      )
      setAssignments(map)
    } finally {
      setLoading(false)
    }
  }, [roleFilter])

  useEffect(() => { void load() }, [load])

  const toggleBlock = async (cleaner: User, blockId: number) => {
    const assigned = (assignments[cleaner.id] || []).includes(blockId)
    try {
      if (assigned) {
        await removeBlock(cleaner.id, blockId)
      } else {
        await assignBlock(cleaner.id, blockId)
      }
      const res = await getCleanerBlocks(cleaner.id)
      setAssignments(prev => ({ ...prev, [cleaner.id]: res.data.map((b: Block) => b.id) }))
    } catch {
      // ignore
    }
  }

  const handleCreate = async () => {
    const values = await form.validateFields() as UserCreate
    try {
      await createUser(values)
      message.success('User created')
      setModalOpen(false)
      form.resetFields()
      void load()
    } catch {
      // ignore
    }
  }

  const handleToggleStatus = async (user: User) => {
    try {
      await updateUser(user.id, { status: user.status === 'active' ? 'inactive' : 'active' })
      message.success('Status updated')
      void load()
    } catch {
      // ignore
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteUser(id)
      message.success('User deleted')
      void load()
    } catch {
      // ignore
    }
  }

  const handleResetPassword = async () => {
    if (!resetModal || !newPassword) return
    try {
      await resetPassword(resetModal.id, newPassword)
      message.success('Password reset')
      setResetModal(null)
      setNewPassword('')
    } catch {
      // ignore
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 32, border: '1px solid #e0e0e0', borderRadius: 5,
    padding: '0 11px', fontSize: 12, fontFamily: 'inherit', color: '#333',
    background: '#fff', outline: 'none',
  }

  // Show assigned blocks column when cleaner rows are visible
  const showBlocksCol = roleFilter !== 'admin'

  const headers = [
    'Name', 'Username', 'Role', 'Zone', 'Shift', 'Phone', 'Status',
    ...(showBlocksCol ? ['Assigned Blocks'] : []),
    'Actions',
  ]

  if (loading) return <div style={{ padding: 40, color: '#999', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ fontFamily: '"Helvetica Neue",Helvetica,Arial,sans-serif' }}>
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7 }}>
        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #ededed', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#5b9bd5' }}>User Management</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {['all', 'admin', 'cleaner'].map(r => (
              <button key={r} onClick={() => setRoleFilter(r)} style={{
                fontSize: 11.5, fontWeight: 500, padding: '6px 14px', borderRadius: 14,
                background: roleFilter === r ? '#4a90d9' : '#fff',
                color: roleFilter === r ? '#fff' : '#666',
                border: `1px solid ${roleFilter === r ? '#4a90d9' : '#e0e0e0'}`,
                cursor: 'pointer',
              }}>
                {r === 'all' ? 'All' : r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
            {!isLeader && (
              <button onClick={() => { form.resetFields(); setModalOpen(true) }} style={{
                background: '#4a90d9', color: '#fff', border: 'none',
                borderRadius: 5, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>
                + Add User
              </button>
            )}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {headers.map(h => (
                <th key={h} style={{ background: '#f7f8fa', fontSize: 11, fontWeight: 600, color: '#666', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid #ededed' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} style={{ opacity: user.status === 'inactive' ? 0.55 : 1 }}>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', background: '#eaf2fb', color: '#3a7bc0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0,
                    }}>
                      {user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <b style={{ fontSize: 12, fontWeight: 600 }}>{user.name}</b>
                  </div>
                </td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', fontSize: 12, color: '#666' }}>{user.username}</td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                  <span style={{
                    fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 11,
                    background: getRoleBg(user.role),
                    color: getRoleColor(user.role),
                  }}>{user.role}</span>
                </td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', fontSize: 12, color: '#666' }}>{user.zone || '—'}</td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', fontSize: 12, color: '#666' }}>{user.shift || '—'}</td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', fontSize: 12, color: '#666' }}>{user.phone || '—'}</td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                  <span style={{
                    fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 11,
                    background: user.status === 'active' ? '#e9f3e9' : '#eef0f2',
                    color: statusColor[user.status],
                  }}>{user.status}</span>
                </td>

                {/* Assigned Blocks column — only when cleaner rows are visible */}
                {showBlocksCol && (
                  <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                    {user.role === 'cleaner' ? (
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {blocks.map(block => {
                          const isOn = (assignments[user.id] || []).includes(block.id)
                          return (
                            <button
                              key={block.id}
                              onClick={() => toggleBlock(user, block.id)}
                              style={{
                                fontSize: 11, fontWeight: 500, padding: '3px 9px', borderRadius: 4,
                                cursor: 'pointer', transition: 'all .12s',
                                background: isOn ? '#eaf2fb' : '#fff',
                                color: isOn ? '#3a7bc0' : '#999',
                                border: `1px solid ${isOn ? '#4a90d9' : '#e0e0e0'}`,
                              }}
                            >
                              {isOn && <span style={{ fontSize: 9, fontWeight: 700, marginRight: 3 }}>✓</span>}
                              {block.name}
                            </button>
                          )
                        })}
                        {blocks.length === 0 && <span style={{ fontSize: 11, color: '#ccc' }}>No blocks</span>}
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: '#ccc' }}>—</span>
                    )}
                  </td>
                )}

                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                  {!isLeader && (
                    <span style={{ display: 'flex', gap: 12, fontSize: 11.5 }}>
                      <a onClick={() => handleToggleStatus(user)} style={{ color: user.status === 'active' ? '#d9534f' : '#5ca85c', cursor: 'pointer', fontWeight: 500 }}>
                        {user.status === 'active' ? 'Deactivate' : 'Restore'}
                      </a>
                      <a onClick={() => setResetModal(user)} style={{ color: '#e89c3b', cursor: 'pointer', fontWeight: 500 }}>Reset Pwd</a>
                      <Popconfirm title="Delete this user?" onConfirm={() => handleDelete(user.id)} okText="Yes" cancelText="No">
                        <a style={{ color: '#d9534f', cursor: 'pointer', fontWeight: 500 }}>Delete</a>
                      </Popconfirm>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #ededed', fontSize: 11.5, color: '#999' }}>
          {users.length} user{users.length !== 1 ? 's' : ''} found
        </div>
      </div>

      {/* Add User Modal */}
      <Modal title="Add User" open={modalOpen} onOk={handleCreate} onCancel={() => setModalOpen(false)}
        okText="Create" okButtonProps={{ style: { background: '#4a90d9', borderColor: '#4a90d9' } }}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. John Carter" />
          </Form.Item>
          <Form.Item name="username" label="Username" rules={[{ required: true }]}>
            <Input placeholder="e.g. j.carter" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, min: 6 }]}>
            <Input.Password placeholder="Min 6 characters" />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true }]}>
            <Select placeholder="Select role">
              {roles.map(r => (
                <Select.Option key={r.id} value={r.name.toLowerCase()}>{r.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input placeholder="e.g. +1 555 0101" />
          </Form.Item>
          <Form.Item name="zone" label="Zone">
            <Input placeholder="e.g. Zone A" />
          </Form.Item>
          <Form.Item name="shift" label="Shift">
            <Select placeholder="Select shift" allowClear>
              {shiftOptions.map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal title={`Reset Password — ${resetModal?.name}`} open={!!resetModal}
        onOk={handleResetPassword} onCancel={() => { setResetModal(null); setNewPassword('') }}
        okText="Reset" okButtonProps={{ style: { background: '#e89c3b', borderColor: '#e89c3b' } }}>
        <div style={{ marginTop: 16 }}>
          <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 6 }}>New Password</label>
          <input style={inputStyle} type="password" placeholder="Min 6 characters"
            value={newPassword} onChange={e => setNewPassword(e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}
