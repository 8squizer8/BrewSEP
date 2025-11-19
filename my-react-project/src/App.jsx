import React from "react";
import { BrowserRouter, Routes, Route, Link, NavLink } from "react-router-dom";
import HomePage from "./HomePage";
import DistancePage from "./DistancePage";
import SolverPage from "./SolverPage";
import InstanciasPage from "./InstanciasPage";
import PressupostosPage from "./PressupostosPage";
import KpiPage from "./KpiPage"; // <-- IMPORTAR KPI PAGE
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/distances" element={<DistancePage />} />
          <Route path="/solver" element={<SolverPage />} />
          <Route path="/instancias" element={<InstanciasPage />} />
          <Route path="/pressupostos" element={<PressupostosPage />} />
          
          {/* ROTA ATUALIZADA */}
          <Route path="/kpis" element={<KpiPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;