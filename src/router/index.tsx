import { createBrowserRouter, Navigate } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import WorkStatus from '@/pages/WorkStatus'
import Blocks from '@/pages/Blocks'
import Bins from '@/pages/Bins'
import Users from '@/pages/Users'
import Tasks from '@/pages/Tasks'
import TaskScoring from '@/pages/TaskScoring'
import Roles from '@/pages/Roles'
import PrivateRoute from '@/components/PrivateRoute'

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <PrivateRoute><MainLayout /></PrivateRoute>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'work-status', element: <WorkStatus /> },
      { path: 'blocks', element: <Blocks /> },
      { path: 'bins', element: <Bins /> },
      { path: 'users', element: <Users /> },
      { path: 'tasks', element: <Tasks /> },
      { path: 'task-scoring', element: <TaskScoring /> },
      { path: 'roles', element: <Roles /> },
    ],
  },
])

export default router