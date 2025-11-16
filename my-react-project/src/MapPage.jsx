// Substitua todo o conteúdo de: src/MapPage.jsx
// (Versão com Cenário B e lógica de "salto")

import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from '@react-google-maps/api';
import './MapPage.css';

const containerStyle = { width: '100%', height: '100%' };
const initialCenter = { lat: 41.1579, lng: -8.6291 };

// Ícones
const factoryIcon = { path: 'M-10,0a10,10 0 1,0 20,0a10,10 0 1,0 -20,0', fillColor: '#3498db', fillOpacity: 0.8, strokeColor: '#fff', strokeWeight: 2, scale: 0.8 };
const dcIcon = { path: 'M-10,0a10,10 0 1,0 20,0a10,10 0 1,0 -20,0', fillColor: '#2ecc71', fillOpacity: 0.8, strokeColor: '#fff', strokeWeight: 2, scale: 0.8 };

function MapPage({ onGoHome }) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places'],
  });

  const navigate = useNavigate();
  const [presetLoading, setPresetLoading] = useState(false);

  // Fases: 'factories', 'clients', 'dcs', 'analysis', 'adjusting_cd'
  const [currentPhase, setCurrentPhase] = useState('factories'); 

  // Estados Fases 1-3
  const [numFactories, setNumFactories] = useState('');
  const [isFactoryNumSet, setIsFactoryNumSet] = useState(false);
  const [targetNumFactories, setTargetNumFactories] = useState(0);
  const [factoryMarkers, setFactoryMarkers] = useState([]);
  const [factorySaveStatus, setFactorySaveStatus] = useState('');
  const [numClients, setNumClients] = useState('');
  const [isClientNumSet, setIsClientNumSet] = useState(false);
  const [targetNumClients, setTargetNumClients] = useState(0);
  const [clientMarkers, setClientMarkers] = useState([]);
  const [clientSaveStatus, setClientSaveStatus] = useState('');
  const [numDcs, setNumDcs] = useState('');
  const [isDcNumSet, setIsDcNumSet] = useState(false);
  const [targetNumDcs, setTargetNumDcs] = useState(0);
  const [dcMarkers, setDcMarkers] = useState([]); 
  const [dcSaveStatus, setDcSaveStatus] = useState('');

  // Estados Fase 4 (Análise)
  const [analysisResult, setAnalysisResult] = useState(null);
  const [allAdjustmentsDone, setAllAdjustmentsDone] = useState(false);

  // Estados Fase 5 (Ajuste)
  const [adjustingCountry, setAdjustingCountry] = useState(null); 
  const [newCdMarker, setNewCdMarker] = useState(null); 
  const [adjustmentSaveStatus, setAdjustmentSaveStatus] = useState('');

  // Estado geral
  const [error, setError] = useState('');
  const autocompleteRefs = useRef([]);
  const autocompleteClientRefs = useRef([]);
  const autocompleteDcRefs = useRef([]);
  const autocompleteAdjustRef = useRef(null); 

  // --- LÓGICA DE MAPA E MORADA (Sem alteração) ---
  const getAddressFromCoords = (lat, lng, index, type) => {
    if (!window.google || !window.google.maps || !window.google.maps.Geocoder) {
      updateMarker(index, type, 'address', 'Erro: Geocoder não carregado');
      return;
    }
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      let address = `Falha no Geocode: ${status}`;
      let country = ''; 
      if (status === 'OK' && results[0]) {
        address = results[0].formatted_address;
        for (const component of results[0].address_components) {
          if (component.types.includes('country')) {
            country = component.long_name;
            break;
          }
        }
      }
      if (type === 'adjust') {
        setNewCdMarker(prev => ({ ...prev, address: address, country: country }));
      } else {
        const setMarkers = 
          type === 'factory' ? setFactoryMarkers :
          type === 'client' ? setClientMarkers :
          setDcMarkers;
        setMarkers(current => current.map((marker, i) => 
          i === index ? { ...marker, address: address, country: country } : marker
        ));
      }
    });
  };

  const handleMapClick = (event) => {
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    const newMarkerBase = { lat, lng, w: '1', custo_fixo: '', address: 'A obter morada...', country: '' };
    
    if (currentPhase === 'factories' && isFactoryNumSet && factoryMarkers.length < targetNumFactories) {
      const newIndex = factoryMarkers.length;
      setFactoryMarkers(current => [...current, newMarkerBase]);
      getAddressFromCoords(lat, lng, newIndex, 'factory');
    }
    else if (currentPhase === 'clients' && isClientNumSet && clientMarkers.length < targetNumClients) {
      const newIndex = clientMarkers.length;
      setClientMarkers(current => [...current, newMarkerBase]);
      getAddressFromCoords(lat, lng, newIndex, 'client');
    }
    else if (currentPhase === 'dcs' && isDcNumSet && dcMarkers.length < targetNumDcs) {
      const newIndex = dcMarkers.length;
      setDcMarkers(current => [...current, newMarkerBase]);
      getAddressFromCoords(lat, lng, newIndex, 'dc');
    }
    else if (currentPhase === 'adjusting_cd') {
      setNewCdMarker(prev => ({ ...prev, lat: lat, lng: lng, address: 'A obter morada...' }));
      getAddressFromCoords(lat, lng, null, 'adjust');
    }
  };

  // --- FUNÇÕES GENÉRICAS DE UPDATE (Sem alteração) ---
  const updateMarker = (index, type, field, value) => {
    if (type === 'adjust') {
      setNewCdMarker(prev => ({ ...prev, [field]: value }));
    } else {
      const setMarkers = 
        type === 'factory' ? setFactoryMarkers :
        type === 'client' ? setClientMarkers :
        setDcMarkers;
      setMarkers(current => current.map((marker, i) => 
        i === index ? { ...marker, [field]: value } : marker
      ));
    }
  };

  const handleCoordChange = (index, type, field, value) => {
    const newCoord = parseFloat(value);
    if (!isNaN(newCoord)) {
      updateMarker(index, type, field, newCoord); 
      let lat, lng;
      if (type === 'adjust') {
        const marker = newCdMarker;
        lat = field === 'lat' ? newCoord : marker.lat;
        lng = field === 'lng' ? newCoord : marker.lng;
      } else {
        const markers = type === 'factory' ? factoryMarkers : type === 'client' ? clientMarkers : dcMarkers;
        const marker = markers[index];
        lat = field === 'lat' ? newCoord : marker.lat;
        lng = field === 'lng' ? newCoord : marker.lng;
      }
      setTimeout(() => getAddressFromCoords(lat, lng, index, type), 1000);
    } else {
      updateMarker(index, type, field, value);
    }
  };

  const handleWeightChange = (index, type, value) => {
    updateMarker(index, type, 'w', value);
  };
  
  const handleCostChange = (index, type, value) => {
    updateMarker(index, type, 'custo_fixo', value);
  };

  const onPlaceChanged = (index, type) => {
    const ref = 
      type === 'factory' ? autocompleteRefs.current[index] :
      type === 'client' ? autocompleteClientRefs.current[index] :
      type === 'dc' ? autocompleteDcRefs.current[index] :
      autocompleteAdjustRef.current;
    
    if (ref) {
      const place = ref.getPlace();
      if (place.geometry) {
        const newLat = place.geometry.location.lat();
        const newLng = place.geometry.location.lng();
        const newAddress = place.formatted_address;
        let country = '';
        if (place.address_components) {
          for (const component of place.address_components) {
            if (component.types.includes('country')) {
              country = component.long_name;
              break;
            }
          }
        }
        if (type === 'adjust') {
          setNewCdMarker(prev => ({ ...prev, lat: newLat, lng: newLng, address: newAddress, country: country }));
        } else {
          const setMarkers = type === 'factory' ? setFactoryMarkers : type === 'client' ? setClientMarkers : setDcMarkers;
          setMarkers(current => current.map((marker, i) => 
            i === index ? { ...marker, lat: newLat, lng: newLng, address: newAddress, country: country } : marker
          ));
        }
      }
    }
  };


  // --- LÓGICA DAS FASES 1, 2, 3 (Sem alteração) ---
  const handleFactoryNumChange = (e) => setNumFactories(e.target.value);
  const handleFactoryGenerate = () => {
    const num = parseInt(numFactories);
    if (isNaN(num) || num <= 0) { setError('Por favor, insira um número inteiro e positivo.'); return; }
    setTargetNumFactories(num); setIsFactoryNumSet(true); setFactoryMarkers([]); 
    setError('');
  };
  const handleConfirmFactories = async () => {
    setFactorySaveStatus('A guardar fábricas...');
    setError('');
    try {
      const response = await fetch("http://localhost:5000/save-factories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: factoryMarkers }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      const data = await response.json();
      setFactorySaveStatus(data.message);
      setCurrentPhase('clients');
      setError(''); 
    } catch (err) {
      setError(`Não foi possível guardar: ${err.message}`);
      setFactorySaveStatus('');
    }
  };

  const handleClientNumChange = (e) => setNumClients(e.target.value);
  const handleClientGenerate = () => {
    const num = parseInt(numClients);
    if (isNaN(num) || num <= 0) { setError('Por favor, insira um número inteiro e positivo.'); return; }
    setTargetNumClients(num); setIsClientNumSet(true); setClientMarkers([]); 
    setError('');
  };
  const handleConfirmClients = async () => {
    setClientSaveStatus('A guardar clientes...');
    setError('');
    try {
      const response = await fetch("http://localhost:5000/save-clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: clientMarkers }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      const data = await response.json();
      setClientSaveStatus(data.message);
      setCurrentPhase('dcs');
      setError('');
    } catch (err) {
      setError(`Não foi possível guardar: ${err.message}`);
      setClientSaveStatus('');
    }
  };

  const handleDcNumChange = (e) => setNumDcs(e.target.value);
  const handleDcGenerate = () => {
    const num = parseInt(numDcs);
    if (isNaN(num) || num <= 0) { setError('Por favor, insira um número inteiro e positivo.'); return; }
    setTargetNumDcs(num); setIsDcNumSet(true); setDcMarkers([]);
    setError('');
  };
  const handleConfirmDcs = async () => {
    setDcSaveStatus('A guardar Centros de Distribuição...');
    setError('');
    try {
      const response = await fetch("http://localhost:5000/save-distribution-centers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: dcMarkers }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      const data = await response.json();
      setDcSaveStatus(data.message); 
      setCurrentPhase('analysis');
      setError('');
    } catch (err) {
      setError(`Não foi possível guardar: ${err.message}`);
      setDcSaveStatus('');
    }
  };

  // --- LÓGICA DA FASE 4 (Análise) (Sem alteração) ---
  const handleRunGravityAnalysis = async () => {
    setError('');
    setAnalysisResult(null);
    setAllAdjustmentsDone(false);
    setAdjustmentSaveStatus(''); 
    try {
      const response = await fetch("http://localhost:5000/calculate-gravity-by-country", {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAnalysisResult(data.results);
    } catch (err) {
      setError(err.message);
    }
  };

  // --- LÓGICA DA FASE 5 (Ajuste) (Sem alteração) ---
  const handleStartAdjustment = (country, optimal_point) => {
    setAdjustingCountry({ country: country, optimal_point: optimal_point });
    setNewCdMarker({
      lat: '',
      lng: '',
      w: '1',
      custo_fixo: '',
      address: 'Procure uma morada ou clique no mapa...',
      country: country, 
    });
    setCurrentPhase('adjusting_cd'); 
    setError('');
  };

  const handleConfirmSingleAdjustedCd = async () => {
    setAdjustmentSaveStatus('A guardar novo CD...');
    setError('');
    try {
      const response = await fetch("http://localhost:5000/add-distribution-centers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: [newCdMarker] }), 
      });
      if (!response.ok) throw new Error((await response.json()).error);
      const data = await response.json();
      setDcMarkers(prev => [...prev, newCdMarker]);
      const countryToRemove = adjustingCountry.country;
      const newAnalysisResult = { ...analysisResult };
      delete newAnalysisResult[countryToRemove];
      setAnalysisResult(newAnalysisResult);
      if (Object.keys(newAnalysisResult).length === 0) {
        setAllAdjustmentsDone(true); 
        setAdjustmentSaveStatus(''); 
      } else {
        setAdjustmentSaveStatus(data.message); 
      }
      setCurrentPhase('analysis');
      setNewCdMarker(null);
      setAdjustingCountry(null);
    } catch (err) {
      setError(`Não foi possível adicionar o CD: ${err.message}`);
      setAdjustmentSaveStatus('');
    }
  };

  const handleCancelAdjustment = () => {
    setCurrentPhase('analysis');
    setNewCdMarker(null);
    setAdjustingCountry(null);
    setError('');
  };


  // --- FUNÇÕES GERAIS / RESET (Sem alteração) ---
  const handleReset = () => {
    setCurrentPhase('factories');
    setNumFactories(''); setIsFactoryNumSet(false); setTargetNumFactories(0);
    setFactoryMarkers([]); setFactorySaveStatus('');
    setNumClients(''); setIsClientNumSet(false); setTargetNumClients(0);
    setClientMarkers([]); setClientSaveStatus('');
    setNumDcs(''); setIsDcNumSet(false); setTargetNumDcs(0);
    setDcMarkers([]); setDcSaveStatus('');
    setError('');
    setAnalysisResult(null);
    setAdjustingCountry(null);
    setNewCdMarker(null);
    setAdjustmentSaveStatus('');
    setAllAdjustmentsDone(false);
    autocompleteRefs.current = [];
    autocompleteClientRefs.current = [];
    autocompleteDcRefs.current = [];
    autocompleteAdjustRef.current = null;
  };

  // --- FUNÇÃO PRESET (ATUALIZADA) ---
  const handleLoadPreset = async (presetName) => {
    setPresetLoading(true);
    setError('');
    setFactorySaveStatus('');
    
    try {
      const response = await fetch(`http://localhost:5000/load-preset/${presetName}`, {
        method: 'POST',
      });
      const data = await response.json(); 
      if (!response.ok) throw new Error(data.error);

      // 1. Limpa a UI
      handleReset(); 
      
      // 2. CARREGA os marcadores
      setFactoryMarkers(data.factories);
      setClientMarkers(data.clients);
      setDcMarkers(data.dcs);

      // 3. Define a mensagem de sucesso e avança para a fase de Análise
      setFactorySaveStatus(data.message);
      setCurrentPhase('analysis'); 
      setDcSaveStatus(`Cenário '${presetName}' carregado.`);

      // --- LÓGICA DE SALTO (A SUA SUGESTÃO) ---
      // Se for o Cenário B, salta diretamente para o ecrã "Concluído"
      if (presetName === 'preset_B') {
        setAllAdjustmentsDone(true);
      }
      // --- FIM DA LÓGICA DE SALTO ---

    } catch (err) {
      setError(`Não foi possível carregar: ${err.message}`);
    } finally {
      setPresetLoading(false);
    }
  };


  if (loadError) return <div>Erro ao carregar o mapa.</div>;
  if (!isLoaded) return <div style={{ color: 'white' }}>A carregar o mapa...</div>;


  // --- RENDERIZAÇÃO ---

  // RENDER FASE 1 (Fábricas) - (Sem alteração)
  const renderFactorySetup = () => (
    <>
      <h2>1. Configuração das Fábricas</h2>
      {!isFactoryNumSet ? (
        <div className="input-group">
          <label htmlFor="num-factories">Número de fábricas (num):</label>
          <input type="number" id="num-factories" value={numFactories} onChange={handleFactoryNumChange} placeholder="Ex: 2" />
          {error && <p className="error-message">{error}</p>}
          <button onClick={handleFactoryGenerate}>Generate</button>
        </div>
      ) : (
        <div>
          <div className="user-guidance">
            <p>Número de fábricas a adicionar: <strong>{targetNumFactories}</strong></p>
            {factoryMarkers.length < targetNumFactories ? (<p>Clique no mapa para adicionar as <strong>{targetNumFactories - factoryMarkers.length}</strong> restantes.</p>) : (<p>Todas as fábricas foram adicionadas.</p>)}
          </div>
          <ul className="points-list interactive-list">
            {factoryMarkers.map((marker, index) => (
              <li key={`factory-${index}`} className="marker-editor">
                <strong>Fábrica {index + 1} {marker.country && `(${marker.country})`}</strong>
                <div className="numeric-inputs">
                  <div className="input-wrapper"><label>Latitude</label><input type="number" step="0.000001" value={marker.lat} onChange={(e) => handleCoordChange(index, 'factory', 'lat', e.target.value)} /></div>
                  <div className="input-wrapper"><label>Longitude</label><input type="number" step="0.000001" value={marker.lng} onChange={(e) => handleCoordChange(index, 'factory', 'lng', e.target.value)} /></div>
                  <div className="input-wrapper weight-wrapper">
                    <label>Capacidade Anual da Fábrica (Unidades):</label>
                    <input type="text" pattern="[0-9]*\.?[0-9]*" value={marker.w} onChange={(e) => handleWeightChange(index, 'factory', e.target.value)} />
                  </div>
                </div>
                <Autocomplete onLoad={(autocomplete) => autocompleteRefs.current[index] = autocomplete} onPlaceChanged={() => onPlaceChanged(index, 'factory')}>
                  <input type="text" placeholder="Escreva uma morada..." value={marker.address} onChange={(e) => updateMarker(index, 'factory', 'address', e.target.value)} className="address-input" />
                </Autocomplete>
              </li>
            ))}
          </ul>
          {error && <p className="error-message">{error}</p>}
          {factorySaveStatus && <p style={{color: '#1abc9c'}}>{factorySaveStatus}</p>}
        </div>
      )}
      <div className="button-group">
        {isFactoryNumSet && (
          <button onClick={handleConfirmFactories} disabled={factoryMarkers.length !== targetNumFactories || factoryMarkers.length === 0}>
            Confirmar Localização das Fábricas
          </button>
        )}
      </div>
    </>
  );

  // RENDER FASE 2 (Clientes) - (Sem alteração)
  const renderClientSetup = () => (
    <>
      <h2>2. Configuração dos Clientes</h2>
      <div className="result-card" style={{borderColor: '#1abc9c'}}>
          <p><strong>{factorySaveStatus}</strong> As fábricas estão no mapa (marcadores azuis).</p>
      </div>
      {!isClientNumSet ? (
        <div className="input-group">
          <label htmlFor="num-clients">Número de clientes (num):</label>
          <input type="number" id="num-clients" value={numClients} onChange={handleClientNumChange} placeholder="Ex: 10" />
          {error && <p className="error-message">{error}</p>}
          <button onClick={handleClientGenerate}>Generate</button>
        </div>
      ) : (
        <div>
          <div className="user-guidance">
            <p>Número de clientes a adicionar: <strong>{targetNumClients}</strong></p>
            {clientMarkers.length < targetNumClients ? (<p>Clique no mapa para adicionar os <strong>{targetNumClients - clientMarkers.length}</strong> restantes.</p>) : (<p>Todos os clientes foram adicionados.</p>)}
          </div>
          <ul className="points-list interactive-list">
            {clientMarkers.map((marker, index) => (
              <li key={`client-${index}`} className="marker-editor">
                <strong>Cliente {index + 1} {marker.country && `(${marker.country})`}</strong>
                <div className="numeric-inputs">
                  <div className="input-wrapper"><label>Latitude</label><input type="number" step="0.000001" value={marker.lat} onChange={(e) => handleCoordChange(index, 'client', 'lat', e.target.value)} /></div>
                  <div className="input-wrapper"><label>Longitude</label><input type="number" step="0.000001" value={marker.lng} onChange={(e) => handleCoordChange(index, 'client', 'lng', e.target.value)} /></div>
                  <div className="input-wrapper weight-wrapper">
                    <label>Procura Anual do Cliente (Unidades):</label>
                    <input type="text" pattern="[0-9]*\.?[0-9]*" value={marker.w} onChange={(e) => handleWeightChange(index, 'client', e.target.value)} />
                  </div>
                </div>
                <Autocomplete onLoad={(autocomplete) => autocompleteClientRefs.current[index] = autocomplete} onPlaceChanged={() => onPlaceChanged(index, 'client')}>
                  <input type="text" placeholder="Escreva uma morada..." value={marker.address} onChange={(e) => updateMarker(index, 'client', 'address', e.target.value)} className="address-input" />
                </Autocomplete>
              </li>
            ))}
          </ul>
          {error && <p className="error-message">{error}</p>}
          {clientSaveStatus && <p style={{color: '#1abc9c'}}>{clientSaveStatus}</p>}
        </div>
      )}
      <div className="button-group">
        {isClientNumSet && (
          <button onClick={handleConfirmClients} disabled={clientMarkers.length !== targetNumClients || clientMarkers.length === 0}>
            Confirmar Localização dos Clientes
          </button>
        )}
      </div>
    </>
  );

  // RENDER FASE 3 (CDs) - (Sem alteração)
  const renderDcSetup = () => (
    <>
      <h2>3. Configuração dos Centros de Distribuição (Existentes)</h2>
      <div className="user-guidance">
          <p>Opcional: Adicione aqui os Centros de Distribuição que já existem na sua rede.</p>
      </div>
      {!isDcNumSet ? (
        <div className="input-group">
          <label htmlFor="num-dcs">Número de CDs Existentes (num):</label>
          <input type="number" id="num-dcs" value={numDcs} onChange={handleDcNumChange} placeholder="Ex: 0" />
          {error && <p className="error-message">{error}</p>}
          <button onClick={handleDcGenerate}>Generate</button>
        </div>
      ) : (
        <div>
          <div className="user-guidance">
            <p>Número de CDs a adicionar: <strong>{targetNumDcs}</strong></p>
            {dcMarkers.length < targetNumDcs ? (<p>Clique no mapa para adicionar os <strong>{targetNumDcs - dcMarkers.length}</strong> restantes.</p>) : (<p>Todos os CDs foram adicionados.</p>)}
          </div>
          <ul className="points-list interactive-list">
            {dcMarkers.map((marker, index) => (
              <li key={`dc-${index}`} className="marker-editor">
                <strong>Centro de Distribuição {index + 1} {marker.country && `(${marker.country})`}</strong>
                <div className="numeric-inputs">
                  <div className="input-wrapper"><label>Latitude</label><input type="number" step="0.000001" value={marker.lat} onChange={(e) => handleCoordChange(index, 'dc', 'lat', e.target.value)} /></div>
                  <div className="input-wrapper"><label>Longitude</label><input type="number" step="0.000001" value={marker.lng} onChange={(e) => handleCoordChange(index, 'dc', 'lng', e.target.value)} /></div>
                  <div className="input-wrapper weight-wrapper">
                    <label>Capacidade Anual da Armazenamento (Unidades):</label>
                    <input type="text" pattern="[0-9]*\.?[0-9]*" value={marker.w} onChange={(e) => handleWeightChange(index, 'dc', e.target.value)} />
                  </div>
                  <div className="input-wrapper weight-wrapper">
                    <label>Custo Fixo Anual (€):</label>
                    <input 
                      type="text" 
                      pattern="[0-9]*\.?[0-9]*" 
                      value={marker.custo_fixo} 
                      onChange={(e) => handleCostChange(index, 'dc', e.target.value)} 
                      placeholder="Ex: 1000"
                    />
                  </div>
                </div>
                <Autocomplete onLoad={(autocomplete) => autocompleteDcRefs.current[index] = autocomplete} onPlaceChanged={() => onPlaceChanged(index, 'dc')}>
                  <input type="text" placeholder="Escreva uma morada..." value={marker.address} onChange={(e) => updateMarker(index, 'dc', 'address', e.target.value)} className="address-input" />
                </Autocomplete>
              </li>
            ))}
          </ul>
          {error && <p className="error-message">{error}</p>}
          {dcSaveStatus && <p style={{color: '#1abc9c'}}>{dcSaveStatus}</p>}
        </div>
      )}
      <div className="button-group">
        <button onClick={handleConfirmDcs} disabled={isDcNumSet && dcMarkers.length !== targetNumDcs}>
            Confirmar CDs Existentes e Avançar
        </button>
      </div>
    </>
  );

  // RENDER FASE 4 (Análise) - (Sem alteração)
  const renderAnalysisPhase = () => (
    <>
      <h2>4. Análise de Rede</h2>
      {allAdjustmentsDone ? (
        // 4c. ESTADO FINAL (O que o Cenário B ativa)
        <>
          <div className="result-card" style={{borderColor: '#1abc9c'}}>
              <h4>Configuração Concluída!</h4>
              <p>Todos os dados estão configurados. Os novos Centros de Distribuição (marcadores verdes) foram guardados e estão visíveis no mapa.</p>
          </div>
          <div className="button-group">
            <Link to="/distances">
              <button>Consultar Distâncias (CDs, Fábricas, Clientes)</button>
            </Link>
          </div>
        </>
      ) : analysisResult ? (
        // 4b. ESTADO DE RESULTADOS (O que o Cenário A ativa)
        <>
          <div className="button-group">
            <button onClick={handleRunGravityAnalysis}>
              Recalcular Pontos Ótimos
            </button>
          </div>
          {error && <p className="error-message">{error}</p>}
          {adjustmentSaveStatus && <p style={{color: '#1abc9c', marginTop: '1rem'}}>{adjustmentSaveStatus}</p>}
          <div className="results-container">
            <h3 style={{marginTop: '2rem'}}>Resultados da Análise</h3>
            {Object.keys(analysisResult).length > 0 ? (
              Object.keys(analysisResult).map(country => (
                <div key={country} className="result-card" style={{borderColor: '#3498db'}}>
                  <h4>Ponto Ótimo: {country}</h4>
                  <div className="result-item">
                    <span>Clientes:</span>
                    <p>{analysisResult[country].client_count}</p>
                  </div>
                  <div className="result-item">
                    <span>Coords (Lat, Lng):</span>
                    <p>{analysisResult[country].final_point.lat.toFixed(6)}, {analysisResult[country].final_point.lng.toFixed(6)}</p>
                  </div>
                  <button 
                    onClick={() => handleStartAdjustment(country, analysisResult[country].final_point)}
                    style={{width: '100%', marginTop: '10px'}}
                  >
                    Ajustar Localização Final
                  </button>
                </div>
              ))
            ) : (
              <p>Não foram encontrados clientes para calcular pontos ótimos.</p>
            )}
          </div>
        </>
      ) : (
        // 4a. ESTADO INICIAL
        <>
          <div className="result-card" style={{borderColor: '#1abc9c'}}>
              <p><strong>{dcSaveStatus || 'Rede definida.'}</strong></p>
              <p>Pronto para calcular novos pontos ótimos com base nos clientes.</p>
          </div>
          <div className="button-group">
            <button onClick={handleRunGravityAnalysis}>
              Utilizar o método gravítico de localização em cada país
            </button>
          </div>
          {error && <p className="error-message">{error}</p>}
          {adjustmentSaveStatus && <p style={{color: '#1abc9c', marginTop: '1rem'}}>{adjustmentSaveStatus}</p>}
        </>
      )}
    </>
  );

  // RENDER FASE 5 (Ajuste) - (Sem alteração)
  const renderAdjustCdPhase = () => (
    <>
      <h2>5. Ajustar Localização de CD ({adjustingCountry.country})</h2>
      <div className="user-guidance">
          <p>O ponto ótimo (marcador preto) é a sua referência.
          Procure uma zona industrial ou local viável e clique no mapa, ou use a pesquisa de morada, para definir o novo CD (marcador verde).</p>
      </div>
      {newCdMarker && (
        <ul className="points-list interactive-list">
          <li className="marker-editor">
            <strong>Novo CD para {adjustingCountry.country}</strong>
            <div className="numeric-inputs">
              <div className="input-wrapper"><label>Latitude</label><input type="number" step="0.000001" value={newCdMarker.lat} onChange={(e) => handleCoordChange(null, 'adjust', 'lat', e.target.value)} /></div>
              <div className="input-wrapper"><label>Longitude</label><input type="number" step="0.000001" value={newCdMarker.lng} onChange={(e) => handleCoordChange(null, 'adjust', 'lng', e.target.value)} /></div>
              <div className="input-wrapper weight-wrapper">
                <label>Capacidade Anual da Armazenamento (Unidades):</label>
                <input type="text" pattern="[0-9]*\.?[0-9]*" value={newCdMarker.w} onChange={(e) => handleWeightChange(null, 'adjust', e.target.value)} />
              </div>
              <div className="input-wrapper weight-wrapper">
                <label>Custo Fixo Anual (€):</label>
                <input 
                  type="text" 
                  pattern="[0-9]*\.?[0-9]*" 
                  value={newCdMarker.custo_fixo} 
                  onChange={(e) => handleCostChange(null, 'adjust', e.target.value)} 
                  placeholder="Ex: 1000"
                />
              </div>
            </div>
            <Autocomplete onLoad={(autocomplete) => autocompleteAdjustRef.current = autocomplete} onPlaceChanged={() => onPlaceChanged(null, 'adjust')}>
              <input type="text" placeholder="Escreva uma morada..." value={newCdMarker.address} onChange={(e) => updateMarker(null, 'adjust', 'address', e.target.value)} className="address-input" />
            </Autocomplete>
          </li>
        </ul>
      )}
      {error && <p className="error-message">{error}</p>}
      {adjustmentSaveStatus && <p style={{color: '#1abc9c'}}>{adjustmentSaveStatus}</p>}
      <div className="button-group">
        <button onClick={handleConfirmSingleAdjustedCd} disabled={!newCdMarker || !newCdMarker.lat}>
          Confirmar e Guardar Novo CD ({adjustingCountry.country})
        </button>
        <button onClick={handleCancelAdjustment} style={{backgroundColor: '#888'}}>
          Cancelar
        </button>
      </div>
    </>
  );


  // --- RENDERIZAÇÃO PRINCIPAL ---
  return (
    <div className="map-page-container">
      <div className="map-panel">
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={initialCenter}
          zoom={12}
          onClick={handleMapClick}
          options={{ disableDefaultUI: true, zoomControl: true, fullscreenControl: true }}
        >
          {/* Marcadores de Fábricas (Azul) */}
          {factoryMarkers.map((marker, index) => (
            <Marker key={`factory-m-${index}`} position={{ lat: marker.lat, lng: marker.lng }} icon={factoryIcon} />
          ))}
          {/* Marcadores de Clientes (Vermelho - Padrão) */}
          {clientMarkers.map((marker, index) => (
            <Marker key={`client-m-${index}`} position={{ lat: marker.lat, lng: marker.lng }} />
          ))}
          {/* Marcadores de CDs (Verde - Fases 3 e 5) */}
          {dcMarkers.map((marker, index) => (
            <Marker key={`dc-m-${index}`} position={{ lat: marker.lat, lng: marker.lng }} icon={dcIcon} />
          ))}
          {/* Marcadores de Pontos Ótimos (Preto) */}
          {analysisResult && (currentPhase === 'analysis' || currentPhase === 'adjusting_cd') && Object.keys(analysisResult).map(country => (
            <Marker 
              key={`result-${country}`}
              position={analysisResult[country].final_point}
              icon={{ url: "http://googleusercontent.com/maps/google/com/0" }}
              label={country} 
            />
          ))}
          {/* Marcador de Ponto Ótimo de Referência (Preto, na Fase de Ajuste) */}
          {currentPhase === 'adjusting_cd' && adjustingCountry && (
             <Marker 
              key={`ref-${adjustingCountry.country}`}
              position={adjustingCountry.optimal_point}
              icon={{ url: "http://googleusercontent.com/maps/google/com/0" }}
              label={`Ótimo (${adjustingCountry.country})`}
            />
          )}
          {/* Marcador do Novo CD (Verde, a ser editado) */}
          {currentPhase === 'adjusting_cd' && newCdMarker && newCdMarker.lat && (
             <Marker 
              key="new-cd-marker"
              position={newCdMarker}
              icon={dcIcon}
            />
          )}
        </GoogleMap>
      </div>

      <div className="sidebar-panel">
        
        {/* BLOCO DE PRESET (ATUALIZADO) */}
        <div className="preset-loader" style={{borderBottom: '1px solid #3a3a5e', paddingBottom: '1.5rem', marginBottom: '1.5rem'}}>
          <h4>Carregar Cenário</h4>
          <p style={{color: '#aaa', fontSize: '0.9rem', margin: '0.5rem 0'}}>
            Isto irá limpar todos os dados atuais e carregar um conjunto pré-definido.
          </p>
          <div className="button-group" style={{flexDirection: 'row', gap: '1rem'}}>
            <button 
              onClick={() => handleLoadPreset('preset_A')}
              disabled={presetLoading}
              style={{width: '100%', backgroundColor: '#555'}}
            >
              {presetLoading ? "A carregar..." : "Carregar Cenário 'A'"}
            </button>
            {/* NOVO BOTÃO */}
            <button 
              onClick={() => handleLoadPreset('preset_B')}
              disabled={presetLoading}
              style={{width: '100%', backgroundColor: '#555'}}
            >
              {presetLoading ? "A carregar..." : "Carregar Cenário 'B' (Completo)"}
            </button>
          </div>
        </div>
        {/* Fim do bloco de preset */}

        
        {/* Renderização Condicional da Sidebar (O resto do seu código) */}
        {
          currentPhase === 'factories' ? renderFactorySetup() :
          currentPhase === 'clients'   ? renderClientSetup() :
          currentPhase === 'dcs'       ? renderDcSetup() :
          currentPhase === 'analysis'  ? renderAnalysisPhase() :
          currentPhase === 'adjusting_cd' ? renderAdjustCdPhase() :
          null
        }
        
        {/* Botões Globais (Reset e Home) */}
        <div className="button-group" style={{marginTop: '1.5rem'}}>
          <button onClick={handleReset}>Começar de Novo</button>
          <button onClick={onGoHome}>Voltar à Home</button>
        </div>
        
      </div>
    </div>
  );
}

export default MapPage;