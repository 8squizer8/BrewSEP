# Substitua todo o conteúdo de: backend/logic.py

import numpy as np
import math # Precisamos da biblioteca math para as funções trigonométricas

# ---------------------------------------------------------------------------
# Função para a Página 2 (Simulador Oxy) - Permanece inalterada
# ---------------------------------------------------------------------------
def calculate_final_point(points):
    logs = []
    if not points:
        return {'x': 0, 'y': 0}, 0, logs

    lista_x = [p['x'] for p in points]
    lista_y = [p['y'] for p in points]
    lista_w = [p.get('w', 1) for p in points]

    x1 = sum([lista_x[i]*lista_w[i] for i in range(len(lista_x))])/sum(lista_w)
    y1 = sum([lista_y[i]*lista_w[i] for i in range(len(lista_y))])/sum(lista_w)
    logs.append(f"Ponto inicial: ({x1:.4f}, {y1:.4f})")

    x_old, y_old = x1, y1
    epsilon = 1e-6
    iteracao = 0
    max_iter = 100

    while iteracao < max_iter:
        iteracao += 1
        distancias = []
        for i in range(len(lista_x)):
            d = np.sqrt((x_old - lista_x[i])**2 + (y_old - lista_y[i])**2)
            if d < 1e-9: d = 1e-9
            distancias.append(d)

        soma_x = sum([lista_w[i]*lista_x[i]/distancias[i] for i in range(len(lista_x))])
        soma_y = sum([lista_w[i]*lista_y[i]/distancias[i] for i in range(len(lista_x))])
        soma_div = sum([lista_w[i]/distancias[i] for i in range(len(lista_x))])

        if soma_div == 0: break

        x_new = soma_x / soma_div
        y_new = soma_y / soma_div
        logs.append(f"Iter {iteracao}: ({x_new:.4f}, {y_new:.4f})")

        if abs(x_new - x_old) < epsilon and abs(y_new - y_old) < epsilon:
            logs.append(f"\n✅ Convergência atingida em {iteracao} iterações!")
            break

        x_old, y_old = x_new, y_new
    
    c = sum([lista_w[i]*distancias[i] for i in range(len(lista_x))])
    return {'x': round(x_new,4), 'y': round(y_new,4)}, round(c,4), logs

# ---------------------------------------------------------------------------
# NOVAS Funções para a Página 3 (Mapa com precisão geográfica)
# ---------------------------------------------------------------------------

def haversine_distance(p1, p2):
    """
    Calcula a distância ortodrómica entre dois pontos geográficos.
    p1 e p2 são dicionários com chaves 'lat' e 'lng'.
    Retorna a distância em quilómetros.
    """
    R = 6371.0  # Raio médio da Terra em km

    lat1_rad = math.radians(p1['lat'])
    lng1_rad = math.radians(p1['lng'])
    lat2_rad = math.radians(p2['lat'])
    lng2_rad = math.radians(p2['lng'])

    d_lng = lng2_rad - lng1_rad
    d_lat = lat2_rad - lat1_rad

    a = math.sin(d_lat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(d_lng / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    distance = R * c
    return distance

def calculate_weiszfeld_haversine(points):
    """
    Versão do método de Weiszfeld que usa a distância Haversine.
    """
    logs = ["Iniciando cálculo geográfico preciso com Haversine..."]
    if not points:
        return {'lat': 0, 'lng': 0}, 0, logs

    lista_lat = [p['lat'] for p in points]
    lista_lng = [p['lng'] for p in points]
    lista_w = [p.get('w', 1) or 1 for p in points] # Garante que o peso nunca é zero

    # O ponto inicial continua a ser uma média ponderada
    lat_old = sum([lista_lat[i] * lista_w[i] for i in range(len(lista_lat))]) / sum(lista_w)
    lng_old = sum([lista_lng[i] * lista_w[i] for i in range(len(lista_lng))]) / sum(lista_w)
    logs.append(f"Ponto inicial: (Lat: {lat_old:.6f}, Lng: {lng_old:.6f})")
    
    # A tolerância de convergência (epsilon) agora é em km
    epsilon_km = 0.01  # 10 metros
    iteracao = 0
    max_iter = 100

    while iteracao < max_iter:
        iteracao += 1
        current_point = {'lat': lat_old, 'lng': lng_old}
        
        soma_lat_ponderada = 0
        soma_lng_ponderada = 0
        soma_pesos_inversos = 0
        
        for i in range(len(lista_lat)):
            destination_point = {'lat': lista_lat[i], 'lng': lista_lng[i]}
            
            d = haversine_distance(current_point, destination_point)
            
            # Se o ponto de teste calhar em cima de um ponto de cliente, retornamos esse ponto.
            if d < 1e-9:
                return destination_point, 0, logs + [f"Ponto ótimo encontrado em cima do cliente {i+1}."]

            w_d = lista_w[i] / d
            soma_lat_ponderada += lista_lat[i] * w_d
            soma_lng_ponderada += lista_lng[i] * w_d
            soma_pesos_inversos += w_d

        if soma_pesos_inversos == 0: break

        lat_new = soma_lat_ponderada / soma_pesos_inversos
        lng_new = soma_lng_ponderada / soma_pesos_inversos
        
        # A condição de paragem é a distância que o ponto ótimo se moveu
        distancia_movimento = haversine_distance({'lat': lat_old, 'lng': lng_old}, {'lat': lat_new, 'lng': lng_new})
        logs.append(f"Iter {iteracao}: (Lat: {lat_new:.6f}, Lng: {lng_new:.6f}), Deslocamento: {distancia_movimento*1000:.2f}m")

        if distancia_movimento < epsilon_km:
            logs.append(f"\n✅ Convergência atingida em {iteracao} iterações!")
            break
            
        lat_old, lng_old = lat_new, lng_new
    
    # O custo agora é um valor significativo em "quilómetros ponderados"
    c = 0
    final_point = {'lat': lat_new, 'lng': lng_new}
    for i in range(len(lista_lat)):
        destination_point = {'lat': lista_lat[i], 'lng': lista_lng[i]}
        c += lista_w[i] * haversine_distance(final_point, destination_point)
    
    logs.append(f"Custo total final: {c:.2f} (unidade ponderada em km)")
        
    return final_point, round(c, 2), logs

# ---------------------------------------------------------------------------
# Função antiga da Página 3, agora ATUALIZADA para chamar a nova lógica
# ---------------------------------------------------------------------------
def calculate_from_geo_as_cartesian(points):
    # Esta função agora simplesmente chama a nova função Haversine.
    # Mantemos o nome para não ter que mudar nada no app.py.
    return calculate_weiszfeld_haversine(points)