import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './DistancePage.css'; // Layout base
import './PressupostosPage.css'; // Estilos específicos da tabela

function PressupostosPage() {
  const navigate = useNavigate();
  
  // --- 1. FINANCEIRO & PRODUÇÃO ---
  // CORREÇÃO: Valores por defeito atualizados conforme pedido (13.99 e 4.50)
  const [sellingPrice, setSellingPrice] = useState(13.99);
  const [productionCost, setProductionCost] = useState(4.50);
  
  // --- 2. TRANSPORTE & VOLUMES ---
  const [totalDemandCases, setTotalDemandCases] = useState(41977920); 
  const [totalPallets, setTotalPallets] = useState(437270);
  const [co2Emission, setCo2Emission] = useState(2.68);
  const [fuelConsumption, setFuelConsumption] = useState(28);
  const CASES_PER_PALLET = 96; // Fixo/Estático

  // --- 3. NÍVEL DE SERVIÇO (FIABILIDADE) ---
  const [serviceFull, setServiceFull] = useState(98);
  const [serviceDamageFree, setServiceDamageFree] = useState(95);
  const [serviceOnTime, setServiceOnTime] = useState(97);

  // --- 4. TEMPOS DE CICLO & ATIVOS ---
  const [sourceCycleTime, setSourceCycleTime] = useState(15);
  const [makeCycleTime, setMakeCycleTime] = useState(21);
  const [inventoryDays, setInventoryDays] = useState(14);
  const [daysReceivables, setDaysReceivables] = useState(60);
  const [daysPayables, setDaysPayables] = useState(45);


  useEffect(() => {
    try {
      const data = sessionStorage.getItem('brewsepBaseCase');
      if (data) {
        // Lógica de atualização automática desligada para preservar os valores fixos pedidos,
        // mas pronta a usar se necessário no futuro.
      }
    } catch (err) {
      console.error("Erro ao ler dados do Solver:", err);
    }
  }, []);

  const handleSaveAndContinue = () => {
    // Guardar TODOS os pressupostos
    const assumptions = {
      // Financeiro
      sellingPrice: parseFloat(sellingPrice),
      productionCost: parseFloat(productionCost),
      
      // Logística
      totalDemandCases: parseFloat(totalDemandCases),
      totalPallets: parseFloat(totalPallets),
      co2Emission: parseFloat(co2Emission),
      fuelConsumption: parseFloat(fuelConsumption),
      casesPerPallet: CASES_PER_PALLET,

      // Fiabilidade
      serviceFull: parseFloat(serviceFull),
      serviceDamageFree: parseFloat(serviceDamageFree),
      serviceOnTime: parseFloat(serviceOnTime),

      // Tempos & Ativos
      sourceCycleTime: parseFloat(sourceCycleTime),
      makeCycleTime: parseFloat(makeCycleTime),
      inventoryDays: parseFloat(inventoryDays),
      daysReceivables: parseFloat(daysReceivables),
      daysPayables: parseFloat(daysPayables)
    };

    sessionStorage.setItem('brewsepKpiAssumptions', JSON.stringify(assumptions));
    navigate('/kpis');
  };

  return (
    <div className="distance-page">
      <div className="sidebar-panel" style={{maxWidth: '1000px'}}>
        <h2>Pressupostos da Empresa - KPI</h2>
        <p style={{color: '#ccc', marginBottom: '1.5rem'}}>
          Edite os valores abaixo para ajustar o cálculo dos indicadores.
        </p>

        <div className="pressupostos-container">
          
          {/* TABELA ÚNICA COM CABEÇALHOS DE SECÇÃO */}
          <table className="pressupostos-table-unified">
            
            {/* 1. FINANCEIRO */}
            <thead>
              <tr><th colSpan="2">1. Financeiro & Produção</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="label-col">Preço Médio de Venda (€)</td>
                <td className="input-col">
                  <input type="number" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} />
                </td>
              </tr>
              <tr>
                <td className="label-col">Custo de Produção Unitário (€)</td>
                <td className="input-col">
                  <input type="number" step="0.1" value={productionCost} onChange={(e) => setProductionCost(e.target.value)} />
                </td>
              </tr>
            </tbody>

            {/* 2. TRANSPORTE */}
            <thead>
              <tr><th colSpan="2">2. Transporte & Volumes</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="label-col">Quantidade de caixas / Palete</td>
                <td className="input-col input-static-container">{CASES_PER_PALLET}</td>
              </tr>
              <tr>
                <td className="label-col">Volume Total (Caixas/Ano)</td>
                <td className="input-col">
                  <input 
                    type="number" 
                    value={totalDemandCases} 
                    onChange={(e) => setTotalDemandCases(e.target.value)} 
                    style={{color: '#006400', fontWeight: 'bold'}}
                  />
                </td>
              </tr>
              <tr>
                <td className="label-col">Paletes Totais (Estimado)</td>
                <td className="input-col">
                  <input 
                    type="number" 
                    value={totalPallets} 
                    onChange={(e) => setTotalPallets(e.target.value)} 
                    style={{color: '#006400', fontWeight: 'bold'}}
                  />
                </td>
              </tr>
              <tr>
                <td className="label-col">Emissões CO2 (kg/L)</td>
                <td className="input-col">
                  <input type="number" step="0.01" value={co2Emission} onChange={(e) => setCo2Emission(e.target.value)} />
                </td>
              </tr>
              <tr>
                <td className="label-col">Consumo Camião (L/100km)</td>
                <td className="input-col">
                  <input type="number" step="0.1" value={fuelConsumption} onChange={(e) => setFuelConsumption(e.target.value)} />
                </td>
              </tr>
            </tbody>

            {/* 3. FIABILIDADE */}
            <thead>
              <tr><th colSpan="2">3. Nível de Serviço (Fiabilidade)</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="label-col">% Entregas Completas</td>
                <td className="input-col">
                  <input type="number" value={serviceFull} onChange={(e) => setServiceFull(e.target.value)} /> %
                </td>
              </tr>
              <tr>
                <td className="label-col">% Entregas Sem Danos</td>
                <td className="input-col">
                  <input type="number" value={serviceDamageFree} onChange={(e) => setServiceDamageFree(e.target.value)} /> %
                </td>
              </tr>
              <tr>
                <td className="label-col">% Entregas No Prazo</td>
                <td className="input-col">
                  <input type="number" value={serviceOnTime} onChange={(e) => setServiceOnTime(e.target.value)} /> %
                </td>
              </tr>
            </tbody>

            {/* 4. TEMPOS & ATIVOS */}
            <thead>
              <tr><th colSpan="2">4. Tempos de Ciclo & Ativos</th></tr>
            </thead>
            <tbody>
              <tr>
                <td className="label-col">Source Cycle Time</td>
                <td className="input-col">
                  <input type="number" value={sourceCycleTime} onChange={(e) => setSourceCycleTime(e.target.value)} /> dias
                </td>
              </tr>
              <tr>
                <td className="label-col">Make Cycle Time</td>
                <td className="input-col">
                  <input type="number" value={makeCycleTime} onChange={(e) => setMakeCycleTime(e.target.value)} /> dias
                </td>
              </tr>
              <tr>
                <td className="label-col">Inventory Days</td>
                <td className="input-col">
                  <input type="number" value={inventoryDays} onChange={(e) => setInventoryDays(e.target.value)} /> dias
                </td>
              </tr>
              <tr>
                <td className="label-col">Dias Recebimento</td>
                <td className="input-col">
                  <input type="number" value={daysReceivables} onChange={(e) => setDaysReceivables(e.target.value)} /> dias
                </td>
              </tr>
              <tr>
                <td className="label-col">Dias Pagamento</td>
                <td className="input-col">
                  <input type="number" value={daysPayables} onChange={(e) => setDaysPayables(e.target.value)} /> dias
                </td>
              </tr>
            </tbody>

          </table>
        </div>

        <div className="button-group" style={{marginTop: '3rem', flexDirection: 'row', justifyContent: 'space-between'}}>
          <Link to="/instancias">
            <button>Voltar (Cenários)</button>
          </Link>
          <button 
            style={{backgroundColor: '#f1c40f', borderColor: '#f1c40f', color: '#000'}}
            onClick={handleSaveAndContinue}
          >
            Gerar Dashboard de KPIs ➔
          </button>
        </div>
      </div>
    </div>
  );
}

export default PressupostosPage;