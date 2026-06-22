import { useEffect, useState } from 'react'
import { Form, Input, Button, message } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { login } from '@/api'
import { useAuthStore } from '@/store/authStore'

export default function Login() {
  const navigate = useNavigate()
  const { setToken, setUser } = useAuthStore()
  const [form] = Form.useForm()
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const onFinish = async (values: { username: string; password: string }) => {
    try {
      const res = await login(values.username, values.password)
      setToken(res.data.access_token)
      setUser(res.data.user)
      message.success('Login successful')
      navigate('/dashboard')
    } catch {
      message.error('Invalid username or password')
    }
  }

  return (
    <div style={{
      height: '100vh', width: '100vw', position: 'relative', overflow: 'hidden',
      fontFamily: '"Helvetica Neue",Helvetica,Arial,sans-serif',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Background */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, #1a2a4a 0%, #2d4a7a 40%, #3a6aaa 70%, #4a90d9 100%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.05,
        backgroundImage: 'radial-gradient(circle at 20% 50%, #fff 1px, transparent 1px), radial-gradient(circle at 80% 20%, #fff 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* Left branding — desktop only */}
      {!isMobile && (
        <div style={{
          position: 'absolute', left: '8%', top: '50%', transform: 'translateY(-50%)',
          color: '#fff', maxWidth: 380,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.15)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>WasteMonitor</div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>Admin Console</div>
            </div>
          </div>
          <h2 style={{ fontSize: 30, fontWeight: 700, margin: '0 0 12px', lineHeight: 1.3 }}>
            Smart Community<br />Waste Management
          </h2>
          <p style={{ fontSize: 13.5, opacity: 0.8, lineHeight: 1.7, margin: '0 0 32px' }}>
            Monitor overflow incidents, dispatch cleaners,<br />and keep your community clean and efficient.
          </p>
          <div style={{ display: 'flex', gap: 24 }}>
            {[{ num: '5', label: 'Blocks' }, { num: '50+', label: 'Bins' }, { num: '24/7', label: 'Monitoring' }].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{s.num}</div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Login card */}
      <div style={{
        position: 'relative', zIndex: 1,
        ...(isMobile
          ? { width: '90%', maxWidth: 400, margin: '0 auto' }
          : { position: 'absolute', right: '8%', top: '50%', transform: 'translateY(-50%)', width: 360 }
        ),
        background: 'rgba(255,255,255,0.95)', borderRadius: 14,
        padding: isMobile ? '32px 24px 24px' : '36px 36px 28px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
      }}>
        {/* Mobile logo */}
        {isMobile && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, justifyContent: 'center' }}>
            <div style={{ width: 36, height: 36, background: '#4a90d9', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2, color: '#1a2a4a' }}>WasteMonitor</div>
              <div style={{ fontSize: 10, color: '#999' }}>Admin Console</div>
            </div>
          </div>
        )}

        <h3 style={{ fontSize: 19, fontWeight: 700, color: '#1a2a4a', margin: '0 0 4px' }}>Sign in</h3>
        <p style={{ fontSize: 12, color: '#888', margin: '0 0 24px' }}>Authorized personnel only</p>

        <Form form={form} onFinish={onFinish} layout="vertical">
          <Form.Item name="username" rules={[{ required: true, message: 'Please enter username' }]}>
            <Input prefix={<UserOutlined style={{ color: '#bbb' }} />} placeholder="Username" size="large"
              style={{ borderRadius: 7 }} />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: 'Please enter password' }]}>
            <Input.Password prefix={<LockOutlined style={{ color: '#bbb' }} />} placeholder="Password" size="large"
              style={{ borderRadius: 7 }} />
          </Form.Item>
          <Form.Item style={{ marginTop: 4 }}>
            <Button type="primary" htmlType="submit" block size="large" style={{
              borderRadius: 7, height: 44, fontWeight: 600, fontSize: 14,
              background: '#4a90d9', borderColor: '#4a90d9',
            }}>
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <p style={{ fontSize: 11, color: '#bbb', textAlign: 'center', marginTop: 8 }}>
          © 2025 WasteMonitor · Smart Community System
        </p>
      </div>
    </div>
  )
}