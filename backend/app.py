# backend/app.py
# (Versão 3.0: Migrado de sqlite3 para Flask-SQLAlchemy para Deploy)

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy # <-- NOVO IMPORT
import logic
import os # <-- NOVO IMPORT
import googlemaps
from dotenv import load_dotenv
import json
import re
from solver_algorithm import solve_network_design_problem 

load_dotenv() 

app = Flask(__name__)
CORS(app)

# --- 1. CONFIGURAÇÃO DO SQLAlchemy ---

# Carrega a DATABASE_URL do .env (para Supabase/Render)
# Se não encontrar, usa um ficheiro local 'brewsep.db' para testes
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    print("Aviso: DATABASE_URL não definida. A usar 'sqlite:///brewsep.db' local.")
    DATABASE_URL = "sqlite:///brewsep.db"

# Corrige o URL para o SQLAlchemy se for do Heroku/Render
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app) # Inicializa o "tradutor" da base de dados

# --- 2. DEFINIÇÃO DOS MODELOS (as nossas tabelas) ---
# Isto substitui as querys "CREATE TABLE"

class Factory(db.Model):
    __tablename__ = 'factories'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    w = db.Column(db.Float)
    address = db.Column(db.String)
    country = db.Column(db.String)

class Client(db.Model):
    __tablename__ = 'clients'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    w = db.Column(db.Float)
    address = db.Column(db.String)
    country = db.Column(db.String)

class DistributionCenter(db.Model):
    __tablename__ = 'distribution_centers'
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    lat = db.Column(db.Float, nullable=False)
    lng = db.Column(db.Float, nullable=False)
    w = db.Column(db.Float)
    address = db.Column(db.String)
    country = db.Column(db.String)
    custo_fixo = db.Column(db.Float)

# Tabelas de Cache (para dados JSON)
class CacheMatrixFactories(db.Model):
    __tablename__ = 'cache_matrix_factories'
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=False)

class CacheMatrixClients(db.Model):
    __tablename__ = 'cache_matrix_clients'
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=False)

class CacheSolverFactories(db.Model):
    __tablename__ = 'cache_solver_factories'
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=False)

class CacheSolverClients(db.Model):
    __tablename__ = 'cache_solver_clients'
    id = db.Column(db.Integer, primary_key=True)
    data = db.Column(db.Text, nullable=False)


# --- 3. INICIALIZAÇÃO DA BASE DE DADOS (Nova Função) ---
def init_db():
    print("A inicializar a base de dados com SQLAlchemy...")
    # 'with app.app_context()' é necessário para o Flask saber
    # qual app está a usar a base de dados
    with app.app_context():
        db.drop_all() # Apaga tudo
        db.create_all() # Cria de novo com base nos Modelos
    print("✅ Base de dados e tabelas criadas com SQLAlchemy.")


# --- 4. NOVAS FUNÇÕES HELPER (SQLAlchemy) ---

def clear_matrix_cache():
    try:
        # Apaga o conteúdo das tabelas de cache
        db.session.query(CacheMatrixFactories).delete()
        db.session.query(CacheMatrixClients).delete()
        db.session.query(CacheSolverFactories).delete()
        db.session.query(CacheSolverClients).delete()
        db.session.commit()
        print("ℹ️ Todos os caches da Matriz de Distâncias foram limpos.")
    except Exception as e:
        db.session.rollback()
        print(f"❌ Erro ao limpar o cache: {e}")

def get_points_from_db(table_name):
    points, names, capacities, fixed_costs = [], [], [], []
    
    if table_name == 'factories':
        all_rows = Factory.query.all()
    elif table_name == 'clients':
        all_rows = Client.query.all()
    elif table_name == 'distribution_centers':
        all_rows = DistributionCenter.query.all()
    else:
        return [], [], [], []

    if not all_rows:
        return [], [], [], [] 

    for row in all_rows:
        points.append({"lat": row.lat, "lng": row.lng})
        capacities.append(row.w if row.w is not None else 0)
        
        address = row.address
        if address and ',' in address:
            names.append(address.split(',')[0])
        elif address:
            names.append(address)
        else:
            names.append(f"Ponto ({row.lat:.2f}, {row.lng:.2f})")
        
        if table_name == 'distribution_centers':
            fixed_costs.append(row.custo_fixo if row.custo_fixo is not None else 0)
            
    return points, names, capacities, fixed_costs

# --- GOOGLE MAPS (Sem alteração) ---
try:
    gmaps_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not gmaps_key:
        print("AVISO: GOOGLE_MAPS_API_KEY não definida no .env")
        gmaps = None
    else:
        gmaps = googlemaps.Client(key=gmaps_key)
        print("✅ Cliente Google Maps inicializado com sucesso.")
