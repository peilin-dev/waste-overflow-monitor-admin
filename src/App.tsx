import { RouterProvider } from 'react-router-dom'
import { App as AntApp } from 'antd'
import router from '@/router'

export default function App() {
  return (
    <AntApp>
      <RouterProvider router={router} />
    </AntApp>
  )
}