import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './DistancePage.css';
import './SolverPage.css';

/**
 * Componente de Tabela do Solver
 */
function SolverTable({ title, type, data, distanceData, allocationData }) {
  if (!data || !data.col_headers || !data.row_headers) {
    return <p>A carregar dados da tabela...</p>;
  }

  const { row_headers, col_headers, row_capacities, col_capacities } = data;
  const capacityLabel = title.includes('Fábricas') ? "Capacidade Fábrica" : "Procura Cliente";
  const cellData = (type === 'distance' && distanceData) ? distanceData : null;
  const isAllocation = type === 'allocation' && allocationData;
  
  let rowTotals = [];
  let colTotals = [];
  let grandTotal = 0;

  if (isAllocation) {
    rowTotals = row_headers.map((_, r_index) => {
      if (!allocationData[r_index]) return 0;
      return allocationData[r_index].reduce((sum, val) => sum + (val || 0), 0);
    });
    colTotals = col_headers.map((_, c_index) => {
      return allocationData.reduce((sum, row) => sum + (row[c_index] || 0), 0);
    });
    grandTotal = rowTotals.reduce((sum, val) => sum + val, 0);
  }

  return (
    <div className="solver-table-container">
      <h3>{title}</h3>
      <table className="solver-table">
        <thead>
          <tr>
            <th className="empty-corner" colSpan={2}></th>
            <th className="header-group" colSpan={col_headers.length}>Centros Distribuição</th>
            <th className="empty-corner" colSpan={isAllocation ? 2 : 1}></th> 
          </tr>
          <tr>
            <th className="empty-corner" colSpan={2}></th>
            {col_headers.map((name, index) => (
              <th className="col-header" key={index}>{name}</th>
            ))}
            {isAllocation && <th className="row-header-total cell-sum">Soma</th>}
            <th className="row-header-total">{capacityLabel}</th>
          </tr>
        </thead>
        <tbody>
          {row_headers.map((rowName, r_index) => (
            <tr key={r_index}>
              {r_index === 0 && (
                <th className="row-header-group" rowSpan={row_headers.length}>
                  {title.includes('Fábricas') ? 'Fábrica' : 'Cliente'}
                </th>
              )}
              <th className="row-header">{rowName}</th>
              {col_headers.map((colName, c_index) => (
                <td key={c_index} className={
                  type === 'distance' ? 'cell-distance' :
                  (type === 'allocation' && isAllocation) ? 'cell-allocation' : 'cell-empty'
                }>
                  {
                    (type === 'distance' && cellData && cellData[r_index + 1]) 
                      ? (cellData[r_index + 1][c_index + 1] || 'N/A')
                    : (isAllocation && allocationData[r_index] && allocationData[r_index][c_index] != null)
                      ? (allocationData[r_index][c_index] < 0.1 ? '-' : allocationData[r_index][c_index].toFixed(1)) 
                      : ''
                  }
                </td>
              ))}
              {isAllocation && (
                <td className="cell-allocation cell-sum">
                  {rowTotals[r_index] < 0.1 ? '-' : rowTotals[r_index].toFixed(1)}
                </td>
              )}
              <td className="cell-capacity">{row_capacities && row_capacities[r_index]}</td>
            </tr>
          ))}
          {isAllocation && (
            <tr>
              <th className="row-header-total cell-sum" colSpan={2}>Soma (Recebido)</th>
              {colTotals.map((total, index) => (
                <td key={index} className="cell-allocation cell-sum">
                  {total < 0.1 ? '-' : total.toFixed(1)}
                </td>
              ))}
              <td className="cell-allocation cell-sum">{grandTotal < 0.1 ? '-' : grandTotal.toFixed(1)}</td>
              <td className="cell-capacity"></td>
            </tr>
          )}
          <tr>
            <th className="row-header-total" colSpan={2}>Capacidade CD's</th>
            {col_capacities && col_capacities.map((cap, index) => (
              <td key={index} className="cell-capacity">{cap}</td>
            ))}
            {isAllocation && <td className="cell-capacity"></td>}
            <td className="cell-capacity"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SolverPage() {
  const [solverData, setSolverData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [solverRunning, setSolverRunning] = useState(false);
  const [solverResult, setSolverResult] = useState(null);
  const [factoryAllocation, setFactoryAllocation] = useState(null);
  const [clientAllocation, setClientAllocation] = useState(null);
  const [dcDecisions, setDcDecisions] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch("https://brewsep.onrender.com/get-solver-data");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Erro ao buscar dados');
        setSolverData(data);
      } catch (err) {
        console.error("Erro na API Fetch:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleRunSolver = async () => {
    setSolverRunning(true);
    setSolverResult(null);
    setDcDecisions(null);
    setError('');
    
    try {
      const response = await fetch("https://brewsep.onrender.com/run-solver", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao executar o solver');
      
      setSolverResult(data);
      setFactoryAllocation(data.factory_allocation.matrix);
      setClientAllocation(data.client_allocation.matrix);
      setDcDecisions(data.dc_decisions);
      
      // --- LÓGICA NOVA: PRÉ-CALCULAR UTILIZAÇÕES ---
      if (data && solverData) {
        // 1. Utilização de Fábricas
        const factoryNames = solverData.factory_solver.row_headers;
        const factoryCaps = solverData.factory_solver.row_capacities.map(Number);
        const factoryMatrix = data.factory_allocation.matrix;

        const factoryUtilizations = factoryNames.map((name, i) => {
          const utilized = factoryMatrix[i].reduce((sum, val) => sum + (val || 0), 0);
          const capacity = factoryCaps[i] || 0;
          return {
            name,
            utilized,
            capacity,
            utilizationRate: capacity > 0 ? utilized / capacity : 0
          };
        });

        // 2. Utilização de CDs (Apenas Abertos)
        const dcNames = solverData.factory_solver.col_headers;
        const dcCaps = solverData.factory_solver.col_capacities.map(Number);
        const dcUtilizations = [];

        dcNames.forEach((name, j) => {
          const status = data.dc_decisions[name];
          if (status === 'Aberto') {
            // Soma da coluna J na matriz de fábricas (o que entra no CD)
            const utilized = factoryMatrix.reduce((sum, row) => sum + (row[j] || 0), 0);
            const capacity = dcCaps[j] || 0;
            dcUtilizations.push({
              name,
              utilized,
              capacity,
              utilizationRate: capacity > 0 ? utilized / capacity : 0
            });
          }
        });

        // 3. Guardar no sessionStorage com estrutura enriquecida
        const baseCase = {
          inputs: solverData,
          results: {
            totalCost: data.total_cost_full,
            dcDecisions: data.dc_decisions,
            // Guardamos as matrizes brutas porque a aba "Resposta" ainda precisa delas para listar rotas
            factory_allocation: data.factory_allocation,
            client_allocation: data.client_allocation,
            // Guardamos os dados pré-calculados para a aba "Agilidade"
            factoryUtilizations,
            dcUtilizations
          }
        };
        sessionStorage.removeItem('brewsepBaseCase');
        sessionStorage.setItem('brewsepBaseCase', JSON.stringify(baseCase));
        console.log("Caso Base (enriquecido) guardado no sessionStorage.");
      }
      // --- FIM DA LÓGICA NOVA ---

    } catch (err) {
      console.error("Erro na API Fetch (Solver):", err);
      setError(err.message);
    } finally {
      setSolverRunning(false);
    }
  };

  return (
    <div className="distance-page"> 
      <div className="sidebar-panel">
        <h2>Solver de Otimização (Modelo de Rede Unificado)</h2>
        {loading && <p style={{color: 'white'}}>A carregar dados do Solver...</p>}
        {error && <p className="error-message">{error}</p>}
        {solverRunning && <p style={{color: 'white'}}>A calcular a solução ótima...</p>}

        {solverResult && !error && (
          <div className="result-card" style={{borderColor: '#1abc9c', color: 'white', backgroundColor: '#2a2a4e'}}>
            <h4>{solverResult.message}</h4>
            <p style={{fontSize: '1.1rem'}}>
              Custo Total: <strong style={{color: '#1abc9c'}}>€ {solverResult.total_cost_full.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}</strong>
            </p>
            {dcDecisions && (
              <div style={{marginTop: '1rem'}}>
                <strong>CDs Abertos:</strong>
                <ul style={{listStyleType: 'none', paddingLeft: '1rem', marginTop: '0.5rem'}}>
                  {Object.entries(dcDecisions).map(([name, status]) => (
                    <li key={name} style={{color: status === 'Aberto' ? '#2ecc71' : '#e74c3c'}}>
                      {name}: {status}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        
        {!loading && !error && solverData && (
          <>
            <SolverTable title="Tabela 1: Distâncias Fábricas -> CDs" type="distance" data={solverData.factory_solver} distanceData={solverData.factory_distances} />
            <SolverTable title="Tabela 2: Distâncias Clientes -> CDs" type="distance" data={solverData.client_solver} distanceData={solverData.client_distances} />
            <SolverTable title="Tabela 3: Alocação Fábricas -> CDs" type="allocation" data={solverData.factory_solver} allocationData={factoryAllocation} />
            <SolverTable title="Tabela 4: Alocação Clientes -> CDs" type="allocation" data={solverData.client_solver} allocationData={clientAllocation} />
          </>
        )}
        
        <div className="button-group" style={{marginTop: 'auto', paddingTop: '2rem', flexDirection: 'row', justifyContent: 'space-between'}}>
          <Link to="/distances"><button>Voltar às Distâncias</button></Link>
          {!loading && solverData && (
            <button style={{backgroundColor: '#2ecc71', borderColor: '#2ecc71'}} onClick={handleRunSolver} disabled={solverRunning}>
              {solverRunning ? "A calcular..." : "Executar Solver (PuLP)"}
            </button>
          )}
          {solverResult && (
            <Link to="/instancias"><button style={{backgroundColor: '#3498db', borderColor: '#3498db'}}>Análise de Cenários</button></Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default SolverPage;