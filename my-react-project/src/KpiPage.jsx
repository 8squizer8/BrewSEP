import React, { useState } from 'react';
import { Link } from 'react-router-dom';

// Garante que estes ficheiros CSS existem na pasta src/
import './DistancePage.css'; 
import './KpiPage.css'; 

function KpiPage() {
  // Estado para controlar qual aba está ativa
  const [activeTab, setActiveTab] = useState('custos');

  // Função simples para renderizar o conteúdo placeholder
  const renderContent = () => {
    // Mapa de nomes para mostrar o título bonito
    const titulos = {
      fiabilidade: "Fiabilidade",
      resposta: "Capacidade de Resposta",
      agilidade: "Agilidade",
      custos: "Custos",
      ativos: "Ativos"
    };

    return (
      <div className="kpi-placeholder">
        <h3>{titulos[activeTab]}</h3>
        <div className="construction-icon">🚧</div>
        <p>A área de <strong>{titulos[activeTab]}</strong> está em desenvolvimento.</p>
        <small style={{color: '#777', marginTop: '1rem', display: 'block'}}>
          (A lógica de cálculo será implementada no próximo passo)
        </small>
      </div>
    );
  };

  return (
    <div className="distance-page">
      <div className="sidebar-panel" style={{maxWidth: '1200px'}}>
        <h2>Dashboard de Performance (Modelo SCOR)</h2>
        
        {/* MENU DE NAVEGAÇÃO (ABAS) */}
        <div className="kpi-nav">
          <button 
            className={activeTab === 'fiabilidade' ? 'active' : ''} 
            onClick={() => setActiveTab('fiabilidade')}
          >
            Fiabilidade
          </button>
          <button 
            className={activeTab === 'resposta' ? 'active' : ''} 
            onClick={() => setActiveTab('resposta')}
          >
            Capacidade de Resposta
          </button>
          <button 
            className={activeTab === 'agilidade' ? 'active' : ''} 
            onClick={() => setActiveTab('agilidade')}
          >
            Agilidade
          </button>
          <button 
            className={activeTab === 'custos' ? 'active' : ''} 
            onClick={() => setActiveTab('custos')}
          >
            Custos
          </button>
          <button 
            className={activeTab === 'ativos' ? 'active' : ''} 
            onClick={() => setActiveTab('ativos')}
          >
            Ativos
          </button>
        </div>

        {/* ÁREA DE CONTEÚDO */}
        <div className="kpi-content-area">
          {renderContent()}
        </div>

        {/* BOTÃO DE VOLTAR */}
        <div className="button-group" style={{marginTop: 'auto', paddingTop: '2rem', flexDirection: 'row'}}>
          <Link to="/pressupostos">
            <button>Voltar aos Pressupostos</button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default KpiPage;