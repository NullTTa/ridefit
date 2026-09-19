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
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
