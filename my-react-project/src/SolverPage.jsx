// frontend/src/SolverPage.jsx
// (Versão final com Totais e Botão para Cenários)

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './DistancePage.css';
import './SolverPage.css';

/**
 * Componente de Tabela do Solver (ATUALIZADO com Somas)
 */
function SolverTable({ title, type, data, distanceData, allocationData }) {
  // data = { row_headers, col_headers, row_capacities, col_capacities }
  
  if (!data || !data.col_headers || !data.row_headers) {
    return <p>A carregar dados da tabela...</p>;
  }

  const { row_headers, col_headers, row_capacities, col_capacities } = data;
  
  const capacityLabel = title.includes('Fábricas') ? "Capacidade Fábrica" : "Procura Cliente";
  
  // Define a fonte dos dados das células
  const cellData = (type === 'distance' && distanceData) ? distanceData : null;
  
  // --- LÓGICA DE CÁLCULO DE TOTAIS ---
  const isAllocation = type === 'allocation' && allocationData;
  let rowTotals = [];
  let colTotals = [];
  let grandTotal = 0;

  if (isAllocation) {
    // Calcular totais das linhas (Soma da produção/envio de cada Fábrica/Cliente)
    rowTotals = row_headers.map((_, r_index) => {
      if (!allocationData[r_index]) return 0;
      return allocationData[r_index].reduce((sum, val) => sum + (val || 0), 0);
    });
    
    // Calcular totais das colunas (Soma do que cada CD recebe)
    colTotals = col_headers.map((_, c_index) => {
      return allocationData.reduce((sum, row) => sum + (row[c_index] || 0), 0);
    });

    // Calcular o total geral
    grandTotal = rowTotals.reduce((sum, val) => sum + val, 0);
  }
  // --- FIM DA LÓGICA DE TOTAIS ---

  return (
    <div className="solver-table-container">
      <h3>{title}</h3>
      <table className="solver-table">
        <thead>
          {/* Linha 1: "Centros Distribuição" */}
          <tr>
            <th className="empty-corner" colSpan={2}></th>
            <th className="header-group" colSpan={col_headers.length}>Centros Distribuição</th>
            <th className="empty-corner" colSpan={isAllocation ? 2 : 1}></th> 
          </tr>
          {/* Linha 2: Nomes dos CDs + Novas Colunas */}
          <tr>
            <th className="empty-corner" colSpan={2}></th>
            {col_headers.map((name, index) => (
              <th className="col-header" key={index}>{name}</th>
            ))}
            {/* NOVA COLUNA DE SOMA (se for alocação) */}
            {isAllocation && (
              <th className="row-header-total cell-sum">Soma (Produção/Envio)</th>
            )}
            <th className="row-header-total">{capacityLabel}</th>
          </tr>
        </thead>
        <tbody>
          {/* Linhas de Dados (Fábricas ou Clientes) */}
          {row_headers.map((rowName, r_index) => (
            <tr key={r_index}>
              {r_index === 0 && (
                <th className="row-header-group" rowSpan={row_headers.length}>
                  {title.includes('Fábricas') ? 'Fábrica' : 'Cliente'}
                </th>
              )}
              <th className="row-header">{rowName}</th>
              
              {/* Células de Dados */}
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
              
              {/* NOVA CÉLULA DE SOMA DA LINHA */}
              {isAllocation && (
                <td className="cell-allocation cell-sum">
                  {rowTotals[r_index] < 0.1 ? '-' : rowTotals[r_index].toFixed(1)}
                </td>
              )}
              <td className="cell-capacity">
                {row_capacities && row_capacities[r_index]}
              </td>
            </tr>
          ))}
          
          {/* NOVA LINHA DE SOMA DAS COLUNAS */}
          {isAllocation && (
            <tr>
              <th className="row-header-total cell-sum" colSpan={2}>Soma (Recebido)</th>
              {colTotals.map((total, index) => (
                <td key={index} className="cell-allocation cell-sum">
                  {total < 0.1 ? '-' : total.toFixed(1)}
                </td>
              ))}
              <td className="cell-allocation cell-sum">
                {grandTotal < 0.1 ? '-' : grandTotal.toFixed(1)}
              </td>
              <td className="cell-capacity"></td> {/* Canto (vs Capacidade) */}
            </tr>
          )}

          {/* Linha de Capacidade dos CDs */}
          <tr>
            <th className="row-header-total" colSpan={2}>Capacidade CD's</th>
            {col_capacities && col_capacities.map((cap, index) => (
              <td key={index} className="cell-capacity">{cap}</td>
            ))}
            {isAllocation && <td className="cell-capacity"></td>} {/* Spacer da Soma */}
            <td className="cell-capacity"></td> {/* Canto final */}
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
  
  // --- ESTADOS PARA OS RESULTADOS ---
  const [solverRunning, setSolverRunning] = useState(false);
  const [solverResult, setSolverResult] = useState(null); // Guarda a resposta completa
  const [factoryAllocation, setFactoryAllocation] = useState(null);
  const [clientAllocation, setClientAllocation] = useState(null);
  const [dcDecisions, setDcDecisions] = useState(null);

  useEffect(() => {
    // Função para buscar os dados do backend
    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        // ATUALIZADO: A rota agora também devolve 'dc_fixed_costs'
        const response = await fetch("http://localhost:5000/get-solver-data");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Erro ao buscar dados');
        }
        setSolverData(data); // Guarda todos os dados (incluindo dc_fixed_costs)
        
      } catch (err) {
        console.error("Erro na API Fetch:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // --- FUNÇÃO PARA EXECUTAR O SOLVER (ATUALIZADA) ---
  const handleRunSolver = async () => {
    setSolverRunning(true);
    setSolverResult(null);
    setDcDecisions(null);
    setError('');
    
    try {
      const response = await fetch("http://localhost:5000/run-solver", {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao executar o solver');
      }
      setSolverResult(data);
      setFactoryAllocation(data.factory_allocation.matrix);
      setClientAllocation(data.client_allocation.matrix);
      setDcDecisions(data.dc_decisions);
      
      // --- NOVO: GUARDAR O CASO BASE PARA A PÁGINA DE CENÁRIOS ---
      // 'solverData' contém os inputs (agora com 'dc_fixed_costs')
      // 'data' contém os outputs
      if (data && solverData) {
        const baseCase = {
          inputs: solverData, // Os dados de input (distâncias, capacidades, custos fixos)
          results: { // Os resultados
            totalCost: data.total_cost_full,
            dcDecisions: data.dc_decisions
          }
        };
        // Limpa o sessionStorage antigo e guarda o novo
        sessionStorage.removeItem('brewsepBaseCase');
        sessionStorage.setItem('brewsepBaseCase', JSON.stringify(baseCase));
        console.log("Caso Base guardado no sessionStorage.");
      }
      // --- FIM DA MODIFICAÇÃO ---

    } catch (err)
 {
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
        {error && <p className="error-message" style={{fontSize: '1.1rem'}}>{error}</p>}
        {solverRunning && <p style={{color: 'white', fontSize: '1.1rem'}}>A calcular a solução ótima... (Isto pode demorar alguns segundos)</p>}

        {solverResult && !error && (
          <div className="result-card" style={{borderColor: '#1abc9c', color: 'white', backgroundColor: '#2a2a4e'}}>
            <h4>{solverResult.message}</h4>
            <p style={{margin: '0.5rem 0', fontSize: '1.1rem'}}>
              Custo Total da Rede (Transporte + Custo Fixo): 
              <strong style={{color: '#1abc9c'}}> € {solverResult.total_cost_full.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </p>
            
            {dcDecisions && (
              <div style={{marginTop: '1rem'}}>
                <strong>Decisões de Abertura dos CDs (Variável Yj):</strong>
                <ul style={{listStyleType: 'none', paddingLeft: '1rem', marginTop: '0.5rem'}}>
                  {Object.entries(dcDecisions).map(([name, status]) => (
                    <li key={name} style={{
                      color: status === 'Aberto' ? '#2ecc71' : '#e74c3c',
                      fontWeight: 500
                    }}>
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
            <SolverTable 
              title="Tabela 1: Custos de Transporte (Distância KM) - Fábricas para CDs"
              type="distance"
              data={solverData.factory_solver}
              distanceData={solverData.factory_distances}
            />
            
            <SolverTable 
              title="Tabela 2: Custos de Transporte (Distância KM) - Clientes para CDs"
              type="distance"
              data={solverData.client_solver}
              distanceData={solverData.client_distances}
            />
            
            <SolverTable 
              title="Tabela 3: Matriz de Alocação - Fábricas para CDs (Unidades)"
              type="allocation"
              data={solverData.factory_solver} 
              allocationData={factoryAllocation}
            />
            
            <SolverTable 
              title="Tabela 4: Matriz de Alocação - Clientes para CDs (Unidades)"
              type="allocation"
              data={solverData.client_solver}
              allocationData={clientAllocation}
            />
          </>
        )}
        
        <div className="button-group" style={{marginTop: 'auto', paddingTop: '2rem', flexDirection: 'row', justifyContent: 'space-between'}}>
          <Link to="/distances">
            <button>Voltar às Distâncias</button>
          </Link>
          
          {!loading && solverData && (
            <button 
              style={{backgroundColor: '#2ecc71', borderColor: '#2ecc71'}}
              onClick={handleRunSolver}
              disabled={solverRunning}
            >
              {solverRunning ? "A calcular..." : "Executar Solver (PuLP)"}
            </button>
          )}

          {/* NOVO BOTÃO PARA A PÁGINA DE CENÁRIOS */}
          {/* Só aparece depois de o solver ter corrido e guardado o caso base */}
          {solverResult && (
            <Link to="/instancias">
              <button style={{backgroundColor: '#3498db', borderColor: '#3498db'}}>
                Análise de Cenários
              </button>
            </Link>
          )}

        </div>
      </div>
    </div>
  );
}

export default SolverPage;