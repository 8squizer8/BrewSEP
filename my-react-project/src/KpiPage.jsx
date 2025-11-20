import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

// Importação dos estilos
import './DistancePage.css'; 
import './KpiPage.css'; 

function KpiPage() {
  const [activeTab, setActiveTab] = useState('resposta'); 
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // --- HELPER: PARSER DE TEMPO ---
  // Tenta extrair horas de strings como "140 km (1 hour 20 mins)"
  // Se falhar ou for apenas número, retorna 0 (Segurança)
  const parseTimeFromText = (val) => {
    if (!val) return 0;
    if (typeof val === 'number') return 0; // Utilizador pediu para NÃO calcular com base em Km (números)
    if (typeof val !== 'string') return 0;

    try {
      let hours = 0;
      let mins = 0;

      // Regex simples para capturar "X hour" e "Y min"
      const hourMatch = val.match(/(\d+)\s*(?:hour|hora|h)/i);
      const minMatch = val.match(/(\d+)\s*(?:min|m)/i);

      if (hourMatch) hours = parseInt(hourMatch[1], 10);
      if (minMatch) mins = parseInt(minMatch[1], 10);

      // Se não encontrou nada, retorna 0
      if (!hourMatch && !minMatch) return 0;

      return hours + (mins / 60);
    } catch (e) {
      return 0; // Fallback seguro
    }
  };

  // --- MOTOR DE CÁLCULO ---
  useEffect(() => {
    try {
      // 1. Carregar dados
      const solverDataRaw = sessionStorage.getItem('brewsepBaseCase');
      const assumptionsDataRaw = sessionStorage.getItem('brewsepKpiAssumptions');

      if (!solverDataRaw || !assumptionsDataRaw) {
        throw new Error("Dados insuficientes. Realize o fluxo: Solver -> Pressupostos.");
      }

      const solverData = JSON.parse(solverDataRaw);
      const assumptions = JSON.parse(assumptionsDataRaw);

      // Validação de Segurança: Garante que inputs/results existem, senão usa vazios
      const inputs = solverData.inputs || {};
      const results = solverData.results || {};

      // ---------------------------------------------
      // A. CÁLCULOS DE CUSTOS (SCOR: Cost)
      // ---------------------------------------------
      const totalCases = assumptions.totalDemandCases || 0; 
      const productionCostPerCase = assumptions.productionCost || 0;
      
      const costToMake = totalCases * productionCostPerCase;
      const costToDeliver = results.totalCost || 0;
      const totalSupplyChainCost = costToMake + costToDeliver;
      
      const sellingPrice = assumptions.sellingPrice || 0;
      const totalRevenue = totalCases * sellingPrice;
      const grossProfit = totalRevenue - totalSupplyChainCost;

      // ---------------------------------------------
      // B. CÁLCULOS DE AGILIDADE (SCOR: Agility)
      // ---------------------------------------------
      // Nota: Uso extensivo de || [] para evitar erros se dados faltarem
      const factoryNames = inputs.factory_solver?.row_headers || [];
      const rowCapacities = inputs.factory_solver?.row_capacities || [];
      const factoryCapacities = rowCapacities.map(Number);

      const dcNames = inputs.factory_solver?.col_headers || [];
      const colCapacities = inputs.factory_solver?.col_capacities || [];
      const dcCapacities = colCapacities.map(Number);
      const dcDecisions = results.dc_decisions || {}; 

      const factoryAllocation = results.factory_allocation || {};
      const factoryMatrix = factoryAllocation.matrix || [];

      // Make Adaptability
      const a_totalFactoryCap = factoryCapacities.reduce((sum, val) => sum + val, 0);
      let b_totalFactoryLoad = 0;
      if (factoryMatrix.length > 0) {
        b_totalFactoryLoad = factoryMatrix.reduce((sumRow, row) => 
          sumRow + (Array.isArray(row) ? row.reduce((sumCell, val) => sumCell + val, 0) : 0)
        , 0);
      }
      const makeAdaptability = b_totalFactoryLoad > 0 
        ? (a_totalFactoryCap - b_totalFactoryLoad) / b_totalFactoryLoad 
        : 0;

      // Deliver Adaptability
      let c_totalOpenDcCap = 0;
      dcNames.forEach((name, index) => {
        const status = dcDecisions[name];
        if (status === "Aberto" || status === 1 || status === "1") {
          c_totalOpenDcCap += (dcCapacities[index] || 0);
        }
      });
      const d_totalDcLoad = b_totalFactoryLoad;
      const deliverAdaptability = d_totalDcLoad > 0 
        ? (c_totalOpenDcCap - d_totalDcLoad) / d_totalDcLoad 
        : 0;

      const upsideAdaptability = Math.min(makeAdaptability, deliverAdaptability);

      // Utilização Detalhada (Tabelas)
      const factoryUtilizations = factoryNames.map((name, fIndex) => {
        const capacity = factoryCapacities[fIndex] || 0;
        let utilized = 0;
        if (factoryMatrix[fIndex] && Array.isArray(factoryMatrix[fIndex])) {
          utilized = factoryMatrix[fIndex].reduce((sum, val) => sum + val, 0);
        }
        const utilizationRate = capacity > 0 ? (utilized / capacity) : 0;
        return { name, utilized, capacity, utilizationRate };
      });

      const dcUtilizations = [];
      if (factoryMatrix.length > 0) { 
        dcNames.forEach((name, dcIndex) => {
          const status = dcDecisions[name];
          if (status === "Aberto" || status === 1 || status === "1") {
            const capacity = dcCapacities[dcIndex] || 0;
            let utilized = 0;
            for (let fIdx = 0; fIdx < factoryMatrix.length; fIdx++) {
              if (factoryMatrix[fIdx] && factoryMatrix[fIdx][dcIndex] !== undefined) {
                utilized += factoryMatrix[fIdx][dcIndex];
              }
            }
            const utilizationRate = capacity > 0 ? (utilized / capacity) : 0;
            dcUtilizations.push({ name, utilized, capacity, utilizationRate });
          }
        });
      }

      // ---------------------------------------------
      // C. CÁLCULOS DE FIABILIDADE (SCOR: Reliability)
      // ---------------------------------------------
      const pctComplete = 0.98;    
      const pctDamageFree = 0.95;  
      const pctOnTime = 0.97;      
      const perfectOrderFulfillment = pctComplete * pctDamageFree * pctOnTime;

      // ---------------------------------------------
      // D. CÁLCULOS DE ATIVOS (SCOR: Assets)
      // ---------------------------------------------
      const daysInventory = 14;  
      const daysReceivables = 60; 
      const daysPayables = 45;    
      const cashToCashCycle = daysInventory + daysReceivables - daysPayables;

      // ---------------------------------------------
      // E. CÁLCULOS DE RESPOSTA (SCOR: Responsiveness)
      // ---------------------------------------------
      const sourceCycleDays = 15; // Fixo
      const makeCycleDays = 21;   // Fixo
      
      // Dados Seguros
      const clientNames = inputs.client_solver?.row_headers || [];
      const clientDistancesMatrix = inputs.client_distances || []; // Pode conter Texto ou Numeros
      const clientAllocation = results.client_allocation || {};
      const clientAllocationMatrix = clientAllocation.matrix || [];

      // Tabela 1: Fábricas -> CDs
      const factoryToCdRoutes = [];
      // Tenta obter matriz de distância (pode ser numérica ou texto dependendo do backend)
      const factoryDistancesMatrix = inputs.factory_distances || [];

      factoryNames.forEach((fName, fIdx) => {
        dcNames.forEach((dcName, dcIdx) => {
          // Segurança: verifica se linha e celula existem
          const flow = (factoryMatrix[fIdx] && factoryMatrix[fIdx][dcIdx]) ? factoryMatrix[fIdx][dcIdx] : 0;
          
          if (flow > 0) {
            // Tenta obter o valor da célula de distância/tempo
            const rawVal = (factoryDistancesMatrix[fIdx] && factoryDistancesMatrix[fIdx][dcIdx]) 
                           ? factoryDistancesMatrix[fIdx][dcIdx] 
                           : 0;
            
            // Tenta extrair tempo. Se for nº ou null, devolve 0.
            const timeHours = parseTimeFromText(rawVal);
            
            factoryToCdRoutes.push({
              origin: fName,
              dest: dcName,
              time: timeHours,
              raw: rawVal // Para debug se necessário
            });
          }
        });
      });

      // Tabela 2: CDs -> Clientes (Base para Deliver Cycle Time)
      const cdToClientRoutes = [];
      let totalWeightedTime = 0;
      let totalDeliveredVolume = 0;

      clientNames.forEach((cName, cIdx) => {
        dcNames.forEach((dcName, dcIdx) => {
          // Segurança na leitura do fluxo
          const flow = (clientAllocationMatrix[cIdx] && clientAllocationMatrix[cIdx][dcIdx]) 
                       ? clientAllocationMatrix[cIdx][dcIdx] 
                       : 0;
          
          if (flow > 0) {
            // Segurança na leitura da distância/tempo
            const rawVal = (clientDistancesMatrix[cIdx] && clientDistancesMatrix[cIdx][dcIdx]) 
                           ? clientDistancesMatrix[cIdx][dcIdx] 
                           : 0;
            
            // Extrair tempo real (sem estimativa de 70km/h). Se não houver texto, dá 0.
            // Adiciona 4 horas fixas APENAS se tivermos conseguido ler algum tempo de viagem,
            // ou adiciona sempre? A lógica diz Tempo Viagem + 4h. 
            // Se viagem for 0 (dados em falta), assumimos 4h ou 0? 
            // Por segurança, se parseTime der 0, assumimos que dados falharam -> 0 total.
            let timeHours = parseTimeFromText(rawVal);
            
            if (timeHours > 0) {
                timeHours += 4; // Adiciona handling apenas se houver viagem válida
            } else {
                // Se a matriz tem apenas numeros (Km), o parse devolve 0.
                // O utilizador pediu segurança: "atribui valor 0".
                timeHours = 0; 
            }

            totalWeightedTime += (timeHours * flow);
            totalDeliveredVolume += flow;

            cdToClientRoutes.push({
              origin: dcName,
              dest: cName,
              time: timeHours,
              flow: flow,
              weight: 0 // Será calculado a seguir
            });
          }
        });
      });

      // Calcular Pesos Relativos
      cdToClientRoutes.forEach(route => {
        route.weight = totalDeliveredVolume > 0 ? (route.flow / totalDeliveredVolume) : 0;
      });

      // Deliver Cycle Time Final
      const avgDeliverHours = totalDeliveredVolume > 0 ? (totalWeightedTime / totalDeliveredVolume) : 0;
      const deliverCycleDays = avgDeliverHours / 24;

      // OFCT Final
      const ofct = sourceCycleDays + makeCycleDays + deliverCycleDays;

      // 4. Guardar tudo
      setMetrics({
        cost: {
          totalScmCost: totalSupplyChainCost,
          costToMake: costToMake,
          costToDeliver: costToDeliver,
          revenue: totalRevenue,
          grossProfit: grossProfit,
          cases: totalCases
        },
        agility: {
          upside: upsideAdaptability,
          make: makeAdaptability,
          deliver: deliverAdaptability,
          factoryCap: a_totalFactoryCap,
          factoryLoad: b_totalFactoryLoad,
          dcCap: c_totalOpenDcCap,
          dcLoad: d_totalDcLoad,
          factoryUtilizations: factoryUtilizations,
          dcUtilizations: dcUtilizations
        },
        reliability: {
          perfectOrder: perfectOrderFulfillment,
          complete: pctComplete,
          damageFree: pctDamageFree,
          onTime: pctOnTime
        },
        assets: {
          cashToCash: cashToCashCycle,
          daysInventory: daysInventory,
          daysReceivables: daysReceivables,
          daysPayables: daysPayables
        },
        responsiveness: {
          ofct: ofct,
          source: sourceCycleDays,
          make: makeCycleDays,
          deliver: deliverCycleDays,
          factoryRoutes: factoryToCdRoutes,
          clientRoutes: cdToClientRoutes
        }
      });

      setLoading(false);

    } catch (err) {
      console.error("Erro crítico na página de KPIs:", err);
      setError(err.message);
      setLoading(false);
    }
  }, []);

  // Helpers de formatação
  const fmtEuro = (val) => val ? val.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }) : '€ 0,00';
  const fmtDec = (val) => val ? val.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0,0';
  const fmtDec2 = (val) => val ? val.toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
  const fmtPct = (val) => val ? (val * 100).toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%' : '0%';
  const fmtNum = (val) => val ? val.toLocaleString('pt-PT', { maximumFractionDigits: 0 }) : '0';

  // --- RENDERIZAÇÃO DO CONTEÚDO ---
  const renderTabContent = () => {
    if (!metrics && !loading) return null;

    switch (activeTab) {
      case 'custos':
        return (
          <div className="kpi-grid fade-in">
            <div className="kpi-card main-card" style={{borderLeft: '5px solid #e74c3c'}}>
              <h3>Total Supply Chain Management Cost</h3>
              <div className="big-number danger">{fmtEuro(metrics.cost.totalScmCost)}</div>
              <p className="unit">Soma dos Custos de Produção e Entrega</p>
            </div>
            <div className="kpi-card">
              <h3>Cost to Make (Produção)</h3>
              <div className="medium-number warning">{fmtEuro(metrics.cost.costToMake)}</div>
              <div className="sub-detail"><span>Vol: {fmtNum(metrics.cost.cases)} cx</span></div>
            </div>
            <div className="kpi-card">
              <h3>Cost to Deliver (Logística)</h3>
              <div className="medium-number warning">{fmtEuro(metrics.cost.costToDeliver)}</div>
              <div className="sub-detail"><span>Transporte + Armazenagem</span></div>
            </div>
            <div className="kpi-card full-width">
              <h3>Distribuição de Custos da Cadeia</h3>
              <div className="progress-bar-container" style={{height: '35px'}}>
                <div className="progress-segment" style={{width: `${(metrics.cost.costToMake / metrics.cost.totalScmCost) * 100}%`, backgroundColor: '#f39c12'}}>
                  Make ({fmtDec((metrics.cost.costToMake / metrics.cost.totalScmCost) * 100)}%)
                </div>
                <div className="progress-segment" style={{width: `${(metrics.cost.costToDeliver / metrics.cost.totalScmCost) * 100}%`, backgroundColor: '#e74c3c'}}>
                  Deliver ({fmtDec((metrics.cost.costToDeliver / metrics.cost.totalScmCost) * 100)}%)
                </div>
              </div>
            </div>
          </div>
        );

      case 'agilidade':
        return (
          <div className="kpi-grid fade-in">
            <div className="kpi-card main-card" style={{borderLeft: '5px solid #3498db'}}>
              <h3>Upside Supply Chain Adaptability</h3>
              <div className="big-number success">{fmtPct(metrics.agility.upside)}</div>
              <p className="unit">Capacidade máxima de crescimento imediato</p>
              <small style={{color: '#aaa', display:'block', marginTop: '0.5rem'}}>
                Limitado por: {metrics.agility.make < metrics.agility.deliver ? "Produção (Make)" : "Armazenagem (Deliver)"}
              </small>
            </div>
            <div className="kpi-card">
              <h3>Make Adaptability</h3>
              <div className="medium-number">{fmtPct(metrics.agility.make)}</div>
              <div className="sub-detail"><span>Folga Fábricas</span></div>
              <div className="progress-bar-container" style={{height: '8px', backgroundColor: '#444', marginTop: '5px'}}>
                <div style={{width: `${(metrics.agility.factoryLoad / metrics.agility.factoryCap) * 100}%`, backgroundColor: '#f39c12'}}></div>
              </div>
            </div>
            <div className="kpi-card">
              <h3>Deliver Adaptability</h3>
              <div className="medium-number">{fmtPct(metrics.agility.deliver)}</div>
              <div className="sub-detail"><span>Folga CDs</span></div>
              <div className="progress-bar-container" style={{height: '8px', backgroundColor: '#444', marginTop: '5px'}}>
                <div style={{width: `${(metrics.agility.dcLoad / metrics.agility.dcCap) * 100}%`, backgroundColor: '#3498db'}}></div>
              </div>
            </div>
            <div className="kpi-card full-width table-card">
              <h3>Utilização de Fábricas</h3>
              <table className="kpi-table">
                <thead>
                  <tr><th>Fábrica</th><th>Utilizado</th><th>Capacidade</th><th>Taxa de Ocupação</th></tr>
                </thead>
                <tbody>
                  {metrics.agility.factoryUtilizations.map((factory, index) => (
                    <tr key={index}>
                      <td>{factory.name}</td>
                      <td>{fmtNum(factory.utilized)} cx</td>
                      <td>{fmtNum(factory.capacity)} cx</td>
                      <td className={factory.utilizationRate >= 0.9 ? 'high-utilization' : ''}>{fmtPct(factory.utilizationRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="kpi-card full-width table-card">
              <h3>Utilização de Centros de Distribuição (CDs Abertos)</h3>
              <table className="kpi-table">
                <thead>
                  <tr><th>CD</th><th>Utilizado</th><th>Capacidade</th><th>Taxa de Ocupação</th></tr>
                </thead>
                <tbody>
                  {metrics.agility.dcUtilizations.map((cd, index) => (
                    <tr key={index}>
                      <td>{cd.name}</td>
                      <td>{fmtNum(cd.utilized)} cx</td>
                      <td>{fmtNum(cd.capacity)} cx</td>
                      <td className={cd.utilizationRate >= 0.9 ? 'high-utilization' : ''}>{fmtPct(cd.utilizationRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case 'fiabilidade':
        return (
          <div className="kpi-grid fade-in">
            <div className="kpi-card main-card" style={{borderLeft: '5px solid #2ecc71'}}>
              <h3>Perfect Order Fulfillment</h3>
              <div className="big-number success">{fmtPct(metrics.reliability.perfectOrder)}</div>
              <p className="unit">Percentagem de pedidos perfeitos</p>
              <small style={{color: '#aaa', marginTop: '0.5rem', display:'block'}}>(Completos x Sem Danos x No Prazo)</small>
            </div>
            <div className="kpi-card">
              <h3>Entregas Completas</h3>
              <div className="medium-number">{fmtPct(metrics.reliability.complete)}</div>
            </div>
            <div className="kpi-card">
              <h3>Entregas Sem Danos</h3>
              <div className="medium-number">{fmtPct(metrics.reliability.damageFree)}</div>
            </div>
            <div className="kpi-card">
              <h3>Entregas No Prazo</h3>
              <div className="medium-number">{fmtPct(metrics.reliability.onTime)}</div>
            </div>
          </div>
        );

      case 'ativos':
        return (
          <div className="kpi-grid fade-in">
            <div className="kpi-card main-card" style={{borderLeft: '5px solid #9b59b6'}}>
              <h3>Cash-to-Cash Cycle Time</h3>
              <div className="big-number" style={{color: '#d2b4de'}}>{fmtNum(metrics.assets.cashToCash)} <span className="unit">dias</span></div>
              <p className="unit">Tempo de conversão de caixa</p>
              <small style={{color: '#aaa', marginTop: '0.5rem', display:'block'}}>(Inventário + Recebimento - Pagamento)</small>
            </div>
            <div className="kpi-card">
              <h3>Inventory Days of Supply</h3>
              <div className="medium-number warning">+ {fmtNum(metrics.assets.daysInventory)} <span className="unit">dias</span></div>
            </div>
            <div className="kpi-card">
              <h3>Dias de Recebimento</h3>
              <div className="medium-number warning">+ {fmtNum(metrics.assets.daysReceivables)} <span className="unit">dias</span></div>
            </div>
            <div className="kpi-card">
              <h3>Dias de Pagamento</h3>
              <div className="medium-number success">- {fmtNum(metrics.assets.daysPayables)} <span className="unit">dias</span></div>
            </div>
          </div>
        );

      case 'resposta':
        return (
          <div className="kpi-grid fade-in">
            
            {/* 1. O Grande KPI: Order Fulfillment Cycle Time */}
            <div className="kpi-card main-card" style={{borderLeft: '5px solid #f1c40f'}}>
              <h3>Order Fulfillment Cycle Time</h3>
              <div className="big-number" style={{color: '#f1c40f'}}>{fmtDec(metrics.responsiveness.ofct)} <span className="unit">dias</span></div>
              <p className="unit">Tempo total desde o pedido até à entrega</p>
              <small style={{color: '#aaa', marginTop: '0.5rem', display:'block'}}>
                (Source + Make + Deliver)
              </small>
            </div>

            <div className="kpi-card">
              <h3>Source Cycle Time</h3>
              <div className="medium-number">{fmtDec(metrics.responsiveness.source)} <span className="unit">dias</span></div>
              <p className="unit">Aprovisionamento</p>
            </div>

            <div className="kpi-card">
              <h3>Make Cycle Time</h3>
              <div className="medium-number">{fmtDec(metrics.responsiveness.make)} <span className="unit">dias</span></div>
              <p className="unit">Produção</p>
            </div>

            <div className="kpi-card">
              <h3>Deliver Cycle Time</h3>
              <div className="medium-number warning">{fmtDec2(metrics.responsiveness.deliver)} <span className="unit">dias</span></div>
              <p className="unit">Logística (ponderada por volume)</p>
            </div>

            {/* TABELA 1: CD -> Cliente (Base de Cálculo) */}
            <div className="kpi-card full-width table-card">
              <h3>Tabela 2: Rotas de Entrega (CDs para Clientes) - Base de Cálculo</h3>
              <p style={{padding: '0 1rem', fontSize: '0.8rem', color:'#aaa'}}>
                Valores de tempo reais extraídos da tabela de distâncias. (+4h handling).
                {metrics.responsiveness.deliver === 0 && " (⚠️ Dados de tempo não disponíveis ou em formato numérico)"}
              </p>
              <table className="kpi-table">
                <thead>
                  <tr>
                    <th>Origem (CD)</th>
                    <th>Destino (Cliente)</th>
                    <th>Tempo Total (Horas)</th>
                    <th>Peso Relativo (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.responsiveness.clientRoutes.length === 0 ? (
                     <tr><td colSpan="4" style={{textAlign: 'center', color: '#888'}}>Nenhuma rota ativa ou dados indisponíveis.</td></tr>
                  ) : (
                    metrics.responsiveness.clientRoutes.map((route, index) => (
                      <tr key={index}>
                        <td>{route.origin}</td>
                        <td>{route.dest}</td>
                        <td>{route.time > 0 ? fmtDec(route.time) + ' h' : 'N/A (0)'}</td>
                        <td>{fmtPct(route.weight)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

             {/* TABELA 2: Fábrica -> CD (Informativa) */}
             <div className="kpi-card full-width table-card" style={{opacity: 0.8}}>
              <h3>Tabela 1: Reposição (Fábricas para CDs) - Informativa</h3>
              <table className="kpi-table">
                <thead>
                  <tr>
                    <th>Origem (Fábrica)</th>
                    <th>Destino (CD)</th>
                    <th>Tempo Viagem (Horas)</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.responsiveness.factoryRoutes.length === 0 ? (
                     <tr><td colSpan="3" style={{textAlign: 'center', color: '#888'}}>Nenhuma rota ativa ou dados indisponíveis.</td></tr>
                  ) : (
                    metrics.responsiveness.factoryRoutes.map((route, index) => (
                      <tr key={index}>
                        <td>{route.origin}</td>
                        <td>{route.dest}</td>
                        <td>{route.time > 0 ? fmtDec(route.time) + ' h' : 'N/A (0)'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        );
      
      default:
        return null;
    }
  };

  if (loading) return <div className="distance-page"><p style={{color: 'white', padding: '2rem'}}>A carregar Dashboard...</p></div>;
  
  if (error) return (
    <div className="distance-page">
      <div className="sidebar-panel">
        <h2 style={{color: '#e74c3c'}}>Erro de Dados</h2>
        <p className="error-message">{error}</p>
        <Link to="/solver"><button>Voltar ao Solver</button></Link>
      </div>
    </div>
  );

  return (
    <div className="distance-page">
      <div className="sidebar-panel" style={{maxWidth: '1200px'}}>
        <div className="kpi-header">
          <h2>Dashboard SCOR</h2>
          <p>Análise de Desempenho da Cadeia de Abastecimento</p>
        </div>
        
        <div className="kpi-nav">
          <button className={activeTab === 'custos' ? 'active' : ''} onClick={() => setActiveTab('custos')}>💰 Custos</button>
          <button className={activeTab === 'agilidade' ? 'active' : ''} onClick={() => setActiveTab('agilidade')}>🔄 Agilidade</button>
          <button className={activeTab === 'fiabilidade' ? 'active' : ''} onClick={() => setActiveTab('fiabilidade')}>🛡️ Fiabilidade</button>
          <button className={activeTab === 'resposta' ? 'active' : ''} onClick={() => setActiveTab('resposta')}>⚡ Resposta</button>
          <button className={activeTab === 'ativos' ? 'active' : ''} onClick={() => setActiveTab('ativos')}>🏭 Ativos</button>
        </div>

        <div className="kpi-content-area">
          {renderTabContent()}
        </div>

        <div className="button-group" style={{marginTop: 'auto', paddingTop: '2rem', flexDirection: 'row', justifyContent: 'space-between'}}>
          <Link to="/pressupostos"><button>Voltar</button></Link>
        </div>
      </div>
    </div>
  );
}

export default KpiPage;