import { createBrowserRouter, Navigate } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Blocks from '@/pages/Blocks'
import Bins from '@/pages/Bins'
import Users from '@/pages/Users'
import Cleaners from '@/pages/Cleaners'
import Tasks from '@/pages/Tasks'

const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token')
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <PrivateRoute><MainLayout /></PrivateRoute>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'blocks', element: <Blocks /> },
      { path: 'bins', element: <Bins /> },
      { path: 'users', element: <Users /> },
      { path: 'cleaners', element: <Cleaners /> },
      { path: 'tasks', element: <Tasks /> },
    ],
  },
])

export default router