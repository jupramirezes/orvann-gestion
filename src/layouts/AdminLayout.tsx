import { Outlet } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import Sidebar from '../components/Sidebar'
import Topbar from '../components/Topbar'
import { AdminRealtimeNotifier } from '../components/AdminRealtimeNotifier'

export default function AdminLayout({ user }: { user: User | null }) {
  return (
    <div className="app-shell">
      <Sidebar user={user} />
      <div className="app-main">
        <Topbar />
        <main className="flex-1 overflow-y-auto min-w-0 px-6 py-6">
          <Outlet />
        </main>
      </div>
      <AdminRealtimeNotifier />
    </div>
  )
}
