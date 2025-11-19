import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './DistancePage.css'; // Reutiliza o layout base
import './PressupostosPage.css'; // CSS específico para esta tabela

function PressupostosPage() {
  const navigate = useNavigate();
  
  // --- ESTADOS DOS INPUTS (O utilizador pode editar) ---
  const [sellingPrice, setSellingPrice] = useState(14.00);
  const [productionCost, setProductionCost] = useState(5.60);
  
  // --- ESTADOS CALCULADOS (Vêm do Solver) ---
  const [totalDemandCases, setTotalDemandCases] = useState(0);
  const [totalPallets, setTotalPallets] = useState(0);

  // --- CONSTANTES ESTÁTICAS (Da sua imagem) ---
  const PALLET_DIMS = "120 x 80 x 170 cm";
  const CASE_DIMS = "40 x 27 x 13 cm";
  const CASE_WEIGHT = 8.5; // kg
  const CASES_PER_PALLET = 96;
  const CO2_EMISSION = 2.68; // kg CO2/L
  const FUEL_CONSUMPTION = 28; // L/100km

  useEffect(() => {
    // 1. Carregar o Caso Base para obter a Procura Total
    try {
      const data = sessionStorage.getItem('brewsepBaseCase');
      if (data) {
        const parsedData = JSON.parse(data);
        
        // A procura dos clientes está em: inputs.client_solver.row_capacities
        // Precisamos de somar todos os valores
        const demands = parsedData.inputs.client_solver.row_capacities;
        const totalCases = demands.reduce((sum, val) => sum + parseFloat(val), 0);
        
        setTotalDemandCases(totalCases);
        
        // Calcular Paletes (Arredondar para cima)
        setTotalPallets(Math.ceil(totalCases / CASES_PER_PALLET));
      }
    } catch (err) {
      console.error("Erro ao carregar dados do Solver:", err);
    }
  }, []);

  const handleSaveAndContinue = () => {
    // Guardar estes pressupostos para a próxima página (KPIs)
    const assumptions = {
      sellingPrice: parseFloat(sellingPrice),
      productionCost: parseFloat(productionCost),
      totalDemandCases,
      totalPallets,
      static: {
        casesPerPallet: CASES_PER_PALLET,
        caseWeight: CASE_WEIGHT,
        co2Emission: CO2_EMISSION,
        fuelConsumption: FUEL_CONSUMPTION
      }
    };

    sessionStorage.setItem('brewsepKpiAssumptions', JSON.stringify(assumptions));
    
    // Navegar para a página de KPIs (que criaremos a seguir)
    navigate('/kpis');
  };

  return (
    <div className="distance-page">
      <div className="sidebar-panel" style={{maxWidth: '1000px'}}>
        <h2>Pressupostos da Empresa - KPI</h2>
        <p style={{color: '#ccc', marginBottom: '2rem'}}>
          Verifique e ajuste os dados financeiros e logísticos antes de gerar o relatório de desempenho.
        </p>

        <div className="pressupostos-container">
          
          {/* SECÇÃO 1: FINANCEIRO E PRODUÇÃO */}
          <div className="pressupostos-section">
            <h3>Financeiro | Produção</h3>
            <table className="pressupostos-table">
              <tbody>
                <tr>
                  <th>Unidade de Venda</th>
                  <td>1 caixa (24x33cl)</td>
                </tr>
                <tr>
                  <th>Preço Médio de Venda / Caixa (€)</th>
                  <td>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={sellingPrice} 
                      onChange={(e) => setSellingPrice(e.target.value)}
                      className="editable-input"
                    /> €
                  </td>
                </tr>
                <tr>
                  <th>Custos Médios de Produção / Caixa (€)</th>
                  <td>
                    <input 
                      type="number" 
                      step="0.01" 
                      value={productionCost} 
                      onChange={(e) => setProductionCost(e.target.value)}
                      className="editable-input"
                    /> €
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* SECÇÃO 2: TRANSPORTE E LOGÍSTICA */}
          <div className="pressupostos-section">
            <h3>Transporte</h3>
            <table className="pressupostos-table">
              <tbody>
                <tr>
                  <th>Volume das Paletes</th>
                  <td>{PALLET_DIMS}</td>
                </tr>
                <tr>
                  <th>Volume da Caixa (24x33cl)</th>
                  <td>{CASE_DIMS}</td>
                </tr>
                <tr>
                  <th>Peso da Caixa (24x33cl)</th>
                  <td>{CASE_WEIGHT} kg</td>
                </tr>
                <tr>
                  <th>Quantidade de caixas / Palete</th>
                  <td>{CASES_PER_PALLET}</td>
                </tr>
                
                {/* CAMPOS CALCULADOS (Do Solver) */}
                <tr className="calculated-row">
                  <th>Quantidade de Paletes Vendidas / Ano</th>
                  <td>{totalPallets.toLocaleString('pt-PT')}</td>
                </tr>
                <tr className="calculated-row">
                  <th>Quantidade de caixas Vendidas / Ano</th>
                  <td><strong>{totalDemandCases.toLocaleString('pt-PT')}</strong></td>
                </tr>

                <tr>
                  <th>Emissões de CO2 (kg CO2 / L)</th>
                  <td>{CO2_EMISSION}</td>
                </tr>
                <tr>
                  <th>Consumo (L / 100km)</th>
                  <td>{FUEL_CONSUMPTION}</td>
                </tr>
              </tbody>
            </table>
          </div>

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