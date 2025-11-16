// Substitua todo o conteúdo de: src/DistancePage.jsx

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; // Importar Link
import './DistancePage.css'; 

// Componente Tabela (sem alteração)
function DistanceTable({ title, data }) {
  if (!data || data.length <= 1) { 
    return (
      <div className="distance-table-container">
        <h3>{title}</h3>
        <p style={{color: '#aaa', fontStyle: 'italic'}}>
          Não há dados suficientes para esta tabela.
        </p>
      </div>
    );
  }
  const headers = data[0];
  const rows = data.slice(1);
  return (
    <div className="distance-table-container">
      <h3>{title}</h3>
      <table className="distance-table">
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={index}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DistancePage() {
  const [cdToFactories, setCdToFactories] = useState([]);
  const [cdToClients, setCdToClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dataSource, setDataSource] = useState(''); 

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      setDataSource('');
      try {
        const response = await fetch("http://localhost:5000/get-distance-matrix");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Erro ao buscar dados');
        }
        setCdToFactories(data.cd_to_factories);
        setCdToClients(data.cd_to_clients);
        setDataSource(data.source); 
      } catch (err) {
        console.error("Erro na API Fetch:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []); 

  return (
    <div className="distance-page">
      <div className="sidebar-panel">
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <h2>Matriz de Distâncias e Tempos (Rota de Condução)</h2>
          {dataSource && (
            <span style={{color: '#aaa', fontSize: '0.9rem', fontStyle: 'italic'}}>
              Dados fornecidos por: {dataSource === 'api' ? 'Google API (Tempo Real)' : 'Cache Local (Guardado)'}
            </span>
          )}
        </div>
        
        {loading && (
          <div style={{textAlign: 'center', padding: '3rem'}}>
            <p style={{color: 'white', fontSize: '1.2rem'}}>A calcular rotas...</p>
            <p style={{color: '#aaa'}}>(Isto pode demorar vários segundos na primeira vez...)</p>
          </div>
        )}
        {error && <p className="error-message" style={{fontSize: '1.1rem'}}>{error}</p>}
        
        {!loading && !error && (
          <>
            <DistanceTable 
              title="Centros de Distribuição (Origem) ➔ Fábricas (Destino)" 
              data={cdToFactories} 
            />
            <DistanceTable 
              title="Centros de Distribuição (Origem) ➔ Clientes (Destino)" 
              data={cdToClients} 
            />
          </>
        )}
        
        {/* --- BOTÕES ATUALIZADOS --- */}
        <div className="button-group" style={{marginTop: 'auto', paddingTop: '2rem', flexDirection: 'row', justifyContent: 'space-between'}}>
          <Link to="/">
            <button>Voltar ao Mapa (Home)</button>
          </Link>
          
          {/* --- NOVO BOTÃO --- */}
          {!loading && !error && (
            <Link to="/solver">
              <button style={{backgroundColor: '#2ecc71', borderColor: '#2ecc71'}}>
                Ir para o Solver
              </button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default DistancePage;