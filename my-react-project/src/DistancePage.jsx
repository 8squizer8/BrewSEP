// frontend/src/DistancePage.jsx
// (Versão com Gravação de Dados para KPIs)

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './DistancePage.css'; 

function DistanceTable({ title, data }) {
  if (!data || data.length <= 1) { 
    return (
      <div className="distance-table-container">
        <h3>{title}</h3>
        <p style={{color: '#aaa', fontStyle: 'italic'}}>Não há dados suficientes.</p>
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
          <tr>{headers.map((header, index) => <th key={index}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
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
        const response = await fetch("https://brewsep.onrender.com/get-distance-matrix");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Erro ao buscar dados');
        }
        setCdToFactories(data.cd_to_factories);
        setCdToClients(data.cd_to_clients);
        setDataSource(data.source); 
        
        // --- NOVO: Guardar dados "Ricos" (com texto de tempo) para a página de KPIs ---
        sessionStorage.setItem('brewsepDistanceMatrix', JSON.stringify(data));
        console.log("Dados de Distância/Tempo guardados no sessionStorage para uso nos KPIs.");

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
          <h2>Matriz de Distâncias e Tempos</h2>
          {dataSource && (
            <span style={{color: '#aaa', fontSize: '0.9rem', fontStyle: 'italic'}}>
              Fonte: {dataSource === 'api' ? 'Google API' : 'Cache'}
            </span>
          )}
        </div>
        
        {loading && (
          <div style={{textAlign: 'center', padding: '3rem'}}>
            <p style={{color: 'white'}}>A calcular rotas...</p>
          </div>
        )}
        {error && <p className="error-message">{error}</p>}
        
        {!loading && !error && (
          <>
            <DistanceTable title="CDs ➔ Fábricas" data={cdToFactories} />
            <DistanceTable title="CDs ➔ Clientes" data={cdToClients} />
          </>
        )}
        
        <div className="button-group" style={{marginTop: 'auto', paddingTop: '2rem', flexDirection: 'row', justifyContent: 'space-between'}}>
          <Link to="/"><button>Voltar ao Mapa</button></Link>
          {!loading && !error && (
            <Link to="/solver"><button style={{backgroundColor: '#2ecc71', borderColor: '#2ecc71'}}>Ir para o Solver</button></Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default DistancePage;