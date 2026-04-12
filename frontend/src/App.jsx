import { Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Home from './pages/Home'
import Manual from './pages/Manual'
import Results from './pages/Results'

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/"        element={<Home />} />
        <Route path="/manual"  element={<Manual />} />
        <Route path="/results" element={<Results />} />
      </Routes>
    </>
  )
}
