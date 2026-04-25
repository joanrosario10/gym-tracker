import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import DietLog from './pages/DietLog'
import DietForm from './pages/DietForm'
import Hydration from './pages/Hydration'
import Leaderboard from './pages/Leaderboard'
import Profile from './pages/Profile'
import Admin from './pages/Admin'
import Workouts from './pages/Workouts'
import WorkoutForm from './pages/WorkoutForm'
import Bmi from './pages/Bmi'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route path="/" element={<Dashboard />} />
            <Route path="/diet" element={<DietLog />} />
            <Route path="/diet/new" element={<DietForm />} />
            <Route path="/hydration" element={<Hydration />} />
            <Route path="/workouts" element={<Workouts />} />
            <Route path="/workouts/new" element={<WorkoutForm />} />
            <Route path="/bmi" element={<Bmi />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
