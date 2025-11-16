def calculate_final_point(points):
    import numpy as np

    logs = []

    if not points:
        return {'x': 0, 'y': 0}, 0, logs

    lista_x = [p['x'] for p in points]
    lista_y = [p['y'] for p in points]
    lista_w = [p.get('w', 1) for p in points]  # peso default 1

    # cálculo do primeiro ponto
    x1 = sum([lista_x[i]*lista_w[i] for i in range(len(lista_x))])/sum(lista_w)
    y1 = sum([lista_y[i]*lista_w[i] for i in range(len(lista_y))])/sum(lista_w)
    logs.append(f"Primeiro ponto inicial: ({x1:.4f}, {y1:.4f})")

    x_old, y_old = x1, y1
    epsilon = 1e-6
    iteracao = 0

    while True:
        iteracao += 1
        distancias = []
        for i in range(len(lista_x)):
            d = np.sqrt((x_old - lista_x[i])**2 + (y_old - lista_y[i])**2)
            if d == 0: d = 1e-4
            distancias.append(d)

        # log apenas da primeira iteração
        if iteracao == 1:
            logs.append(f"Primeira iteração: distâncias = {distancias}")

        # cálculo dos novos X e Y ponderados pelas distâncias
        soma_x = sum([lista_w[i]*lista_x[i]/distancias[i] for i in range(len(lista_x))])
        soma_y = sum([lista_w[i]*lista_y[i]/distancias[i] for i in range(len(lista_x))])
        soma_div = sum([lista_w[i]/distancias[i] for i in range(len(lista_x))])

        x_new = soma_x / soma_div
        y_new = soma_y / soma_div

        c = sum([lista_w[i]*distancias[i] for i in range(len(lista_x))])

        # verificar convergência
        if abs(x_new - x_old) < epsilon and abs(y_new - y_old) < epsilon:
            logs.append(f"\n✅ Convergência atingida em {iteracao} iterações!")
            logs.append(f"Coordenadas finais: ({x_new:.4f}, {y_new:.4f})")
            logs.append(f"Custo final: {c:.4f}")
            break

        x_old, y_old = x_new, y_new

    return {'x': round(x_new,4), 'y': round(y_new,4)}, round(c,4), logs
