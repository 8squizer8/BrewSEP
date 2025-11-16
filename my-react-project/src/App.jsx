// frontend/src/App.jsx

import React from "react";
import { BrowserRouter, Routes, Route, Link, NavLink } from "react-router-dom";
import HomePage from "./HomePage";
import DistancePage from "./DistancePage";
import SolverPage from "./SolverPage";
import InstanciasPage from "./InstanciasPage"; // <-- 1. IMPORTAR A NOVA PÁGINA
import "./App.css";

// (O seu App.jsx pode parecer um pouco diferente,
// mas o importante são as <Routes>)

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        {/* Pode adicionar um menu de navegação aqui se quiser */}
        {/* <nav>
          <NavLink to="/">Home</NavLink>
          <NavLink to="/distances">Distâncias</NavLink>
          <NavLink to="/solver">Solver</NavLink>
          <NavLink to="/instancias">Cenários</NavLink>
        </nav>
        */}

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/distances" element={<DistancePage />} />
          <Route path="/solver" element={<SolverPage />} />
          {/* 2. ADICIONAR A NOVA ROTA */}
          <Route path="/instancias" element={<InstanciasPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;