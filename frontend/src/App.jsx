import { Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import RequireAuth from './components/RequireAuth'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Garage from './pages/Garage'
import VehicleRegister from './pages/VehicleRegister'
import PartImport from './pages/PartImport'
import PartsSearch from './pages/PartsSearch'
import MyPage from './pages/MyPage'
import Synth from './pages/Synth'
import Community from './pages/Community'
import PostDetail from './pages/PostDetail'
import PostWrite from './pages/PostWrite'
import AdminLayout from './components/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminCompatibilities from './pages/admin/AdminCompatibilities'
import AdminPartConflicts from './pages/admin/AdminPartConflicts'
import AdminMembers from './pages/admin/AdminMembers'

function App() {
  return (
    <div className="flex min-h-screen flex-col bg-ridefit-bg text-ridefit-text">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/parts"
            element={
              <RequireAuth>
                <PartsSearch />
              </RequireAuth>
            }
          />
          <Route
            path="/garage"
            element={
              <RequireAuth>
                <Garage />
              </RequireAuth>
            }
          />
          <Route
            path="/garage/new"
            element={
              <RequireAuth>
                <VehicleRegister />
              </RequireAuth>
            }
          />
          <Route
            path="/parts/import"
            element={
              <RequireAuth>
                <PartImport />
              </RequireAuth>
            }
          />
          <Route
            path="/mypage"
            element={
              <RequireAuth>
                <MyPage />
              </RequireAuth>
            }
          />
          <Route
            path="/synth"
            element={
              <RequireAuth>
                <Synth />
              </RequireAuth>
            }
          />
          <Route path="/community" element={<Community />} />
          <Route path="/community/:postId" element={<PostDetail />} />
          <Route
            path="/community/new"
            element={
              <RequireAuth>
                <PostWrite />
              </RequireAuth>
            }
          />
          <Route
            path="/admin"
            element={
              <RequireAuth adminOnly>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="compatibilities" element={<AdminCompatibilities />} />
            <Route path="part-conflicts" element={<AdminPartConflicts />} />
            <Route path="members" element={<AdminMembers />} />
          </Route>
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
