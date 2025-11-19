import os
from app import app, db

# =================================================================
# --- IMPORTAÇÃO DOS MODELOS ---
#
# Importei todos os seus modelos (classes que herdam de db.Model)
# do seu ficheiro 'app.py'. Não precisa de alterar nada aqui.
# =================================================================

try:
    from app import (
        Factory, 
        Client, 
        DistributionCenter, 
        CacheMatrixFactories, 
        CacheMatrixClients, 
        CacheSolverFactories, 
        CacheSolverClients
    )
    print("Modelos (Factory, Client, etc.) importados com sucesso.")

except ImportError as e:
    print(f"Erro ao importar modelos: {e}")
    print("Verifique se o ficheiro 'app.py' está na mesma pasta.")
    exit()

# =================================================================
# O código abaixo vai ligar-se à base de dados no seu .env
# e criar as tabelas. Não precisa de mexer.
# =================================================================

print("\nScript 'create_tables.py' iniciado.")

try:
    with app.app_context():
        # Verifica se o DATABASE_URL está carregado
        db_url = app.config.get('SQLALCHEMY_DATABASE_URI')
        
        if not db_url:
            print("Erro: Nenhuma DATABASE_URL encontrada na configuração.")
            print("Certifique-se que a linha está no .env antes de executar este script.")
            exit()

        if 'supabase' not in db_url:
            print(f"Aviso: A DATABASE_URL não parece ser do Supabase. A continuar...")
            print(f"Base de dados: {db_url}")
        else:
             print(f"A ligar à base de dados Supabase em: ...{db_url.split('@')[-1]}")
        
        
        # O comando que cria as tabelas
        print("A tentar criar tabelas (db.create_all())...")
        db.create_all() 
        
        print("\n-------------------------------------------------")
        print("✅ Tabelas criadas com sucesso na base de dados!")
        print("Pode verificar o 'Table Editor' no Supabase.")
        print("-------------------------------------------------")

except Exception as e:
    print("\n-------------------------------------------------")
    print(f"❌ Ocorreu um erro ao criar as tabelas: {e}")
    print("-------------------------------------------------")