except Exception as e:
    print(f"❌ Erro ao inicializar o cliente Google Maps: {e}")
    gmaps = None

# --- ROTAS (Atualizadas para SQLAlchemy) ---

@app.route('/save-factories', methods=['POST'])
def save_factories():
    with app.app_context(): # Necessário para todas as rotas com 'db'
        clear_matrix_cache()
        data = request.json
        factories = data.get('points', []) 
        if not factories: return jsonify({'error': 'Nenhum ponto de fábrica recebido'}), 400
        try:
            db.session.query(Factory).delete() # Apaga as antigas
            for factory in factories:
                new_factory = Factory(
                    lat=factory.get('lat'),
                    lng=factory.get('lng'),
                    w=factory.get('w', 1),
                    address=factory.get('address', ''),
                    country=factory.get('country', '')
                )
                db.session.add(new_factory)
            db.session.commit()
            return jsonify({'message': f'{len(factories)} fábricas guardadas com sucesso!'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

@app.route('/save-clients', methods=['POST'])
def save_clients():
    with app.app_context():
        clear_matrix_cache()
        data = request.json
        clients = data.get('points', [])
        if not clients: return jsonify({'error': 'Nenhum ponto de cliente recebido'}), 400
        try:
            db.session.query(Client).delete()
            for client in clients:
                new_client = Client(
                    lat=client.get('lat'),
                    lng=client.get('lng'),
                    w=client.get('w', 1),
                    address=client.get('address', ''),
                    country=client.get('country', '')
                )
                db.session.add(new_client)
            db.session.commit()
            return jsonify({'message': f'{len(clients)} clientes guardados com sucesso!'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

@app.route('/save-distribution-centers', methods=['POST'])
def save_distribution_centers():
    with app.app_context():
        clear_matrix_cache()
        data = request.json
        centers = data.get('points', [])
        if not centers: return jsonify({'error': 'Nenhum ponto de CD recebido'}), 400
        try:
            db.session.query(DistributionCenter).delete()
            for center in centers:
                new_center = DistributionCenter(
                    lat=center.get('lat'),
                    lng=center.get('lng'),
                    w=center.get('w', 1),
                    address=center.get('address', ''),
                    country=center.get('country', ''),
                    custo_fixo=center.get('custo_fixo', 0)
                )
                db.session.add(new_center)
            db.session.commit()
            return jsonify({'message': f'{len(centers)} CDs guardados com sucesso!'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

@app.route('/add-distribution-centers', methods=['POST'])
def add_distribution_centers():
    with app.app_context():
        clear_matrix_cache()
        data = request.json
        centers = data.get('points', []) 
        if not centers: return jsonify({'error': 'Nenhum ponto de CD recebido'}), 400
        try:
            for center in centers:
                new_center = DistributionCenter(
                    lat=center.get('lat'),
                    lng=center.get('lng'),
                    w=center.get('w', 1),
                    address=center.get('address', ''),
                    country=center.get('country', ''),
                    custo_fixo=center.get('custo_fixo', 0)
                )
                db.session.add(new_center)
            db.session.commit()
            return jsonify({'message': f'{len(centers)} novo(s) CD(s) adicionado(s) com sucesso!'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 500

@app.route('/calculate-gravity-by-country', methods=['POST'])
def calculate_by_country():
    with app.app_context():
        results_by_country = {}
        try:
            # Query para obter países distintos
            distinct_countries = db.session.query(Client.country).distinct().all()
            countries = [row[0] for row in distinct_countries if row[0]]
            
            if not countries: return jsonify({'error': 'Não foram encontrados clientes com dados de país.'}), 404
            
            for country in countries:
                clients_in_country = Client.query.filter_by(country=country).all()
                points = [{'lat': row.lat, 'lng': row.lng, 'w': row.w} for row in clients_in_country]
                final_point, cost, _ = logic.calculate_from_geo_as_cartesian(points) 
                results_by_country[country] = { 'final_point': final_point, 'total_cost': cost, 'client_count': len(points) }
            
            return jsonify({ 'message': 'Cálculo por país concluído!', 'results': results_by_country })
        except Exception as e:
            return jsonify({'error': str(e)}), 500


# --- PARSE GOOGLE (Sem alteração) ---
def parse_google_response(response, origin_names, dest_names):
    temp_matrix_full = []
    temp_matrix_solver = []
    km_regex = re.compile(r"([\d\.,]+)")
    google_rows = response.get('rows', [])
    for i in range(len(google_rows)):
        new_row_full = []
        new_row_solver = []
        elements = google_rows[i].get('elements', [])
        for j in range(len(elements)):
            try:
                element = elements[j]
                if element['status'] == 'OK':
                    distance_text = element['distance']['text']
                    duration_text = element['duration']['text']
                    new_row_full.append(f"{distance_text} ({duration_text})")
                    match = km_regex.search(distance_text.replace(',', ''))
                    if match:
                        km_value = float(match.group(1))
                        new_row_solver.append(km_value)
                    else:
                        new_row_solver.append(0.0) 
                else:
                    new_row_full.append(f"Erro: {element['status']}")
                    new_row_solver.append(0.0)
            except (KeyError, TypeError):
                new_row_full.append("Erro Parse")
                new_row_solver.append(0.0)
        temp_matrix_full.append(new_row_full)
        temp_matrix_solver.append(new_row_solver)
    def transpose_matrix(matrix, row_headers, col_headers):
        if not matrix or not matrix[0]:
            if col_headers:
                return [['Destino'] + col_headers]
            return []
        final_table = [['Destino'] + col_headers]
        for j in range(len(row_headers)):
            new_row = [row_headers[j]]
            for i in range(len(col_headers)):
                try:
                    new_row.append(matrix[i][j])
                except IndexError:
                    new_row.append("Erro Transp.")
            final_table.append(new_row)
        return final_table
    table_full = transpose_matrix(temp_matrix_full, dest_names, origin_names)
    table_solver = transpose_matrix(temp_matrix_solver, dest_names, origin_names)
    return table_full, table_solver

# --- ROTA DE DISTÂNCIAS (Atualizada para Cache SQLAlchemy) ---
@app.route('/get-distance-matrix', methods=['GET'])
def get_distance_matrix():
    if not gmaps:
        return jsonify({'error': 'Serviço do Google Maps não inicializado no backend.'}), 500
    
    with app.app_context():
        try:
            # 1. Tentar ler do cache
            cached_factories = CacheMatrixFactories.query.get(1)
            cached_clients = CacheMatrixClients.query.get(1)
            
            if cached_factories and cached_clients:
                print("ℹ️ A servir matriz de distâncias (full) do cache SQLAlchemy.")
                return jsonify({
                    'cd_to_factories': json.loads(cached_factories.data),
                    'cd_to_clients': json.loads(cached_clients.data),
                    'source': 'cache'
                })
                
            print("ℹ️ Cache SQLAlchemy 'full' vazio. A contactar a API Google...")
            
            origins, origin_names, _, _ = get_points_from_db('distribution_centers') 
            dest_factories, dest_factories_names, _, _ = get_points_from_db('factories') 
            dest_clients, dest_clients_names, _, _ = get_points_from_db('clients')
            
            if not origins:
                return jsonify({'error': 'Não há Centros de Distribuição (origens) definidos.'}), 404

            # 2. Calcular Matriz: CDs -> Fábricas
            table_factories_full, table_factories_solver = [], []
            if dest_factories:
                if (len(origins) * len(dest_factories) > 100):
                     return jsonify({'error': f'Pedido Fábrica excede 100 elementos ({len(origins)} CDs x {len(dest_factories)} Fábricas). Batching para fábricas não implementado.'}), 400
                matrix_factories = gmaps.distance_matrix(origins, dest_factories, mode="driving")
                table_factories_full, table_factories_solver = parse_google_response(matrix_factories, origin_names, dest_factories_names)
            
            # 3. Calcular Matriz: CDs -> Clientes (COM BATCHING)
            table_clients_full = []
            table_clients_solver = []
            if dest_clients:
                max_dest_per_batch = min(25, 100 // len(origins))
                if max_dest_per_batch == 0:
                    raise Exception("Não é possível fazer batching, número de Origens (CDs) excede 100.")
                print(f"ℹ️ A iniciar processamento em lotes para {len(dest_clients)} clientes.")
                print(f"ℹ️ {len(origins)} CDs (Origens). Tamanho máximo do lote: {max_dest_per_batch} clientes (Destinos).")
                for i in range(0, len(dest_clients), max_dest_per_batch):
                    dest_clients_batch = dest_clients[i:i + max_dest_per_batch]
                    dest_clients_names_batch = dest_clients_names[i:i + max_dest_per_batch]
                    print(f"--- Processando Lote {i // max_dest_per_batch + 1}: {len(dest_clients_batch)} clientes ---")
                    matrix_clients_batch = gmaps.distance_matrix(origins, dest_clients_batch, mode="driving")
                    batch_full, batch_solver = parse_google_response(matrix_clients_batch, origin_names, dest_clients_names_batch)
                    if not table_clients_full:
                        table_clients_full.append(batch_full[0])
                        table_clients_solver.append(batch_solver[0])
                    table_clients_full.extend(batch_full[1:])
                    table_clients_solver.extend(batch_solver[1:])
                    print(f"--- Lote {i // max_dest_per_batch + 1} concluído ---")
            
            # 4. Guardar AMBOS os caches (Lógica 'upsert')
            
            def upsert_cache(model, data):
                cache_entry = model.query.get(1)
                if cache_entry:
                    cache_entry.data = data
                else:
                    cache_entry = model(id=1, data=data)
                    db.session.add(cache_entry)
            
            upsert_cache(CacheMatrixFactories, json.dumps(table_factories_full))
            upsert_cache(CacheMatrixClients, json.dumps(table_clients_full))
            upsert_cache(CacheSolverFactories, json.dumps(table_factories_solver))
            upsert_cache(CacheSolverClients, json.dumps(table_clients_solver))
            
            db.session.commit()
            print("✅ Matrizes (Full e Solver) calculadas e guardadas no cache SQLAlchemy.")
            
            return jsonify({
                'cd_to_factories': table_factories_full,
                'cd_to_clients': table_clients_full,
                'source': 'api'
            })
        except googlemaps.exceptions.ApiError as e:
            print(f"❌ Erro da API Google: {e}")
            return jsonify({'error': f'Erro da API Google: {e.message}'}), 500
        except Exception as e:
            db.session.rollback()
            print(f"❌ Erro na API Google Distance Matrix ou processamento: {e}")
            return jsonify({'error': f'Erro no processamento do backend: {e}'}), 500

# --- ROTA PARA O SOLVER (Atualizada para SQLAlchemy) ---
@app.route('/get-solver-data', methods=['GET'])
def get_solver_data():
    with app.app_context():
        try:
            # 1. Ler dados de distâncias do cache
            cached_factories = CacheSolverFactories.query.get(1)
            cached_clients = CacheSolverClients.query.get(1)
            if not cached_factories or not cached_clients:
                return jsonify({'error': 'Dados do Solver não encontrados. Por favor, visite a página "Consultar Distâncias" primeiro para calcular as rotas.'}), 404
            
            distances_factories = json.loads(cached_factories.data)
            distances_clients = json.loads(cached_clients.data)
            
            # 2. Ler dados das tabelas
            _, factory_names, factory_capacities, _ = get_points_from_db('factories')
            _, client_names, client_demands, _ = get_points_from_db('clients')
            _, dc_names, dc_capacities, dc_fixed_costs = get_points_from_db('distribution_centers')

            # 3. Devolver
            return jsonify({
                'factory_distances': distances_factories,
                'client_distances': distances_clients,
                'dc_fixed_costs': dc_fixed_costs, 
                'factory_solver': {
                    'row_headers': factory_names,
                    'row_capacities': factory_capacities,
                    'col_headers': dc_names,
                    'col_capacities': dc_capacities
                },
                'client_solver': {
                    'row_headers': client_names,
                    'row_capacities': client_demands, 
                    'col_headers': dc_names,
                    'col_capacities': dc_capacities
                }
            })
        except Exception as e:
            print(f"❌ Erro ao buscar dados do Solver: {e}")
            return jsonify({'error': f'Erro no processamento do backend: {e}'}), 500

# --- ROTA DE CARREGAR PRÉ-DEFINIÇÃO (Atualizada para SQLAlchemy) ---
@app.route('/load-preset/<string:preset_name>', methods=['POST'])
def load_preset(preset_name):
    print(f"ℹ️ A carregar a pré-definição: {preset_name}")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, f"{preset_name}.json")
    if not os.path.exists(file_path):
        print(f"❌ Erro: Ficheiro {preset_name}.json não encontrado.")
        return jsonify({'error': 'Ficheiro de pré-definição não encontrado.'}), 404
    
    with app.app_context():
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            factories = data.get('factories', [])
            clients = data.get('clients', [])
            centers = data.get('distribution_centers', [])
            
            clear_matrix_cache() 
            
            # Apagar dados antigos
            db.session.query(Factory).delete()
            db.session.query(Client).delete()
            db.session.query(DistributionCenter).delete()
            
            # Inserir novos dados
            for factory in factories:
                db.session.add(Factory(lat=factory.get('lat'), lng=factory.get('lng'), w=factory.get('w', 1), address=factory.get('address', ''), country=factory.get('country', '')))
            for client in clients:
                db.session.add(Client(lat=client.get('lat'), lng=client.get('lng'), w=client.get('w', 1), address=client.get('address', ''), country=client.get('country', '')))
            for center in centers:
                db.session.add(DistributionCenter(lat=center.get('lat'), lng=center.get('lng'), w=center.get('w', 1), address=center.get('address', ''), country=center.get('country', ''), custo_fixo=center.get('custo_fixo', 0)))

            db.session.commit()
            
            return jsonify({
                'message': f'Cenário "{preset_name}" carregado com sucesso!',
                'factories': factories,
                'clients': clients,
                'dcs': centers
            })
        except Exception as e:
            db.session.rollback()
            print(f"❌ Erro ao carregar pré-definição: {e}")
            return jsonify({'error': f'Erro no servidor ao carregar pré-definição: {e}'}), 500

# --- ROTA PARA EXECUTAR O SOLVER (Atualizada para SQLAlchemy) ---
@app.route('/run-solver', methods=['POST'])
def run_solver():
    print("ℹ️ Rota /run-solver foi chamada (Modelo Unificado).")
    with app.app_context():
        try:
            cached_factories = CacheSolverFactories.query.get(1)
            cached_clients = CacheSolverClients.query.get(1)
            if not cached_factories or not cached_clients:
                return jsonify({'error': 'Dados do Solver não encontrados. Calcule as distâncias primeiro.'}), 404
            
            distances_factories = json.loads(cached_factories.data)
            distances_clients = json.loads(cached_clients.data)
            
            _, factory_names, factory_capacities, _ = get_points_from_db('factories')
            _, _, client_demands, _ = get_points_from_db('clients')
            _, dc_names, dc_capacities, dc_fixed_costs = get_points_from_db('distribution_centers')
            
            if not distances_factories or len(distances_factories) <= 1:
                return jsonify({'error': 'Matriz de custos Fábrica-CD está vazia.'}), 400
            if not distances_clients or len(distances_clients) <= 1:
                return jsonify({'error': 'Matriz de custos CD-Cliente está vazia.'}), 400
            if not factory_capacities or not client_demands or not dc_capacities:
                 return jsonify({'error': 'Dados de capacidade ou procura em falta.'}), 400
            
            solver_input_data = {
                "costs_factory_dc": distances_factories,
                "costs_dc_client": distances_clients,
                "supply_factory": factory_capacities,
                "demand_client": client_demands,
                "capacity_dc": dc_capacities,
                "dc_fixed_cost_list": dc_fixed_costs,
                "transport_cost_per_km": 0.13,
                "factory_names": factory_names, 
                "dc_names": dc_names,
                "dc_force_map": {},
                "factory_min_util_map": {}
            }
            
            (status, total_cost, alloc_ij, alloc_kj, dc_decisions) = solve_network_design_problem(
                solver_input_data
            )
            if status != 'Optimal':
                 return jsonify({
                    'error': f'O solver não encontrou uma solução ótima. Status: {status}',
                }), 500
            return jsonify({
                'message': f'Solução ótima encontrada! Custo Total: €{total_cost:,.2f}',
                'total_cost_full': total_cost,
                'dc_decisions': dc_decisions,
                'factory_allocation': {
                    'status': status,
                    'matrix': alloc_ij
                },
                'client_allocation': {
                    'status': status,
                    'matrix': alloc_kj
                }
            })
        except Exception as e:
            print(f"❌ Erro crítico na rota /run-solver: {e}")
            return jsonify({'error': f'Erro no backend ao executar o solver: {e}'}), 500

# --- ROTA PARA CENÁRIOS (Sem alteração, já estava correta) ---
@app.route('/run-scenario', methods=['POST'])
def run_scenario():
    print("ℹ️ Rota /run-scenario foi chamada.")
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'Nenhum dado de cenário recebido.'}), 400
        
        # A função do solver já está preparada para receber estes dados
        (status, total_cost, alloc_ij, alloc_kj, dc_decisions) = solve_network_design_problem(
            data
        )
        if status != 'Optimal':
             return jsonify({
                'error': f'O solver não encontrou uma solução ótima. Status: {status}',
            }), 500
        return jsonify({
            'message': f'Cenário calculado com sucesso! Custo Total: €{total_cost:,.2f}',
            'total_cost_full': total_cost,
            'dc_decisions': dc_decisions,
            'factory_allocation': {
                'status': status,
                'matrix': alloc_ij
            },
            'client_allocation': {
                'status': status,
                'matrix': alloc_kj
            }
        })
    except Exception as e:
        print(f"❌ Erro crítico na rota /run-scenario: {e}")
        return jsonify({'error': f'Erro no backend ao executar o solver: {e}'}), 500


if __name__ == '__main__':
    init_db() 
    app.run(debug=True, port=5000)