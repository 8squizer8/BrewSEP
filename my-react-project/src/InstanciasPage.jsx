// Substitua todo o conteúdo de: frontend/src/Instancias.jsx
// (Versão com atualização das colunas de capacidade/procura)

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './DistancePage.css'; // Reutiliza CSS
import './SolverPage.css';   // Reutiliza CSS
import './Instancias.css'; // CSS novo para esta página

// 1. Componente 'SolverTable' (Sem alteração)
function SolverTable({ title, type, data, distanceData, allocationData }) {
  if (!data || !data.col_headers || !data.row_headers) {
    return <p>A carregar dados da tabela...</p>;
  }
  const { row_headers, col_headers, row_capacities, col_capacities } = data;
  const capacityLabel = title.includes('Fábricas') ? "Capacidade Fábrica" : "Procura Cliente";
  const cellData = (type === 'distance' && distanceData) ? distanceData : null;
  const isAllocation = type ==='allocation' && allocationData;
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
            {isAllocation && (
              <th className="row-header-total cell-sum">Soma (Produção/Envio)</th>
            )}
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
              <td className="cell-capacity">
                {/* Aqui está a chave: 'row_capacities' vem da prop 'data' */}
                {row_capacities && row_capacities[r_index]}
              </td>
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
              <td className="cell-allocation cell-sum">
                {grandTotal < 0.1 ? '-' : grandTotal.toFixed(1)}
              </td>
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
// --- FIM DO SolverTable ---


// 2. COMPONENTE PRINCIPAL DA PÁGINA DE CENÁRIOS
function InstanciasPage() {
  const [baseCase, setBaseCase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [selectedScenario, setSelectedScenario] = useState('procura');

  // Parâmetros
  const [paramPercent, setParamPercent] = useState('');
  const [paramCustoTransporte, setParamCustoTransporte] = useState('0.13');
  const [paramCdForceMap, setParamCdForceMap] = useState({});
  const [paramFactoryMinUtil, setParamFactoryMinUtil] = useState({ factory: '', percent: '' });

  // Resultados
  const [scenarioResult, setScenarioResult] = useState(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  
  // --- ALTERAÇÃO AQUI ---
  // Novo estado para guardar os INPUTS modificados do cenário
  const [scenarioInputs, setScenarioInputs] = useState(null); 
  // --- FIM DA ALTERAÇÃO ---

  // Carregar o Caso Base
  useEffect(() => {
    try {
      const data = sessionStorage.getItem('brewsepBaseCase');
      if (!data) {
        setError('Não foi encontrado um "Caso Base". Por favor, execute o Solver na página anterior primeiro.');
        setLoading(false);
        return;
      }
      const parsedData = JSON.parse(data);
      setBaseCase(parsedData);
      setParamCustoTransporte(parsedData.inputs.transport_cost_per_km || 0.13);
      let initialCdMap = {};
      parsedData.inputs.factory_solver.col_headers.forEach(name => {
        initialCdMap[name] = 'auto';
      });
      setParamCdForceMap(initialCdMap);
      setLoading(false);
    } catch (err) {
      setError('Erro ao carregar o "Caso Base".');
      setLoading(false);
    }
  }, []);

  // --- LÓGICA DE EXECUÇÃO DO CENÁRIO ---
  const handleRunScenario = async () => {
    setScenarioLoading(true);
    setScenarioResult(null);
    setScenarioInputs(null); // <-- Limpar inputs antigos
    setError('');

    if (!baseCase) {
      setError('Caso Base não carregado.');
      setScenarioLoading(false);
      return;
    }

    const baseInputs = JSON.parse(JSON.stringify(baseCase.inputs));
    
    // 2. Preparar os dados base
    let final_supply_factory = baseInputs.factory_solver.row_capacities.map(Number);
    let final_demand_client = baseInputs.client_solver.row_capacities.map(Number);
    let final_capacity_dc = baseInputs.factory_solver.col_capacities.map(Number);
    let final_dc_fixed_cost_list = baseInputs.dc_fixed_costs.map(Number);
    
    // 3. Preparar os parâmetros
    let final_params = {
      transport_cost_per_km: baseInputs.transport_cost_per_km || 0.13,
      dc_force_map: {},
      factory_min_util_map: {}
    };

    const perc = parseFloat(paramPercent);

    // 4. Modificar os dados com base no cenário selecionado
    try {
      switch (selectedScenario) {
        case 'procura':
          if (isNaN(perc)) throw new Error('Valor percentual inválido.');
          final_demand_client = final_demand_client.map(d => d * (1 + perc / 100));
          break;
        case 'fabrica_cap':
          if (isNaN(perc)) throw new Error('Valor percentual inválido.');
          final_supply_factory = final_supply_factory.map(c => c * (1 + perc / 100));
          break;
        case 'cd_cap':
          if (isNaN(perc)) throw new Error('Valor percentual inválido.');
          final_capacity_dc = final_capacity_dc.map(c => c * (1 + perc / 100));
          break;
        case 'transporte':
          final_params.transport_cost_per_km = parseFloat(paramCustoTransporte);
          break;
        case 'sem_xl':
          final_params.dc_force_map["Munique XL"] = 0;
          final_params.dc_force_map["Avila XL"] = 0;
          break;
        case 'com_xl':
          final_params.dc_force_map["Munique XL"] = 1;
          final_params.dc_force_map["Avila XL"] = 1;
          break;
        case 'cd_force':
          Object.entries(paramCdForceMap).forEach(([name, state]) => {
            if (state !== 'auto') {
              final_params.dc_force_map[name] = parseInt(state);
            }
          });
          break;
        case 'factory_min_util':
          if (!paramFactoryMinUtil.factory || isNaN(parseFloat(paramFactoryMinUtil.percent))) {
            throw new Error('Fábrica ou percentagem inválida.');
          }
          final_params.factory_min_util_map[paramFactoryMinUtil.factory] = parseFloat(paramFactoryMinUtil.percent) / 100;
          break;
      }
    } catch (err) {
      setError(`Erro nos parâmetros: ${err.message}`);
      setScenarioLoading(false);
      return;
    }

    // 5. Construir o payload final para o solver
    const payload = {
      "costs_factory_dc": baseInputs.factory_distances,
      "costs_dc_client": baseInputs.client_distances,
      "supply_factory": final_supply_factory,
      "demand_client": final_demand_client,
      "capacity_dc": final_capacity_dc,
      "dc_fixed_cost_list": final_dc_fixed_cost_list,
      "factory_names": baseInputs.factory_solver.row_headers,
      "dc_names": baseInputs.factory_solver.col_headers,
      "transport_cost_per_km": final_params.transport_cost_per_km,
      "dc_force_map": final_params.dc_force_map,
      "factory_min_util_map": final_params.factory_min_util_map
    };

    // 6. Chamar a nova rota do backend
    try {
      const response = await fetch("http://localhost:5000/run-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao executar o cenário');
      }
      setScenarioResult(data); // Guardar os novos resultados
      
      // --- ALTERAÇÃO AQUI ---
      // Guardar os INPUTS que foram usados para este cálculo
      setScenarioInputs({
        factory_capacities: final_supply_factory,
        client_demands: final_demand_client,
        dc_capacities: final_capacity_dc
      });
      // --- FIM DA ALTERAÇÃO ---
      
    } catch (err) {
      console.error("Erro na API Fetch (Cenário):", err);
      setError(err.message);
    } finally {
      setScenarioLoading(false);
    }
  };

  // --- FUNÇÕES DE RENDERIZAÇÃO DOS INPUTS (Sem alteração) ---
  const renderScenarioInputs = () => {
    switch (selectedScenario) {
      case 'procura':
      case 'fabrica_cap':
      case 'cd_cap':
        return (
          <div className="scenario-input-group">
            <label>Alteração Percentual (ex: 20 ou -15):</label>
            <input 
              type="number" 
              value={paramPercent}
              onChange={(e) => setParamPercent(e.target.value)}
              placeholder="Ex: 20"
            />
          </div>
        );
      case 'transporte':
        return (
          <div className="scenario-input-group">
            <label>Novo Custo (€/km):</label>
            <input 
              type="number"
              step="0.01"
              value={paramCustoTransporte}
              onChange={(e) => setParamCustoTransporte(e.target.value)}
            />
          </div>
        );
      case 'sem_xl':
      case 'com_xl':
        return <p>Este cenário não requer parâmetros adicionais.</p>;
      
      case 'cd_force':
        return (
          <div className="scenario-input-group">
            <label>Forçar Estado dos CDs:</label>
            <div className="checkbox-grid">
              {Object.keys(paramCdForceMap).map(cdName => (
                <div key={cdName} className="radio-group">
                  <strong>{cdName}:</strong>
                  <label><input type="radio" name={cdName} value="auto" checked={paramCdForceMap[cdName] === 'auto'} onChange={() => setParamCdForceMap(prev => ({...prev, [cdName]: 'auto'}))} /> Auto</label>
                  <label><input type="radio" name={cdName} value="1" checked={paramCdForceMap[cdName] === '1'} onChange={() => setParamCdForceMap(prev => ({...prev, [cdName]: '1'}))} /> Forçar Aberto</label>
                  <label><input type="radio" name={cdName} value="0" checked={paramCdForceMap[cdName] === '0'} onChange={() => setParamCdForceMap(prev => ({...prev, [cdName]: '0'}))} /> Forçar Fechado</label>
                </div>
              ))}
            </div>
          </div>
        );
      case 'factory_min_util':
        return (
          <div className="scenario-input-group">
            <label>Fábrica:</label>
            <select value={paramFactoryMinUtil.factory} onChange={(e) => setParamFactoryMinUtil(prev => ({...prev, factory: e.target.value}))}>
              <option value="">-- Selecione uma fábrica --</option>
              {baseCase.inputs.factory_solver.row_headers.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <label>Utilização Mínima (%):</label>
            <input 
              type="number" 
              value={paramFactoryMinUtil.percent}
              onChange={(e) => setParamFactoryMinUtil(prev => ({...prev, percent: e.target.value}))}
              placeholder="Ex: 80"
            />
          </div>
        );
      default:
        return null;
    }
  };

  // --- RENDERIZAÇÃO PRINCIPAL ---
  if (loading) return <div className="distance-page"><p style={{color: 'white'}}>A carregar dados do Caso Base...</p></div>;
  if (error && !baseCase) {
    return (
      <div className="distance-page">
        <div className="sidebar-panel">
          <h2 style={{color: '#e74c3c'}}>Erro</h2>
          <p className="error-message" style={{fontSize: '1.1rem'}}>{error}</p>
          <Link to="/solver"><button>Voltar ao Solver</button></Link>
        </div>
      </div>
    );
  }
  
  const scenarioOptions = {
    'procura': 'Alteração da Procura',
    'fabrica_cap': 'Aumento da Capacidade das Fábricas',
    'cd_cap': 'Alteração das Capacidades dos Armazéns',
    'transporte': 'Alteração do Preço de Transporte por Km',
    'sem_xl': 'Cenário Sem Armazéns XL',
    'com_xl': 'Cenário Com os 2 Armazéns XL Abertos',
    'cd_force': 'Obrigação de Abertura/Encerramento de CDs',
    'factory_min_util': 'Garantir Utilização Mínima de Fábrica'
  };
  const baseTotalCost = baseCase.results.totalCost;

  // --- ALTERAÇÃO AQUI ---
  // Preparar os dados para as tabelas de resultados
  let scenarioFactoryData = null;
  let scenarioClientData = null;

  // Só preenche se o cenário tiver sido executado
  if (scenarioResult && scenarioInputs) {
    scenarioFactoryData = {
      ...baseCase.inputs.factory_solver,
      // Substitui as capacidades antigas pelas NOVAS
      row_capacities: scenarioInputs.factory_capacities,
      col_capacities: scenarioInputs.dc_capacities
    };
    scenarioClientData = {
      ...baseCase.inputs.client_solver,
      // Substitui as procuras antigas pelas NOVAS
      row_capacities: scenarioInputs.client_demands,
      col_capacities: scenarioInputs.dc_capacities
    };
  }
  // --- FIM DA ALTERAÇÃO ---

  return (
    <div className="distance-page"> 
      <div className="sidebar-panel" style={{maxWidth: '1400px'}}>
        <h2>Análise de Sensibilidade (Cenários)</h2>
        
        <div className="scenario-container">
          {/* Coluna 1: Controlos */}
          <div className="scenario-controls">
            <h3>Definições do Cenário</h3>
            <div className="result-card" style={{borderColor: '#aaa', backgroundColor: '#2a2a4e', padding: '1rem'}}>
              <h4>Solução Ótima (Base)</h4>
              <p style={{margin: '0', fontSize: '1.2rem', color: '#1abc9c', fontWeight: 'bold'}}>
                € {baseTotalCost.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <label htmlFor="scenario-select" style={{marginTop: '1rem'}}>1. Escolha um Cenário:</label>
            <select 
              id="scenario-select" 
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
            >
              {Object.entries(scenarioOptions).map(([key, value]) => (
                <option key={key} value={key}>{value}</option>
              ))}
            </select>
            <label style={{marginTop: '1rem'}}>2. Defina os Parâmetros:</label>
            {renderScenarioInputs()}
            <button 
              className="run-scenario-button"
              onClick={handleRunScenario}
              disabled={scenarioLoading}
            >
              {scenarioLoading ? "A Calcular Cenário..." : "Executar Cenário"}
            </button>
            {error && <p className="error-message" style={{fontSize: '1.1rem', marginTop: '1rem'}}>{error}</p>}
          </div>

          {/* Coluna 2: Resultados */}
          <div className="scenario-results">
            <h3>Resultados do Cenário</h3>
            {!scenarioResult && !scenarioLoading && (
              <p style={{color: '#aaa', fontStyle: 'italic', textAlign: 'center', marginTop: '4rem'}}>
                Execute um cenário para ver os resultados aqui.
              </p>
            )}
            {scenarioLoading && <p style={{color: 'white', fontSize: '1.1rem'}}>A calcular a solução ótima para o cenário...</p>}

            {/* ATUALIZADO: Verifica 'scenarioInputs' também */}
            {scenarioResult && scenarioInputs && (
              <>
                <div className="result-card" style={{borderColor: '#3498db', backgroundColor: '#2a2a4e', padding: '1rem'}}>
                  <h4>Nova Solução (Cenário)</h4>
                  <p style={{margin: '0', fontSize: '1.2rem', color: '#3498db', fontWeight: 'bold'}}>
                    € {scenarioResult.total_cost_full.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <div className="comparison">
                    <p>Diferença vs. Base:</p>
                    <span style={{
                      color: scenarioResult.total_cost_full > baseTotalCost ? '#e74c3c' : '#2ecc71',
                      fontWeight: 'bold'
                    }}>
                      {
                        (scenarioResult.total_cost_full - baseTotalCost).toLocaleString('pt-PT', { 
                          style: 'currency', 
                          currency: 'EUR',
                          signDisplay: 'always' 
                        })
                      }
                    </span>
                  </div>
                </div>
                
                {scenarioResult.dc_decisions && (
                  <div style={{marginTop: '1rem', color: 'white'}}>
                    <strong>Decisões dos CDs (Cenário):</strong>
                    <ul style={{listStyleType: 'none', paddingLeft: '1rem', marginTop: '0.5rem'}}>
                      {Object.entries(scenarioResult.dc_decisions).map(([name, status]) => (
                        <li key={name} style={{ color: status === 'Aberto' ? '#2ecc71' : '#e74c3c', fontWeight: 500 }}>
                          {name}: {status}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {/* ATUALIZADO: Passa os dados do cenário (com novas capacidades) */}
                <SolverTable 
                  title="Tabela 3 (Cenário): Alocação - Fábricas para CDs"
                  type="allocation"
                  data={scenarioFactoryData} 
                  allocationData={scenarioResult.factory_allocation.matrix}
                />
                
                {/* ATUALIZADO: Passa os dados do cenário (com novas procuras) */}
                <SolverTable 
                  title="Tabela 4 (Cenário): Alocação - Clientes para CDs"
                  type="allocation"
                  data={scenarioClientData}
                  allocationData={scenarioResult.client_allocation.matrix}
                />
              </>
            )}
          </div>
        </div>
        
        <div className="button-group" style={{marginTop: 'auto', paddingTop: '2rem', flexDirection: 'row'}}>
          <Link to="/solver">
            <button>Voltar ao Solver Principal</button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default InstanciasPage;