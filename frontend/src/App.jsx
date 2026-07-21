import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Home from './pages/Home'
import Results from './pages/Results'
import GameDetail from './pages/GameDetail'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Profile from './pages/Profile'
import AdminDashboard from './pages/AdminDashboard'
import HardwareHierarchy from './pages/HardwareHierarchy'
import TestPC from './pages/TestPC'
import Trending from './pages/Trending'

export default function App() {
  return (
    <div className="app-container">
      {/* Decorative Character Wallpapers */}
      <div className="sidebar-wallpaper left-wallpaper" />
      <div className="sidebar-wallpaper right-wallpaper" />

      <div className="main-content-wrapper">
        <Header />
        <Routes>
          <Route path="/"        element={<Home />} />
          <Route path="/results" element={<Results />} />
          <Route path="/game/:gameId" element={<GameDetail />} />
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password"  element={<ResetPassword />} />
          <Route path="/profile"         element={<Profile />} />
          <Route path="/admin"    element={<AdminDashboard />} />
          <Route path="/hardware" element={<HardwareHierarchy />} />
          <Route path="/test-pc"  element={<TestPC />} />
          <Route path="/trending" element={<Trending />} />
        </Routes>
      </div>
    </div>
  )
}

