import { useEffect, useState } from 'react'
import { message, Popconfirm, Select, Modal, Form, Input } from 'antd'
import type { User, UserCreate } from '@/types'
import { getUsers, createUser, updateUser, deleteUser, resetPassword } from '@/api'

const roleColor = { admin: '#4a90d9', cleaner: '#5ca85c' }
const statusColor = { active: '#5ca85c', inactive: '#999' }
const shiftOptions = ['morning', 'evening', 'night']

export default function Users() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [resetModal, setResetModal] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [form] = Form.useForm()

  const load = async () => {
  setLoading(true)
  try {
    const params = roleFilter !== 'all' ? { role: roleFilter } : {}
    const res = await getUsers(params)
    setUsers(res.data)
  } finally {
    setLoading(false)
  }
}

  useEffect(() => { load() }, [roleFilter])

  const handleCreate = async () => {
    const values = await form.validateFields() as UserCreate
    try {
      await createUser(values)
      message.success('User created')
      setModalOpen(false)
      form.resetFields()
      load()
    } catch {}
  }

  const handleToggleStatus = async (user: User) => {
    try {
      await updateUser(user.id, { status: user.status === 'active' ? 'inactive' : 'active' })
      message.success('Status updated')
      load()
    } catch {}
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteUser(id)
      message.success('User deleted')
      load()
    } catch {}
  }

  const handleResetPassword = async () => {
    if (!resetModal || !newPassword) return
    try {
      await resetPassword(resetModal.id, newPassword)
      message.success('Password reset')
      setResetModal(null)
      setNewPassword('')
    } catch {}
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', height: 32, border: '1px solid #e0e0e0', borderRadius: 5,
    padding: '0 11px', fontSize: 12, fontFamily: 'inherit', color: '#333',
    background: '#fff', outline: 'none',
  }

  if (loading) return <div style={{ padding: 40, color: '#999', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ fontFamily: '"Helvetica Neue",Helvetica,Arial,sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7, marginBottom: 16 }}>
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
            <button onClick={() => { form.resetFields(); setModalOpen(true) }} style={{
              background: '#4a90d9', color: '#fff', border: 'none',
              borderRadius: 5, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}>
              + Add User
            </button>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Name', 'Username', 'Role', 'Zone', 'Shift', 'Phone', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ background: '#f7f8fa', fontSize: 11, fontWeight: 600, color: '#666', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid #ededed' }}>{h}</th>
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
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0
                    }}>
                      {user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <b style={{ fontSize: 12, fontWeight: 600, display: 'block' }}>{user.name}</b>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', fontSize: 12, color: '#666' }}>{user.username}</td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                  <span style={{
                    fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 11,
                    background: user.role === 'admin' ? '#eaf2fb' : '#e9f3e9',
                    color: roleColor[user.role]
                  }}>{user.role}</span>
                </td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', fontSize: 12, color: '#666' }}>{user.zone || '—'}</td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', fontSize: 12, color: '#666' }}>{user.shift || '—'}</td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed', fontSize: 12, color: '#666' }}>{user.phone || '—'}</td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                  <span style={{
                    fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 11,
                    background: user.status === 'active' ? '#e9f3e9' : '#eef0f2',
                    color: statusColor[user.status]
                  }}>{user.status}</span>
                </td>
                <td style={{ padding: '11px 16px', borderBottom: '1px solid #ededed' }}>
                  <span style={{ display: 'flex', gap: 12, fontSize: 11.5 }}>
                    <a onClick={() => handleToggleStatus(user)} style={{ color: user.status === 'active' ? '#d9534f' : '#5ca85c', cursor: 'pointer', fontWeight: 500 }}>
                    {user.status === 'active' ? 'Deactivate' : 'Restore'}
                    </a>
                    <a onClick={() => setResetModal(user)} style={{ color: '#e89c3b', cursor: 'pointer', fontWeight: 500 }}>Reset Pwd</a>
                    <Popconfirm title="Delete this user?" onConfirm={() => handleDelete(user.id)} okText="Yes" cancelText="No">
                      <a style={{ color: '#d9534f', cursor: 'pointer', fontWeight: 500 }}>Delete</a>
                    </Popconfirm>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

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
              <Select.Option value="admin">Admin</Select.Option>
              <Select.Option value="cleaner">Cleaner</Select.Option>
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