import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-950 overflow-x-hidden">
      <main className="max-w-lg mx-auto px-4 pt-6 pb-28 w-full">
        <Outlet />
      </main>
      <Navbar />
    </div>
  )
}
