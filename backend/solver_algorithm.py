# backend/solver_algorithm.py
# (Versão 2.2: Modelo com restrições de cenário)

from pulp import LpProblem, LpMinimize, LpVariable, lpSum, LpStatus, value
import re

def clean_number(val):
    """ Rotina de limpeza de números (trata '1.000,50') """
    if isinstance(val, (int, float)):
        return float(val)
    if val is None:
        return 0.0
    try:
        s_val = str(val).replace('.', '').replace(',', '.')
        s_val = re.sub(r"[^0-9.]", "", s_val)
        return float(s_val) if s_val else 0.0
    except ValueError:
        return 0.0

def solve_network_design_problem(data):
    """
    Resolve o problema unificado de Localização (CDs) e Transbordo (Fábrica->CD->Cliente).
    
    :param data: Um dicionário contendo todos os inputs, incluindo
                 listas de custos/capacidades e mapas de restrições.
    """
    
    print("ℹ️ A iniciar o solver PuLP (Modelo de Network Design)...")

    try:
        # --- 1. Extrair e Limpar Dados ---
        
        # Custos de Transporte
        costs_factory_dc = [[clean_number(c) for c in row[1:]] for row in data['costs_factory_dc'][1:]]
        costs_dc_client = [[clean_number(c) for c in row[1:]] for row in data['costs_dc_client'][1:]]
        
        # Capacidades e Procuras (já vêm modificadas do frontend)
        supply_factory = [clean_number(s) for s in data['supply_factory']]
        demand_client = [clean_number(d) for d in data['demand_client']]
        capacity_dc = [clean_number(c) for c in data['capacity_dc']]
        
        # Custo fixo (lista)
        clean_dc_fixed_costs = [clean_number(c) for c in data['dc_fixed_cost_list']]

        # Parâmetros Económicos
        transport_cost_per_km = clean_number(data['transport_cost_per_km'])
        
        # Nomes (para os mapas de restrições)
        factory_names = data.get('factory_names', [])
        dc_names = data.get('dc_names', [])
        
        # Índices
        I = range(len(supply_factory))  # Fábricas (i)
        J = range(len(capacity_dc))     # CDs (j)
        K = range(len(demand_client))     # Clientes (k)

        # --- NOVOS MAPAS DE RESTRIÇÕES ---
        dc_force_map = data.get('dc_force_map', {})
        factory_min_util_map = data.get('factory_min_util_map', {})

        # Validar consistência dos dados
        if len(dc_names) != len(J) or len(factory_names) != len(I):
            print("⚠️ Aviso: Inconsistência nos nomes e contagens de fábricas/CDs.")

    except Exception as e:
        print(f"❌ Erro na limpeza ou extração de dados: {e}")
        return "Erro de Dados", 0.0, [[]], [[]], {}

    # --- 2. Definição do Problema ---
    prob = LpProblem("BrewSEP_Network_Design_Scenario", LpMinimize)

    # --- 3. Variáveis de Decisão ---
    Y = LpVariable.dicts("CD_Aberto", J, cat='Binary')
    X = LpVariable.dicts("Fluxo_Fabrica_CD", (I, J), lowBound=0, cat='Integer')
    Z = LpVariable.dicts("Fluxo_CD_Cliente", (K, J), lowBound=0, cat='Integer')

    # --- 4. Função Objetivo ---
    var_cost = lpSum(
        X[i][j] * costs_factory_dc[i][j] for i in I for j in J
    ) + lpSum(
        Z[k][j] * costs_dc_client[k][j] for k in K for j in J
    )
    fixed_cost = lpSum(Y[j] * clean_dc_fixed_costs[j] for j in J)
    prob += (var_cost * transport_cost_per_km) + fixed_cost, "Custo_Total_Rede"

    # --- 5. Restrições ---

    # C1. Capacidade da Fábrica i (Oferta)
    for i in I:
        prob += lpSum(X[i][j] for j in J) <= supply_factory[i], f"Restricao_Fabrica_{i}"

    # C2. Procura do Cliente k (Procura 100% Satisfeita)
    for k in K:
        prob += lpSum(Z[k][j] for j in J) == demand_client[k], f"Restricao_Cliente_{k}"
        
    # C3. Balanço de Fluxo no CD j (Transbordo)
    for j in J:
        prob += lpSum(X[i][j] for i in I) == lpSum(Z[k][j] for k in K), f"Restricao_Balanco_CD_{j}"

    # C4. Capacidade do CD j (A Restrição 'Link' Crucial)
    for j in J:
        prob += lpSum(X[i][j] for i in I) <= capacity_dc[j] * Y[j], f"Restricao_Capacidade_CD_{j}"
        
    # --- 6. NOVAS RESTRIÇÕES DE CENÁRIO ---
    
    # C5. Forçar Abertura/Fecho de CDs (do dc_force_map)
    for j_idx, dc_name in enumerate(dc_names):
        if dc_name in dc_force_map:
            force_value = dc_force_map[dc_name]
            if force_value == 1: # Forçar Abertura
                prob += Y[j_idx] == 1, f"Restricao_Forcar_Aberto_CD_{j_idx}"
                print(f"ℹ️ A adicionar restrição: FORÇAR ABERTURA de {dc_name}")
            elif force_value == 0: # Forçar Fecho
                prob += Y[j_idx] == 0, f"Restricao_Forcar_Fechado_CD_{j_idx}"
                print(f"ℹ️ A adicionar restrição: FORÇAR FECHO de {dc_name}")
    
    # C6. Utilização Mínima da Fábrica (do factory_min_util_map)
    for i_idx, factory_name in enumerate(factory_names):
        if factory_name in factory_min_util_map:
            min_util_percent = factory_min_util_map[factory_name]
            if min_util_percent > 0:
                min_production = supply_factory[i_idx] * min_util_percent
                prob += lpSum(X[i_idx][j] for j in J) >= min_production, f"Restricao_Utilizacao_Min_Fabrica_{i_idx}"
                print(f"ℹ️ A adicionar restrição: Utilização Mínima de {min_production} ({min_util_percent*100}%) para {factory_name}")

    # --- 7. Resolver o Problema ---
    try:
        prob.solve()
    except Exception as e:
        print(f"❌ Erro durante a resolução do PuLP: {e}")
        return "Erro no Solver", 0.0, [[]], [[]], {}

    # --- 8. Extrair Resultados ---
    status = LpStatus[prob.status]
    
    if status == 'Optimal':
        total_cost = value(prob.objective)
        alloc_ij = [[X[i][j].varValue for j in J] for i in I]
        alloc_kj = [[Z[k][j].varValue for j in J] for k in K]
        dc_decisions = { dc_names[j]: ("Aberto" if Y[j].varValue > 0.9 else "Fechado") for j in J }
        
        print(f"✅ Solução Ótima encontrada! Custo Total: €{total_cost:,.2f}")
        print(f"Decisões dos CDs: {dc_decisions}")
        
        return status, total_cost, alloc_ij, alloc_kj, dc_decisions
    else:
        print(f"⚠️ Solução não encontrada. Status: {status}")
        return status, 0.0, [[]], [[]], {}