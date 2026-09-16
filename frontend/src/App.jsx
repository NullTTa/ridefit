import { Route, Routes } from 'react-router-dom'
import Header from './components/Header'
import Footer from './components/Footer'
import Home from './pages/Home'
import MyVehicleRegister from './pages/MyVehicleRegister'
import PartsSearch from './pages/PartsSearch'
import CompatibleParts from './pages/CompatibleParts'

function App() {
  return (
    <div className="flex min-h-screen flex-col bg-ridefit-bg-light text-ridefit-text-light dark:bg-ridefit-bg-dark dark:text-ridefit-text-dark">
      <Header />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/my-vehicle/new" element={<MyVehicleRegister />} />
          <Route path="/parts" element={<PartsSearch />} />
          <Route path="/my-vehicles/:myVehicleId/compatible-parts" element={<CompatibleParts />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}

export default App
