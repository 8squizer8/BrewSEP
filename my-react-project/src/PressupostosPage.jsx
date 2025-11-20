import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './DistancePage.css'; 
import './PressupostosPage.css'; 

function PressupostosPage() {
  const navigate = useNavigate();
  
  // --- 1. INPUTS FINANCEIROS ---
  const [sellingPrice, setSellingPrice] = useState(14.00);
  const [productionCost, setProductionCost] = useState(5.60);
  
  // --- 2. INPUTS LOGÍSTICOS ---
  // Novo campo editável (Default 96)
  const [casesPerPallet, setCasesPerPallet] = useState(96);

  // --- 3. INPUTS FIABILIDADE ---
  const [pctComplete, setPctComplete] = useState(98);
  const [pctDamageFree, setPctDamageFree] = useState(95);
  const [pctOnTime, setPctOnTime] = useState(97);

  // --- 4. INPUTS TEMPOS ---
  const [sourceCycleDays, setSourceCycleDays] = useState(15);
  const [makeCycleDays, setMakeCycleDays] = useState(21);

  // --- 5. INPUTS ATIVOS ---
  const [daysInventory, setDaysInventory] = useState(14);
  const [daysReceivables, setDaysReceivables] = useState(60);
  const [daysPayables, setDaysPayables] = useState(45);

  // --- ESTADOS CALCULADOS (Vêm do Solver) ---
  const [totalDemandCases, setTotalDemandCases] = useState(0);
  const [totalPallets, setTotalPallets] = useState(0);

  // Constantes
  const CO2_EMISSION = 2.68; 
  const FUEL_CONSUMPTION = 28; 

  useEffect(() => {
    try {
      const data = sessionStorage.getItem('brewsepBaseCase');
      if (data) {
        const parsedData = JSON.parse(data);
        if (parsedData.inputs && parsedData.inputs.client_solver) {
             const demands = parsedData.inputs.client_solver.row_capacities;
             const totalCases = demands.reduce((sum, val) => sum + parseFloat(val), 0);
             setTotalDemandCases(totalCases);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados do Solver:", err);
    }
  }, []);

  // Recalcular paletes sempre que o nº de caixas ou casesPerPallet mudar
  useEffect(() => {
    if (totalDemandCases > 0 && casesPerPallet > 0) {
      setTotalPallets(Math.ceil(totalDemandCases / casesPerPallet));
    }
  }, [totalDemandCases, casesPerPallet]);

  const handleSaveAndContinue = () => {
    const assumptions = {
      sellingPrice: parseFloat(sellingPrice),
      productionCost: parseFloat(productionCost),
      totalDemandCases,
      totalPallets,
      static: {
        casesPerPallet: parseFloat(casesPerPallet), // Agora é dinâmico
        caseWeight: 8.5,
        co2Emission: CO2_EMISSION,
        fuelConsumption: FUEL_CONSUMPTION
      },
      reliability: {
        pctComplete: parseFloat(pctComplete),
        pctDamageFree: parseFloat(pctDamageFree),
        pctOnTime: parseFloat(pctOnTime)
      },
      responsiveness: {
        sourceCycleDays: parseFloat(sourceCycleDays),
        makeCycleDays: parseFloat(makeCycleDays)
      },
      assets: {
        daysInventory: parseFloat(daysInventory),
        daysReceivables: parseFloat(daysReceivables),
        daysPayables: parseFloat(daysPayables)
      }
    };

    sessionStorage.setItem('brewsepKpiAssumptions', JSON.stringify(assumptions));
    navigate('/kpis');
  };

  return (
    <div className="distance-page">
      <div className="sidebar-panel" style={{maxWidth: '1200px'}}>
        <h2>Pressupostos da Empresa - KPI</h2>
        <p style={{color: '#ccc', marginBottom: '1.5rem'}}>
          Defina os parâmetros operacionais e financeiros para o cálculo dos indicadores SCOR.
        </p>

        <div className="pressupostos-container">
          
          {/* COLUNA 1 */}
          <div style={{display: 'flex', flexDirection: 'column', gap: '2rem', flex: 1}}>
            <div className="pressupostos-section">
              <h3>1. Financeiro & Produção</h3>
              <table className="pressupostos-table">
                <tbody>
                  <tr>
                    <th>Preço Médio de Venda (€)</th>
                    <td><input type="number" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} className="editable-input"/></td>
                  </tr>
                  <tr>
                    <th>Custo de Produção Unitário (€)</th>
                    <td><input type="number" step="0.01" value={productionCost} onChange={(e) => setProductionCost(e.target.value)} className="editable-input"/></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="pressupostos-section">
              <h3>2. Transporte & Volumes</h3>
              <table className="pressupostos-table">
                <tbody>
                  <tr>
                    <th>Quantidade de caixas / Palete</th>
                    <td><input type="number" value={casesPerPallet} onChange={(e) => setCasesPerPallet(e.target.value)} className="editable-input"/></td>
                  </tr>
                  <tr className="calculated-row">
                    <th>Volume Total (Caixas/Ano)</th>
                    <td><strong>{totalDemandCases.toLocaleString('pt-PT')}</strong></td>
                  </tr>
                  <tr className="calculated-row">
                    <th>Paletes Totais (Estimado)</th>
                    <td>{totalPallets.toLocaleString('pt-PT')}</td>
                  </tr>
                  <tr><th>Emissões CO2 (kg/L)</th><td>{CO2_EMISSION}</td></tr>
                  <tr><th>Consumo Camião (L/100km)</th><td>{FUEL_CONSUMPTION}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* COLUNA 2 */}
          <div style={{display: 'flex', flexDirection: 'column', gap: '2rem', flex: 1}}>
            
            <div className="pressupostos-section">
              <h3>3. Nível de Serviço (Fiabilidade)</h3>
              <table className="pressupostos-table">
                <tbody>
                  <tr><th>% Entregas Completas</th><td><input type="number" value={pctComplete} onChange={(e) => setPctComplete(e.target.value)} className="editable-input"/> %</td></tr>
                  <tr><th>% Entregas Sem Danos</th><td><input type="number" value={pctDamageFree} onChange={(e) => setPctDamageFree(e.target.value)} className="editable-input"/> %</td></tr>
                  <tr><th>% Entregas No Prazo</th><td><input type="number" value={pctOnTime} onChange={(e) => setPctOnTime(e.target.value)} className="editable-input"/> %</td></tr>
                </tbody>
              </table>
            </div>

            <div className="pressupostos-section">
              <h3>4. Tempos de Ciclo & Ativos</h3>
              <table className="pressupostos-table">
                <tbody>
                  <tr><th>Source Cycle Time</th><td><input type="number" value={sourceCycleDays} onChange={(e) => setSourceCycleDays(e.target.value)} className="editable-input"/> dias</td></tr>
                  <tr><th>Make Cycle Time</th><td><input type="number" value={makeCycleDays} onChange={(e) => setMakeCycleDays(e.target.value)} className="editable-input"/> dias</td></tr>
                  <tr><th>Inventory Days</th><td><input type="number" value={daysInventory} onChange={(e) => setDaysInventory(e.target.value)} className="editable-input"/> dias</td></tr>
                  <tr><th>Dias Recebimento</th><td><input type="number" value={daysReceivables} onChange={(e) => setDaysReceivables(e.target.value)} className="editable-input"/> dias</td></tr>
                  <tr><th>Dias Pagamento</th><td><input type="number" value={daysPayables} onChange={(e) => setDaysPayables(e.target.value)} className="editable-input"/> dias</td></tr>
                </tbody>
              </table>
            </div>

          </div>
        </div>

        <div className="button-group" style={{marginTop: '3rem', flexDirection: 'row', justifyContent: 'space-between'}}>
          <Link to="/instancias"><button>Voltar (Cenários)</button></Link>
          <button style={{backgroundColor: '#f1c40f', borderColor: '#f1c40f', color: '#000'}} onClick={handleSaveAndContinue}>
            Calcular e Ver Dashboard ➔
          </button>
        </div>
      </div>
    </div>
  );
}

export default PressupostosPage;