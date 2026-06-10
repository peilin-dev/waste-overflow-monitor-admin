import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

const NAV_MAIN = [
  {
    key: '/dashboard', label: 'Dashboard',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
  },
  {
    key: '/tasks', label: 'Tasks',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M3 7h18M3 12h18M3 17h12"/></svg>
  },
  {
    key: '/users', label: 'Employees',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/></svg>
  },
]

const NAV_SYSTEM = [
  {
    key: '/blocks', label: 'Blocks & Bins',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M3 21h18M5 21V7l8-4 8 4v14"/></svg>
  },
  {
    key: '/cleaners', label: 'Cleaner Assignment',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0M20 8l2 2-2 2M18 10h4"/></svg>
  },
]

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()

  const initials = user?.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'AD'

  const NavItem = ({ item }: { item: typeof NAV_MAIN[0] }) => {
    const active = location.pathname === item.key
    return (
      <div onClick={() => navigate(item.key)} style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px',
        borderRadius: 6, fontSize: 12.5, cursor: 'pointer', marginBottom: 2,
        fontWeight: active ? 600 : 500,
        color: active ? '#3a7bc0' : '#666',
        background: active ? '#eaf2fb' : 'transparent',
        transition: 'background .12s',
      }}
        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#f4f6f8' }}
        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        {item.icon}
        {item.label}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: '"Helvetica Neue",Helvetica,Arial,"Segoe UI",sans-serif', fontSize: 13 }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: '#fff', borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ padding: '18px 18px 16px', borderBottom: '1px solid #ededed', display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: '#4a90d9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
          </div>
          <div>
            <b style={{ fontSize: 12.5, fontWeight: 700, display: 'block', lineHeight: 1.2 }}>WasteMonitor</b>
            <span style={{ fontSize: 9.5, color: '#999' }}>Admin Console</span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '14px 12px', flex: 1, overflowY: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#999', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 8px 8px' }}>Main</div>
          {NAV_MAIN.map(item => <NavItem key={item.key} item={item} />)}
          <div style={{ fontSize: 10, fontWeight: 700, color: '#999', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '14px 8px 8px' }}>System</div>
          {NAV_SYSTEM.map(item => <NavItem key={item.key} item={item} />)}
        </nav>

        <div style={{ padding: '14px 18px', borderTop: '1px solid #ededed', fontSize: 10.5, color: '#999' }}>
          Admin Portal · v1.0
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <header style={{ height: 54, background: '#fff', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {[...NAV_MAIN, ...NAV_SYSTEM].find(n => n.key === location.pathname)?.label || 'Dashboard'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 32, height: 32, border: '1px solid #e0e0e0', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', cursor: 'pointer' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 6, background: '#4a90d9', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                {initials}
              </div>
              <div>
                <b style={{ fontSize: 12, display: 'block', lineHeight: 1.2 }}>{user?.name || user?.account}</b>
                <span style={{ fontSize: 10, color: '#999' }}>Administrator</span>
              </div>
            </div>
            <div onClick={() => { logout(); navigate('/login') }} style={{ cursor: 'pointer', color: '#d9534f', fontSize: 12, fontWeight: 500 }}>
              Logout
            </div>
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', background: '#f4f5f7' }}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}