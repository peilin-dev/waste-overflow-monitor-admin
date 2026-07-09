import { useCallback, useEffect, useState } from 'react'
import { message, Modal, Form, Input, InputNumber, Select, Popconfirm } from 'antd'
import type { Role, RoleCreate } from '@/types'
import { getRoles, createRole, updateRole, deactivateRole, restoreRole } from '@/api'
import { useAuthStore } from '@/store/authStore'

const avatarColors: Record<string, { bg: string; color: string }> = {
  Admin:   { bg: '#eaf2fb', color: '#3a7bc0' },
  Leader:  { bg: '#fbe9e8', color: '#d9534f' },
  Cleaner: { bg: '#fcf1e1', color: '#e89c3b' },
}
const defaultAvatarColor = { bg: '#eaf2fb', color: '#3a7bc0' }

const PersonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"/>
  </svg>
)

export default function Roles() {
  const { user: currentUser } = useAuthStore()
  const isLeader = currentUser?.role === 'leader'
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Role | null>(null)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    try {
      const res = await getRoles()
      setRoles(res.data)
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

  const openEdit = (role: Role) => {
    setEditing(role)
    form.setFieldsValue({
      name: role.name,
      description: role.description,
      access_level: role.access_level,
      permissions_count: role.permissions_count,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields() as RoleCreate
    try {
      if (editing) {
        await updateRole(editing.id, values)
        message.success('Role updated')
      } else {
        await createRole(values)
        message.success('Role created')
      }
      setModalOpen(false)
      void load()
    } catch {
      // ignore - interceptor handles error display
    }
  }

  const handleDeactivate = async (role: Role) => {
    try {
      await deactivateRole(role.id)
      message.success('Role deactivated')
      void load()
    } catch {
      // ignore
    }
  }

  const handleRestore = async (role: Role) => {
    try {
      await restoreRole(role.id)
      message.success('Role restored')
      void load()
    } catch {
      // ignore
    }
  }

  const totalRoles = roles.length
  const highPermRoles = roles.filter(r => r.access_level === 'High' || r.access_level === 'Medium').length
  const unassignedRoles = roles.filter(r => (r.assigned_users ?? 0) === 0).length
  const totalEmployees = roles.reduce((sum, r) => sum + (r.assigned_users ?? 0), 0)

  if (loading) return <div style={{ padding: 40, color: '#999', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ fontFamily: '"Helvetica Neue",Helvetica,Arial,sans-serif' }}>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14 }}>
        {[
          { label: 'Total System Roles',       value: totalRoles,    color: '#333' },
          { label: 'Highest Permission Roles',  value: highPermRoles, color: '#5ca85c' },
          { label: 'Unassigned Roles',          value: unassignedRoles, color: '#999' },
          { label: 'Role-based Employees',      value: totalEmployees, color: '#333' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7, padding: '14px 15px' }}>
            <div style={{ fontSize: 11, color: '#999' }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, marginTop: 7, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Roles table */}
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 7, marginTop: 16 }}>
        <div style={{ padding: '13px 16px', borderBottom: '1px solid #ededed', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: '#5b9bd5' }}>All Roles</span>
            <span style={{ fontSize: 11, color: '#999', fontWeight: 400, marginLeft: 8 }}>{roles.length} records</span>
          </div>
          {!isLeader && (
            <button
              onClick={openCreate}
              style={{ background: '#4a90d9', color: '#fff', border: 'none', borderRadius: 5, padding: '6px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}
            >
              + Add Role
            </button>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 750, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Role Name', 'Description', 'Access Level', 'Assigned Users', 'Permissions Count', 'Status', 'Actions'].map(h => (
                <th key={h} style={{ background: '#f7f8fa', fontSize: 11, fontWeight: 600, color: '#666', textAlign: 'left', padding: '10px 16px', borderBottom: '1px solid #ededed' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: 32, textAlign: 'center', color: '#999', fontSize: 13 }}>No roles found</td>
              </tr>
            ) : roles.map(role => {
              const av = avatarColors[role.name] ?? defaultAvatarColor
              const isInactive = role.status !== 'active'
              return (
                <tr key={role.id} style={{ opacity: isInactive ? 0.55 : 1 }}>
                  <td style={{ fontSize: 12, padding: '11px 16px', borderBottom: '1px solid #ededed', verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: isInactive ? '#eef0f2' : av.bg,
                        color: isInactive ? '#999' : av.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <PersonIcon />
                      </div>
                      <b style={{ fontSize: 12, fontWeight: 600 }}>{role.name}</b>
                    </div>
                  </td>
                  <td style={{ fontSize: 12, padding: '11px 16px', borderBottom: '1px solid #ededed', verticalAlign: 'middle', color: '#666', maxWidth: 240 }}>
                    {role.description || '—'}
                  </td>
                  <td style={{ fontSize: 12, padding: '11px 16px', borderBottom: '1px solid #ededed', verticalAlign: 'middle' }}>
                    {role.access_level}
                  </td>
                  <td style={{ fontSize: 12, padding: '11px 16px', borderBottom: '1px solid #ededed', verticalAlign: 'middle' }}>
                    {role.assigned_users ?? 0}
                  </td>
                  <td style={{ fontSize: 12, padding: '11px 16px', borderBottom: '1px solid #ededed', verticalAlign: 'middle' }}>
                    {role.permissions_count}
                  </td>
                  <td style={{ fontSize: 12, padding: '11px 16px', borderBottom: '1px solid #ededed', verticalAlign: 'middle' }}>
                    {isInactive ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 11, background: '#eef0f2', color: '#999' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#999', flexShrink: 0 }} />
                        Inactive
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 11, background: '#e9f3e9', color: '#5ca85c' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#5ca85c', flexShrink: 0 }} />
                        Active
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 12, padding: '11px 16px', borderBottom: '1px solid #ededed', verticalAlign: 'middle' }}>
                    {!isLeader && (isInactive ? (
                      <Popconfirm
                        title={`Restore role "${role.name}"?`}
                        description="Users assigned to this role will regain their access."
                        onConfirm={() => handleRestore(role)}
                        okText="Restore"
                        cancelText="Cancel"
                      >
                        <a style={{ color: '#4a90d9', fontSize: 11.5, fontWeight: 500, cursor: 'pointer' }}>Restore</a>
                      </Popconfirm>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <a onClick={() => openEdit(role)} style={{ color: '#4a90d9', fontSize: 11.5, fontWeight: 500, cursor: 'pointer' }}>Edit</a>
                        <span style={{ color: '#999', margin: '0 2px' }}>·</span>
                        <Popconfirm
                          title={`Deactivate role "${role.name}"?`}
                          description={`${role.assigned_users ?? 0} user(s) have this role. They will lose access until it is restored.`}
                          onConfirm={() => handleDeactivate(role)}
                          okText="Deactivate"
                          okButtonProps={{ danger: true }}
                          cancelText="Cancel"
                        >
                          <a style={{ color: '#d9534f', fontSize: 11.5, fontWeight: 500, cursor: 'pointer' }}>Deactivate</a>
                        </Popconfirm>
                      </span>
                    ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      <p style={{ fontSize: 11, color: '#bbb', marginTop: 12, lineHeight: 1.5 }}>
        Note: Assigning permissions to a role propagates those rights to all users with that role. Modifying permissions is effective immediately.
      </p>

      {/* Add / Edit modal */}
      <Modal
        title={editing ? 'Edit Role' : 'Add Role'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        okText={editing ? 'Save Changes' : 'Save Role'}
        okButtonProps={{ style: { background: '#4a90d9', borderColor: '#4a90d9' } }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#5b9bd5', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #ededed' }}>
            1. Role Information
          </div>
          <Form.Item name="name" label={<span style={{ fontSize: 11.5, fontWeight: 600 }}>Role Name <span style={{ color: '#d9534f' }}>*</span></span>}
            rules={[{ required: true, max: 50, message: 'Name is required.' }]}>
            <Input placeholder="e.g. Supervisor" />
          </Form.Item>
          <Form.Item name="description" label={<span style={{ fontSize: 11.5, fontWeight: 600 }}>Description</span>}
            rules={[{ max: 255, message: 'Max 255 chars.' }]}>
            <Input placeholder="Short description of what this role can do" />
          </Form.Item>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#5b9bd5', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #ededed', marginTop: 4 }}>
            2. Access &amp; Permissions
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="access_level" label={<span style={{ fontSize: 11.5, fontWeight: 600 }}>Access Level <span style={{ color: '#d9534f' }}>*</span></span>}
              rules={[{ required: true, message: 'Required' }]}>
              <Select placeholder="Select level">
                <Select.Option value="High">High</Select.Option>
                <Select.Option value="Medium">Medium</Select.Option>
                <Select.Option value="Low">Low</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="permissions_count" label={<span style={{ fontSize: 11.5, fontWeight: 600 }}>Permissions Count</span>}
              rules={[{ required: true, message: 'Required' }]}>
              <InputNumber min={0} max={999} style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
