import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './DistancePage.css'; 
import './KpiPage.css'; 

function KpiPage() {
  const [activeTab, setActiveTab] = useState('custos'); 
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Helper: Parser de Tempo
  const parseTimeFromText = (val) => {
    if (!val || typeof val !== 'string') return 0;
    try {
      let hours = 0, mins = 0;
      const hourMatch = val.match(/(\d+)\s*(?:hour|hora|h)/i);
      const minMatch = val.match(/(\d+)\s*(?:min|m)/i);
      if (hourMatch) hours = parseInt(hourMatch[1], 10);
      if (minMatch) mins = parseInt(minMatch[1], 10);
      if (!hourMatch && !minMatch) return 0;
      return hours + (mins / 60);
    } catch (e) { return 0; }
  };

  // Helper: Lookup Matriz
  const getTimeFromMatrix = (matrixData, rowName, colName) => {
    if (!matrixData || matrixData.length < 2) return 0;
    const headers = matrixData[0];
    const colIndex = headers.indexOf(colName);
    if (colIndex === -1) return 0;
    for (let i = 1; i < matrixData.length; i++) {
      const row = matrixData[i];
      if (row[0] === rowName) return parseTimeFromText(row[colIndex]);
    }
    return 0;
  };

  useEffect(() => {
    try {
      const solverDataRaw = sessionStorage.getItem('brewsepBaseCase');
      const assumptionsDataRaw = sessionStorage.getItem('brewsepKpiAssumptions');
      const distanceMatrixRaw = sessionStorage.getItem('brewsepDistanceMatrix');

      if (!solverDataRaw || !assumptionsDataRaw) {
        throw new Error("Dados insuficientes. Realize o fluxo: Solver -> Pressupostos.");
      }

      const solverData = JSON.parse(solverDataRaw);
      const assumptions = JSON.parse(assumptionsDataRaw);
      const distanceMatrixData = distanceMatrixRaw ? JSON.parse(distanceMatrixRaw) : null;

      const inputs = solverData.inputs || {};
      const results = solverData.results || {};

      // --- A. CUSTOS & FINANÇAS ---
      const totalCases = assumptions.totalDemandCases || 0; 
      const productionCostPerCase = assumptions.productionCost || 0;
      const costToMake = totalCases * productionCostPerCase;
      const costToDeliver = results.totalCost || 0; // Inclui Fixos + Variáveis
      const totalSupplyChainCost = costToMake + costToDeliver;
      const totalRevenue = totalCases * (assumptions.sellingPrice || 0);
      const grossProfit = totalRevenue - totalSupplyChainCost;

      // --- B. AGILIDADE ---
      const factoryUtilizations = results.factoryUtilizations || [];
      const dcUtilizations = results.dcUtilizations || [];
      const a_totalFactoryCap = factoryUtilizations.reduce((sum, f) => sum + f.capacity, 0);
      const b_totalFactoryLoad = factoryUtilizations.reduce((sum, f) => sum + f.utilized, 0);
      const c_totalOpenDcCap = dcUtilizations.reduce((sum, dc) => sum + dc.capacity, 0);
      const d_totalDcLoad = dcUtilizations.reduce((sum, dc) => sum + dc.utilized, 0);
      
      const makeAdaptability = b_totalFactoryLoad > 0 ? (a_totalFactoryCap - b_totalFactoryLoad) / b_totalFactoryLoad : 0;
      const deliverAdaptability = d_totalDcLoad > 0 ? (c_totalOpenDcCap - d_totalDcLoad) / d_totalDcLoad : 0;
      const upsideAdaptability = Math.min(makeAdaptability, deliverAdaptability);

      // --- C. FIABILIDADE ---
      const pctComplete = (assumptions.reliability?.pctComplete ?? 98) / 100;
      const pctDamageFree = (assumptions.reliability?.pctDamageFree ?? 95) / 100;
      const pctOnTime = (assumptions.reliability?.pctOnTime ?? 97) / 100;
      const perfectOrderFulfillment = pctComplete * pctDamageFree * pctOnTime;

      // --- D. ATIVOS ---
      const daysInventory = assumptions.assets?.daysInventory ?? 14;
      const daysReceivables = assumptions.assets?.daysReceivables ?? 60;
      const daysPayables = assumptions.assets?.daysPayables ?? 45;
      const cashToCashCycle = daysInventory + daysReceivables - daysPayables;

      // --- E. RESPOSTA ---
      const sourceCycleDays = assumptions.responsiveness?.sourceCycleDays ?? 15;
      const makeCycleDays = assumptions.responsiveness?.makeCycleDays ?? 21;
      
      const clientNames = inputs.client_solver?.row_headers || [];
      const clientAllocationMatrix = results.client_allocation?.matrix || [];
      const dcNames = inputs.factory_solver?.col_headers || [];
      const rawDistDataClients = distanceMatrixData?.cd_to_clients || [];

      // Tabela Rotas CD -> Cliente
      const cdToClientRoutes = [];
      let totalWeightedTime = 0;
      let totalDeliveredVolume = 0;

      clientNames.forEach((cName, cIdx) => {
        dcNames.forEach((dcName, dcIdx) => {
          const flow = (clientAllocationMatrix[cIdx] && clientAllocationMatrix[cIdx][dcIdx]) ? clientAllocationMatrix[cIdx][dcIdx] : 0;
          if (flow > 0) {
            let timeHours = getTimeFromMatrix(rawDistDataClients, cName, dcName);
            if (timeHours > 0) timeHours += 4; else timeHours = 0;
            totalWeightedTime += (timeHours * flow);
            totalDeliveredVolume += flow;
            cdToClientRoutes.push({ origin: dcName, dest: cName, time: timeHours, flow: flow, weight: 0 });
          }
        });
      });
      cdToClientRoutes.forEach(route => { route.weight = totalDeliveredVolume > 0 ? (route.flow / totalDeliveredVolume) : 0; });
      const avgDeliverHours = totalDeliveredVolume > 0 ? (totalWeightedTime / totalDeliveredVolume) : 0;
      const deliverCycleDays = avgDeliverHours / 24;
      const ofct = sourceCycleDays + makeCycleDays + deliverCycleDays;

      // --- F. MAIS INFORMAÇÕES (AMBIENTAL & PARETO) ---
      
      // 1. Cálculo de Km Totais
      // Revertendo o cálculo do custo: TotalCost = (Km * 0.13) + FixedCost
      // Km = (TotalCost - FixedCost) / 0.13
      let totalFixedCosts = 0;
      const fixedCostList = inputs.dc_fixed_cost_list || [];
      const dcDecisions = results.dc_decisions || {};
      
      dcNames.forEach((name, idx) => {
        if (dcDecisions[name] === 'Aberto') {
          totalFixedCosts += (fixedCostList[idx] || 0);
        }
      });

      const variableTransportCost = Math.max(0, costToDeliver - totalFixedCosts);
      const costPerKm = inputs.transport_cost_per_km || 0.13;
      const totalKm = variableTransportCost / costPerKm;

      // 2. Cálculo de Emissões
      const fuelCons = assumptions.static?.fuelConsumption || 28; // L/100km
      const co2Factor = assumptions.static?.co2Emission || 2.68;  // kg/L
      const totalLitres = (totalKm / 100) * fuelCons;
      const totalCO2 = totalLitres * co2Factor;
      
      const totalPallets = assumptions.totalPallets || 1;
      const co2PerPallet = totalCO2 / totalPallets;

      // 3. Tabela Pareto (Clientes)
      const clientDemands = inputs.client_solver?.row_capacities || [];
      
      let clientsList = clientNames.map((name, idx) => ({
        name,
        demand: parseFloat(clientDemands[idx] || 0)
      }));

      // Ordenar Decrescente
      clientsList.sort((a, b) => b.demand - a.demand);

      // Calcular Acumulado
      let cumulativeDemand = 0;
      const totalNetworkDemand = clientsList.reduce((acc, c) => acc + c.demand, 0);

      const paretoClients = clientsList.map(c => {
        cumulativeDemand += c.demand;
        const pctAccumulated = (cumulativeDemand / totalNetworkDemand) * 100;
        
        let colorClass = 'pareto-red';
        if (pctAccumulated <= 80.0) colorClass = 'pareto-green';
        else if (pctAccumulated <= 94.0) colorClass = 'pareto-yellow';

        return {
          ...c,
          pctAccumulated,
          colorClass
        };
      });

      setMetrics({
        cost: { totalScmCost: totalSupplyChainCost, costToMake, costToDeliver, revenue: totalRevenue, grossProfit, cases: totalCases },
        agility: { upside: upsideAdaptability, make: makeAdaptability, deliver: deliverAdaptability, factoryUtilizations, dcUtilizations, factoryCap: a_totalFactoryCap, factoryLoad: b_totalFactoryLoad, dcCap: c_totalOpenDcCap, dcLoad: d_totalDcLoad },
        reliability: { perfectOrder: perfectOrderFulfillment, complete: pctComplete, damageFree: pctDamageFree, onTime: pctOnTime },
        assets: { cashToCash: cashToCashCycle, daysInventory, daysReceivables, daysPayables },
        responsiveness: { ofct, source: sourceCycleDays, make: makeCycleDays, deliver: deliverCycleDays, clientRoutes: cdToClientRoutes },
        // Novos Dados
        moreInfo: {
          totalKm,
          totalCO2,
          co2PerPallet,
          paretoClients
        }
      });
      setLoading(false);

    } catch (err) {
      console.error("Erro KPIs:", err);
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
                <div className="progress-segment" style={{width: `${(metrics.cost.costToMake / metrics.cost.totalScmCost) * 100}%`, backgroundColor: '#f39c12'}}>Make ({fmtDec((metrics.cost.costToMake / metrics.cost.totalScmCost) * 100)}%)</div>
                <div className="progress-segment" style={{width: `${(metrics.cost.costToDeliver / metrics.cost.totalScmCost) * 100}%`, backgroundColor: '#e74c3c'}}>Deliver ({fmtDec((metrics.cost.costToDeliver / metrics.cost.totalScmCost) * 100)}%)</div>
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
            </div>
            <div className="kpi-card"><h3>Make Adaptability</h3><div className="medium-number">{fmtPct(metrics.agility.make)}</div><div className="sub-detail"><span>Folga Fábricas</span></div></div>
            <div className="kpi-card"><h3>Deliver Adaptability</h3><div className="medium-number">{fmtPct(metrics.agility.deliver)}</div><div className="sub-detail"><span>Folga CDs</span></div></div>
            <div className="kpi-card full-width table-card">
              <h3>Utilização de Fábricas</h3>
              <table className="kpi-table">
                <thead><tr><th>Fábrica</th><th>Utilizado</th><th>Capacidade</th><th>Taxa de Ocupação</th></tr></thead>
                <tbody>{metrics.agility.factoryUtilizations.map((f, i) => (<tr key={i}><td>{f.name}</td><td>{fmtNum(f.utilized)} cx</td><td>{fmtNum(f.capacity)} cx</td><td className={f.utilizationRate >= 0.9 ? 'high-utilization' : ''}>{fmtPct(f.utilizationRate)}</td></tr>))}</tbody>
              </table>
            </div>
            <div className="kpi-card full-width table-card">
              <h3>Utilização de CDs (Abertos)</h3>
              <table className="kpi-table">
                <thead><tr><th>CD</th><th>Utilizado</th><th>Capacidade</th><th>Taxa de Ocupação</th></tr></thead>
                <tbody>{metrics.agility.dcUtilizations.map((dc, i) => (<tr key={i}><td>{dc.name}</td><td>{fmtNum(dc.utilized)} cx</td><td>{fmtNum(dc.capacity)} cx</td><td className={dc.utilizationRate >= 0.9 ? 'high-utilization' : ''}>{fmtPct(dc.utilizationRate)}</td></tr>))}</tbody>
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
            </div>
            <div className="kpi-card"><h3>Entregas Completas</h3><div className="medium-number">{fmtPct(metrics.reliability.complete)}</div></div>
            <div className="kpi-card"><h3>Entregas Sem Danos</h3><div className="medium-number">{fmtPct(metrics.reliability.damageFree)}</div></div>
            <div className="kpi-card"><h3>Entregas No Prazo</h3><div className="medium-number">{fmtPct(metrics.reliability.onTime)}</div></div>
          </div>
        );
      case 'ativos':
        return (
          <div className="kpi-grid fade-in">
            <div className="kpi-card main-card" style={{borderLeft: '5px solid #9b59b6'}}>
              <h3>Cash-to-Cash Cycle Time</h3>
              <div className="big-number" style={{color: '#d2b4de'}}>{fmtNum(metrics.assets.cashToCash)} <span className="unit">dias</span></div>
            </div>
            <div className="kpi-card"><h3>Inventory Days</h3><div className="medium-number warning">+ {fmtNum(metrics.assets.daysInventory)} dias</div></div>
            <div className="kpi-card"><h3>Dias Recebimento</h3><div className="medium-number warning">+ {fmtNum(metrics.assets.daysReceivables)} dias</div></div>
            <div className="kpi-card"><h3>Dias Pagamento</h3><div className="medium-number success">- {fmtNum(metrics.assets.daysPayables)} dias</div></div>
          </div>
        );
      case 'resposta':
        return (
          <div className="kpi-grid fade-in">
            <div className="kpi-card main-card" style={{borderLeft: '5px solid #f1c40f'}}>
              <h3>Order Fulfillment Cycle Time</h3>
              <div className="big-number" style={{color: '#f1c40f'}}>{fmtDec(metrics.responsiveness.ofct)} <span className="unit">dias</span></div>
              <p className="unit">Tempo total desde o pedido até à entrega</p>
            </div>
            <div className="kpi-card"><h3>Source Cycle</h3><div className="medium-number">{fmtDec(metrics.responsiveness.source)} <span className="unit">dias</span></div></div>
            <div className="kpi-card"><h3>Make Cycle</h3><div className="medium-number">{fmtDec(metrics.responsiveness.make)} <span className="unit">dias</span></div></div>
            <div className="kpi-card"><h3>Deliver Cycle</h3><div className="medium-number warning">{fmtDec2(metrics.responsiveness.deliver)} <span className="unit">dias</span></div></div>
            
            <div className="kpi-card full-width table-card">
              <h3>Rotas de Entrega (CDs para Clientes)</h3>
              <table className="kpi-table">
                <thead><tr><th>Origem</th><th>Destino</th><th>Tempo Total</th><th>Peso (%)</th></tr></thead>
                <tbody>
                  {metrics.responsiveness.clientRoutes.map((r, i) => (
                    <tr key={i}><td>{r.origin}</td><td>{r.dest}</td><td>{r.time > 0 ? fmtDec(r.time) + ' h' : 'N/A'}</td><td>{fmtPct(r.weight)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      
      // --- NOVA ABA: MAIS INFORMAÇÕES ---
      case 'mais_info':
        return (
          <div className="kpi-grid fade-in">
            
            {/* Métricas Ambientais */}
            <div className="kpi-card main-card" style={{borderLeft: '5px solid #7f8c8d'}}>
              <h3>Impacto Ambiental & Distâncias</h3>
              <div className="big-number">{fmtNum(metrics.moreInfo.totalCO2)} <span className="unit">kg CO2</span></div>
              <p className="unit">Emissões Totais Estimadas</p>
            </div>

            <div className="kpi-card">
              <h3>Total Percorrido</h3>
              <div className="medium-number">{fmtNum(metrics.moreInfo.totalKm)} <span className="unit">km</span></div>
              <div className="sub-detail">Estimativa Total Frota</div>
            </div>

            <div className="kpi-card">
              <h3>Intensidade Carbónica</h3>
              <div className="medium-number warning">{fmtDec2(metrics.moreInfo.co2PerPallet)}</div>
              <div className="sub-detail">kg CO2 / Palete</div>
            </div>

            <div className="kpi-card">
              <h3>Custo Variável Transp.</h3>
              <div className="medium-number">{fmtEuro(metrics.moreInfo.totalKm * 0.13)}</div>
              <div className="sub-detail">Baseado em 0.13€/km</div>
            </div>

            {/* Tabela ABC (Pareto) */}
            <div className="kpi-card full-width table-card">
              <h3>Análise ABC de Clientes (Pareto)</h3>
              <div style={{display:'flex', gap:'10px', padding:'0 10px 10px', fontSize:'0.8rem'}}>
                <span style={{borderLeft:'4px solid #2ecc71', paddingLeft:'5px'}}>A (Verde): &lt;80%</span>
                <span style={{borderLeft:'4px solid #f1c40f', paddingLeft:'5px'}}>B (Amarelo): 80-94%</span>
                <span style={{borderLeft:'4px solid #e74c3c', paddingLeft:'5px'}}>C (Vermelho): &gt;94%</span>
              </div>
              <table className="kpi-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Procura Anual (cx)</th>
                    <th>% Acumulada</th>
                    <th>Categoria</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.moreInfo.paretoClients.map((c, i) => (
                    <tr key={i} className={c.colorClass}>
                      <td>{c.name}</td>
                      <td>{fmtNum(c.demand)}</td>
                      <td>{fmtDec(c.pctAccumulated)}%</td>
                      <td style={{fontWeight:'bold'}}>
                        {c.colorClass.includes('green') ? 'A' : c.colorClass.includes('yellow') ? 'B' : 'C'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        );

      default: return null;
    }
  };

  if (loading) return <div className="distance-page"><p style={{color: 'white', padding: '2rem'}}>A carregar Dashboard...</p></div>;
  if (error) return <div className="distance-page"><div className="sidebar-panel"><h2 style={{color: '#e74c3c'}}>Erro</h2><p className="error-message">{error}</p><Link to="/pressupostos"><button>Voltar</button></Link></div></div>;

  return (
    <div className="distance-page">
      <div className="sidebar-panel" style={{maxWidth: '1200px'}}>
        <div className="kpi-header"><h2>Dashboard SCOR</h2><p>Análise de Desempenho da Cadeia de Abastecimento</p></div>
        <div className="kpi-nav">
          <button className={activeTab === 'custos' ? 'active' : ''} onClick={() => setActiveTab('custos')}>💰 Custos</button>
          <button className={activeTab === 'agilidade' ? 'active' : ''} onClick={() => setActiveTab('agilidade')}>🔄 Agilidade</button>
          <button className={activeTab === 'fiabilidade' ? 'active' : ''} onClick={() => setActiveTab('fiabilidade')}>🛡️ Fiabilidade</button>
          <button className={activeTab === 'resposta' ? 'active' : ''} onClick={() => setActiveTab('resposta')}>⚡ Resposta</button>
          <button className={activeTab === 'ativos' ? 'active' : ''} onClick={() => setActiveTab('ativos')}>🏭 Ativos</button>
          <button className={`info-tab ${activeTab === 'mais_info' ? 'active' : ''}`} onClick={() => setActiveTab('mais_info')}>🌍 Mais Info</button>
        </div>
        <div className="kpi-content-area">{renderTabContent()}</div>
        <div className="button-group" style={{marginTop: 'auto', paddingTop: '2rem', flexDirection: 'row', justifyContent: 'space-between'}}>
          <Link to="/pressupostos"><button>Voltar</button></Link>
        </div>
      </div>
    </div>
  );
}

export default KpiPage;