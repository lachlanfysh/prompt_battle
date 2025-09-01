import React from 'react';
import { BrowserRouter as Router, Routes, Route, useParams, Navigate } from 'react-router-dom';
import PlayerInterface from './components/PlayerInterface';
import CentralDisplay from './components/CentralDisplay';
import AdminPanel from './components/AdminPanel';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/player/:playerId" element={<PlayerWrapper />} />
          <Route path="/display" element={<CentralDisplay />} />
        </Routes>
      </div>
    </Router>
  );
}

function PlayerWrapper() {
  const { playerId } = useParams();
  return <PlayerInterface playerId={playerId} />;
}

export default App;