// ============================================
// Estado da aplicação - Foco em terrenos
// ============================================
let criteria = [
    { id: 'c0', name: 'Preço (R$)', weight: 25, norm: { mode: 'raw', direction: 'lower' } },
    { id: 'c1', name: 'Área (m²)', weight: 15, norm: { mode: 'raw', direction: 'higher' } },
    { id: 'c2', name: 'Localização', weight: 15, norm: { mode: 'manual' } },
    { id: 'c3', name: 'Topografia', weight: 10, norm: { mode: 'manual' } },
    { id: 'c4', name: 'Tipo de solo', weight: 10, norm: { mode: 'manual' } },
    { id: 'c5', name: 'Potencial construtivo', weight: 15, norm: { mode: 'manual' } },
    { id: 'c6', name: 'Infraestrutura', weight: 10, norm: { mode: 'manual' } }
];

let terrains = [
    { id: 't0', name: 'Terreno A', lat: -23.5505, lng: -46.6333 }, // São Paulo
    { id: 't1', name: 'Terreno B', lat: -22.9068, lng: -43.1729 }, // Rio de Janeiro
    { id: 't2', name: 'Terreno C', lat: -19.9167, lng: -43.9345 }  // Belo Horizonte
];

// Notas calculadas (0-10)
let scores = {};

// Valores brutos para critérios normalizados
let rawValues = {};

function initData() {
    scores = {};
    rawValues = {};
    criteria.forEach(c => {
        scores[c.id] = {};
        rawValues[c.id] = {};
        terrains.forEach(t => {
            if (c.norm.mode === 'raw') {
                // Valores iniciais para exemplos
                if (c.id === 'c0') rawValues[c.id][t.id] = 1500; // preço
                else if (c.id === 'c1') rawValues[c.id][t.id] = 500; // área
                else rawValues[c.id][t.id] = 0;
                scores[c.id][t.id] = 5; // temporário
            } else {
                scores[c.id][t.id] = 5;
                rawValues[c.id][t.id] = 0;
            }
        });
    });
    // Recalcula notas dos critérios raw
    criteria.forEach(c => {
        if (c.norm.mode === 'raw') recalcNorm(c.id);
    });
}
initData();

// ============================================
// Elementos DOM
// ============================================
const criteriaListDiv = document.getElementById('criteria-list');
const terrainsListDiv = document.getElementById('terrains-list');
const scoresThead = document.getElementById('scores-thead');
const scoresTbody = document.getElementById('scores-tbody');
const rankingListDiv = document.getElementById('ranking-list');
const addCriterionBtn = document.getElementById('add-criterion');
const addTerrainBtn = document.getElementById('add-terrain');
const addDistanceSupplierBtn = document.getElementById('add-distance-supplier');
const addDistanceUrbanBtn = document.getElementById('add-distance-urban');
const addAccessBtn = document.getElementById('add-access');
const exportPdfBtn = document.getElementById('export-pdf');
const exportXlsxBtn = document.getElementById('export-xlsx');
const weightWarning = document.getElementById('weight-warning');
const startTourBtn = document.getElementById('start-tour');

// Abas
const tabLearn = document.getElementById('tab-learn');
const tabSimulator = document.getElementById('tab-simulator');
const tabMap = document.getElementById('tab-map');
const tabExamples = document.getElementById('tab-examples');
const learnContent = document.getElementById('learn-content');
const simulatorContent = document.getElementById('simulator-content');
const mapContent = document.getElementById('map-content');
const examplesContent = document.getElementById('examples-content');

// Botões de exemplo
const loadExample1Btn = document.getElementById('load-example-1');
const loadExample2Btn = document.getElementById('load-example-2');

// Elementos do mapa
const addressSearch = document.getElementById('address-search');
const searchBtn = document.getElementById('search-btn');
const measureBtn = document.getElementById('measure-distance');
const clearBtn = document.getElementById('clear-measurements');
const distanceInfo = document.getElementById('distance-info');
const distanceValue = document.getElementById('distance-value');

// Gráficos
let barChart, radarChart;

// Variáveis do mapa
let map;
let markers = [];
let drawnItems;
let measuringMode = false;

// ============================================
// Sistema de notificações (toasts)
// ============================================
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
        color: white;
        padding: 12px 24px;
        border-radius: 50px;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        opacity: 0;
        transform: translateY(20px);
        transition: opacity 0.3s, transform 0.3s;
    `;
    document.body.appendChild(toast);
    
    // Forçar reflow
    toast.offsetHeight;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================
// Importação CSV
// ============================================
function importCSV() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            const csv = event.target.result;
            parseCSV(csv);
        };
        reader.readAsText(file);
    };
    input.click();
}

function parseCSV(csv) {
    const lines = csv.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) {
        showToast('Arquivo CSV vazio ou inválido', 'error');
        return;
    }
    
    const header = lines[0].split(',').map(s => s.trim());
    // Formato esperado: Nome,Lat,Lng,Preco,Area,Localizacao,Topografia,Solo,Potencial,Infra
    // ou genérico: primeiro campo = nome do terreno, depois lat, lng, e então valores para cada critério na ordem atual
    
    // Vamos usar um formato flexível: a primeira linha deve conter os nomes dos critérios (exceto as 3 primeiras colunas: Nome,Lat,Lng)
    const criteriaNames = header.slice(3); // a partir da quarta coluna
    // Verificar se os critérios atuais correspondem
    if (criteriaNames.length !== criteria.length) {
        showToast('Número de colunas não corresponde ao número de critérios', 'error');
        return;
    }
    
    // Criar novos terrenos
    const newTerrains = [];
    const newRawValues = {};
    const newScores = {};
    
    // Inicializar estruturas para novos valores
    criteria.forEach(c => {
        newRawValues[c.id] = {};
        newScores[c.id] = {};
    });
    
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(s => s.trim());
        if (cols.length < 3) continue;
        
        const name = cols[0];
        const lat = parseFloat(cols[1]);
        const lng = parseFloat(cols[2]);
        if (isNaN(lat) || isNaN(lng)) {
            showToast(`Linha ${i+1}: coordenadas inválidas`, 'error');
            continue;
        }
        
        const terrainId = generateId('t');
        newTerrains.push({ id: terrainId, name, lat, lng });
        
        // Processar valores dos critérios
        for (let j = 0; j < criteria.length; j++) {
            const val = parseFloat(cols[3 + j]);
            if (isNaN(val)) continue;
            
            const c = criteria[j];
            if (c.norm.mode === 'raw') {
                newRawValues[c.id][terrainId] = val;
                // Nota será calculada depois
            } else {
                // Se for manual, o valor deve ser nota 0-10
                newScores[c.id][terrainId] = Math.min(10, Math.max(0, val));
                newRawValues[c.id][terrainId] = 0;
            }
        }
    }
    
    if (newTerrains.length === 0) {
        showToast('Nenhum terreno válido encontrado', 'error');
        return;
    }
    
    // Substituir dados atuais
    terrains = newTerrains;
    
    // Inicializar scores e rawValues para todos os critérios com valores padrão onde não foram preenchidos
    criteria.forEach(c => {
        terrains.forEach(t => {
            if (newRawValues[c.id] && newRawValues[c.id][t.id] !== undefined) {
                // já tem valor bruto
            } else {
                newRawValues[c.id][t.id] = 0;
            }
            if (newScores[c.id] && newScores[c.id][t.id] !== undefined) {
                // já tem nota manual
            } else {
                newScores[c.id][t.id] = 5;
            }
        });
    });
    
    rawValues = newRawValues;
    scores = newScores;
    
    // Recalcular notas dos critérios raw
    criteria.forEach(c => {
        if (c.norm.mode === 'raw') recalcNorm(c.id);
    });
    
    updateAll();
    if (map) updateMapMarkers();
    showToast(`${newTerrains.length} terrenos importados com sucesso!`, 'success');
}

// Botão de importação
const importCsvBtn = document.createElement('button');
importCsvBtn.id = 'import-csv';
importCsvBtn.className = 'btn btn-secondary';
importCsvBtn.innerHTML = '<i data-feather="upload-cloud"></i> Importar CSV';
importCsvBtn.addEventListener('click', importCSV);
document.querySelector('.export-buttons').appendChild(importCsvBtn);

// ============================================
// Gráfico de contribuição (barras empilhadas)
// ============================================
let contributionChart;

function showContributionChart() {
    if (contributionChart) contributionChart.destroy();
    
    const ctx = document.getElementById('contribution-chart');
    if (!ctx) {
        // Criar canvas se não existir
        const canvas = document.createElement('canvas');
        canvas.id = 'contribution-chart';
        canvas.width = 400;
        canvas.height = 300;
        document.querySelector('.charts').appendChild(canvas);
    }
    
    const labels = terrains.map(t => t.name);
    const datasets = criteria.map((c, idx) => ({
        label: c.name,
        data: terrains.map(t => (scores[c.id][t.id] || 0) * (c.weight / 100)),
        backgroundColor: `hsl(${idx * 30}, 70%, 60%)`,
    }));
    
    contributionChart = new Chart(document.getElementById('contribution-chart'), {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Contribuição de cada critério para a pontuação final'
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const label = context.dataset.label || '';
                            const value = context.raw.toFixed(2);
                            return `${label}: ${value} pontos`;
                        }
                    }
                }
            },
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true, max: 10 }
            }
        }
    });
}

// Botão para mostrar gráfico de contribuição
const contribBtn = document.createElement('button');
contribBtn.id = 'show-contribution';
contribBtn.className = 'btn btn-secondary';
contribBtn.innerHTML = '<i data-feather="bar-chart-2"></i> Contribuição';
contribBtn.addEventListener('click', () => {
    showContributionChart();
    // Rolar até o gráfico
    document.getElementById('contribution-chart').scrollIntoView({ behavior: 'smooth' });
});
document.querySelector('.export-buttons').appendChild(contribBtn);

// ============================================
// Links compartilháveis
// ============================================
function getStateString() {
    const state = {
        criteria: criteria.map(c => ({
            id: c.id,
            name: c.name,
            weight: c.weight,
            norm: c.norm
        })),
        terrains: terrains.map(t => ({
            id: t.id,
            name: t.name,
            lat: t.lat,
            lng: t.lng
        })),
        scores: scores,
        rawValues: rawValues
    };
    const json = JSON.stringify(state);
    return btoa(encodeURIComponent(json)); // Base64 seguro para URL
}

function loadStateFromString(encoded) {
    try {
        const json = decodeURIComponent(atob(encoded));
        const state = JSON.parse(json);
        
        criteria = state.criteria;
        terrains = state.terrains;
        scores = state.scores;
        rawValues = state.rawValues;
        
        updateAll();
        if (map) updateMapMarkers();
        showToast('Simulação carregada do link!', 'success');
    } catch (e) {
        showToast('Link inválido ou corrompido', 'error');
    }
}

function shareSimulation() {
    const stateStr = getStateString();
    const url = new URL(window.location);
    url.searchParams.set('state', stateStr);
    navigator.clipboard.writeText(url.toString()).then(() => {
        showToast('Link copiado para a área de transferência!', 'success');
    }).catch(() => {
        showToast('Erro ao copiar link', 'error');
    });
}

// Verificar se há parâmetro 'state' na URL ao carregar
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const stateParam = urlParams.get('state');
    if (stateParam) {
        loadStateFromString(stateParam);
    }
});

// Botão de compartilhar
const shareBtn = document.createElement('button');
shareBtn.id = 'share-simulation';
shareBtn.className = 'btn btn-secondary';
shareBtn.innerHTML = '<i data-feather="share-2"></i> Compartilhar';
shareBtn.addEventListener('click', shareSimulation);
document.querySelector('.export-buttons').appendChild(shareBtn);

// ============================================
// Exportar/importar JSON
// ============================================
function exportJSON() {
    const state = {
        criteria: criteria,
        terrains: terrains,
        scores: scores,
        rawValues: rawValues
    };
    const json = JSON.stringify(state, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `terrenos_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const state = JSON.parse(event.target.result);
                criteria = state.criteria;
                terrains = state.terrains;
                scores = state.scores;
                rawValues = state.rawValues;
                updateAll();
                if (map) updateMapMarkers();
                showToast('Simulação carregada com sucesso!', 'success');
            } catch (err) {
                showToast('Arquivo JSON inválido', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// Botões
const exportJsonBtn = document.createElement('button');
exportJsonBtn.id = 'export-json';
exportJsonBtn.className = 'btn btn-secondary';
exportJsonBtn.innerHTML = '<i data-feather="download"></i> JSON';
exportJsonBtn.addEventListener('click', exportJSON);

const importJsonBtn = document.createElement('button');
importJsonBtn.id = 'import-json';
importJsonBtn.className = 'btn btn-secondary';
importJsonBtn.innerHTML = '<i data-feather="upload"></i> JSON';
importJsonBtn.addEventListener('click', importJSON);

document.querySelector('.export-buttons').appendChild(exportJsonBtn);
document.querySelector('.export-buttons').appendChild(importJsonBtn);

// ============================================
// Utilitários
// ============================================
function generateId(prefix) {
    return prefix + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
}

function refreshFeather() {
    if (typeof feather !== 'undefined') feather.replace();
}

// ============================================
// Gerenciamento de abas
// ============================================
function activateTab(tabId) {
    [tabLearn, tabSimulator, tabMap, tabExamples].forEach(t => t.classList.remove('active'));
    [learnContent, simulatorContent, mapContent, examplesContent].forEach(c => c.classList.remove('active'));

    if (tabId === 'learn') {
        tabLearn.classList.add('active');
        learnContent.classList.add('active');
    } else if (tabId === 'simulator') {
        tabSimulator.classList.add('active');
        simulatorContent.classList.add('active');
        setTimeout(() => {
            updateChartsAndRanking();
            refreshFeather();
        }, 100);
    } else if (tabId === 'map') {
        tabMap.classList.add('active');
        mapContent.classList.add('active');
        setTimeout(() => {
            if (!map) initMap();
            else updateMapMarkers();
        }, 200);
    } else if (tabId === 'examples') {
        tabExamples.classList.add('active');
        examplesContent.classList.add('active');
    }
    refreshFeather();
}

tabLearn.addEventListener('click', () => activateTab('learn'));
tabSimulator.addEventListener('click', () => activateTab('simulator'));
tabMap.addEventListener('click', () => activateTab('map'));
tabExamples.addEventListener('click', () => activateTab('examples'));

// ============================================
// Tour interativo
// ============================================
if (startTourBtn) {
    startTourBtn.addEventListener('click', () => {
        introJs().setOptions({
            steps: [
                { title: 'Bem-vindo', intro: 'Ferramenta para comparar terrenos usando o método da pontuação ponderada.' },
                { element: '#terrains-list', title: 'Terrenos', intro: 'Adicione ou remova terrenos. Clique no lápis para editar o nome.' },
                { element: '.manager-panel .btn-group', title: 'Critérios sugeridos', intro: 'Além de criar critérios personalizados, use estes botões para adicionar rapidamente distâncias e acesso, já configurados com normalização automática.' },
                { element: '#criteria-list', title: 'Critérios', intro: 'Cada critério tem botões para escolher o modo: manual (✏️), menor melhor (↓) ou maior melhor (↑).' },
                { element: '.scores-panel', title: 'Tabela', intro: 'Para critérios manuais, insira notas 0-10. Para valores brutos (preço, distância), insira o valor real – a nota é calculada automaticamente.' },
                { element: '.results-panel', title: 'Resultados', intro: 'Compare as pontuações e exporte relatórios.' },
                { element: '#tab-map', title: 'Mapa', intro: 'Visualize os terrenos no mapa, clique nos marcadores para ver detalhes e meça distâncias.' }
            ],
            showProgress: true,
            exitOnOverlayClick: true
        }).start();
    });
}

// ============================================
// Funções de normalização
// ============================================
function recalcNorm(criterionId) {
    const crit = criteria.find(c => c.id === criterionId);
    if (!crit || crit.norm.mode !== 'raw') return;

    const values = terrains.map(t => rawValues[crit.id][t.id]).filter(v => !isNaN(v));
    if (values.length === 0) return;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const direction = crit.norm.direction; // 'lower' ou 'higher'

    terrains.forEach(t => {
        const val = rawValues[crit.id][t.id];
        let nota = 5;
        if (max !== min) {
            if (direction === 'lower') {
                nota = 10 * (1 - (val - min) / (max - min));
            } else {
                nota = 10 * (val - min) / (max - min);
            }
        }
        scores[crit.id][t.id] = Math.round(nota * 10) / 10;
    });
}

// ============================================
// Renderização dos critérios
// ============================================
function renderCriteria() {
    let html = '';
    criteria.forEach(c => {
        const isManual = c.norm.mode === 'manual';
        const isLower = c.norm.mode === 'raw' && c.norm.direction === 'lower';
        const isHigher = c.norm.mode === 'raw' && c.norm.direction === 'higher';

        html += `
            <div class="item-row" data-id="${c.id}">
                <span class="item-name">${c.name}</span>
                <input type="number" class="item-weight" min="0" max="100" value="${c.weight}" step="1" title="Peso %">
                <button class="btn-icon norm-manual ${isManual ? 'active' : ''}" title="Nota manual (0-10)"><i data-feather="edit-3"></i></button>
                <button class="btn-icon norm-lower ${isLower ? 'active' : ''}" title="Menor melhor (valor bruto)"><i data-feather="arrow-down"></i></button>
                <button class="btn-icon norm-higher ${isHigher ? 'active' : ''}" title="Maior melhor (valor bruto)"><i data-feather="arrow-up"></i></button>
                <button class="btn-icon remove-item" title="Remover critério"><i data-feather="trash-2"></i></button>
            </div>
        `;
    });
    criteriaListDiv.innerHTML = html;

    // Eventos de peso
    document.querySelectorAll('#criteria-list .item-weight').forEach(input => {
        input.addEventListener('input', e => {
            const id = e.target.closest('.item-row').dataset.id;
            const newWeight = parseInt(e.target.value) || 0;
            const crit = criteria.find(c => c.id === id);
            if (crit) crit.weight = newWeight;
            validateWeights();
            updateChartsAndRanking();
        });
    });

    // Eventos de modo de normalização
    document.querySelectorAll('#criteria-list .norm-manual').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.closest('.item-row').dataset.id;
            const crit = criteria.find(c => c.id === id);
            if (crit) {
                crit.norm = { mode: 'manual' };
                terrains.forEach(t => {
                    if (scores[crit.id][t.id] === undefined) scores[crit.id][t.id] = 5;
                });
                renderCriteria();
                renderScoresTable();
                updateChartsAndRanking();
            }
        });
    });

    document.querySelectorAll('#criteria-list .norm-lower').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.closest('.item-row').dataset.id;
            const crit = criteria.find(c => c.id === id);
            if (crit) {
                crit.norm = { mode: 'raw', direction: 'lower' };
                terrains.forEach(t => {
                    if (rawValues[crit.id][t.id] === undefined) rawValues[crit.id][t.id] = 0;
                });
                recalcNorm(crit.id);
                renderCriteria();
                renderScoresTable();
                updateChartsAndRanking();
            }
        });
    });

    document.querySelectorAll('#criteria-list .norm-higher').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.closest('.item-row').dataset.id;
            const crit = criteria.find(c => c.id === id);
            if (crit) {
                crit.norm = { mode: 'raw', direction: 'higher' };
                terrains.forEach(t => {
                    if (rawValues[crit.id][t.id] === undefined) rawValues[crit.id][t.id] = 0;
                });
                recalcNorm(crit.id);
                renderCriteria();
                renderScoresTable();
                updateChartsAndRanking();
            }
        });
    });

    // Remover critério
    document.querySelectorAll('#criteria-list .remove-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.closest('.item-row').dataset.id;
            criteria = criteria.filter(c => c.id !== id);
            delete scores[id];
            delete rawValues[id];
            updateAll();
        });
    });

    refreshFeather();
}

// ============================================
// Renderização dos terrenos
// ============================================
function renderTerrains() {
    let html = '';
    terrains.forEach(t => {
        html += `
            <div class="item-row" data-id="${t.id}">
                <span class="item-name">${t.name}</span>
                <button class="btn-icon edit-terrain" title="Editar nome"><i data-feather="edit-2"></i></button>
                <button class="btn-icon remove-terrain" title="Remover terreno"><i data-feather="trash-2"></i></button>
            </div>
        `;
    });
    terrainsListDiv.innerHTML = html;

    // Editar nome
    document.querySelectorAll('#terrains-list .edit-terrain').forEach(btn => {
        btn.addEventListener('click', () => {
            const row = btn.closest('.item-row');
            const id = row.dataset.id;
            const nameSpan = row.querySelector('.item-name');
            const currentName = nameSpan.innerText;

            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentName;
            input.className = 'item-input';
            nameSpan.replaceWith(input);
            input.focus();

            const save = () => {
                const newName = input.value.trim() || currentName;
                const terrain = terrains.find(t => t.id === id);
                if (terrain) terrain.name = newName;
                input.replaceWith(nameSpan);
                nameSpan.innerText = newName;
                renderScoresTable();
                updateChartsAndRanking();
                if (map) updateMapMarkers();
                refreshFeather();
            };
            input.addEventListener('blur', save);
            input.addEventListener('keypress', e => { if (e.key === 'Enter') save(); });
        });
    });

    // Remover terreno
    document.querySelectorAll('#terrains-list .remove-terrain').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.closest('.item-row').dataset.id;
            terrains = terrains.filter(t => t.id !== id);
            criteria.forEach(c => {
                delete scores[c.id][id];
                delete rawValues[c.id][id];
            });
            updateAll();
            if (map) updateMapMarkers();
        });
    });

    refreshFeather();
}

// ============================================
// Adicionar critérios (personalizados e sugeridos)
// ============================================
function addCriterion() {
    const name = prompt('Nome do novo critério:');
    if (!name) return;
    const newId = generateId('c');
    criteria.push({ id: newId, name: name, weight: 10, norm: { mode: 'manual' } });
    scores[newId] = {};
    rawValues[newId] = {};
    terrains.forEach(t => {
        scores[newId][t.id] = 5;
        rawValues[newId][t.id] = 0;
    });
    updateAll();
}

addCriterionBtn.addEventListener('click', addCriterion);

addDistanceSupplierBtn.addEventListener('click', () => {
    const newId = generateId('c');
    criteria.push({
        id: newId,
        name: 'Distância fornecedores (km)',
        weight: 10,
        norm: { mode: 'raw', direction: 'lower' }
    });
    scores[newId] = {};
    rawValues[newId] = {};
    terrains.forEach(t => {
        rawValues[newId][t.id] = 0;
        scores[newId][t.id] = 5;
    });
    recalcNorm(newId);
    updateAll();
});

addDistanceUrbanBtn.addEventListener('click', () => {
    const newId = generateId('c');
    criteria.push({
        id: newId,
        name: 'Distância centros urbanos (km)',
        weight: 10,
        norm: { mode: 'raw', direction: 'lower' }
    });
    scores[newId] = {};
    rawValues[newId] = {};
    terrains.forEach(t => {
        rawValues[newId][t.id] = 0;
        scores[newId][t.id] = 5;
    });
    recalcNorm(newId);
    updateAll();
});

addAccessBtn.addEventListener('click', () => {
    const newId = generateId('c');
    criteria.push({
        id: newId,
        name: 'Acesso a vias principais',
        weight: 10,
        norm: { mode: 'manual' }
    });
    scores[newId] = {};
    rawValues[newId] = {};
    terrains.forEach(t => {
        scores[newId][t.id] = 5;
        rawValues[newId][t.id] = 0;
    });
    updateAll();
});

// ============================================
// Adicionar terreno
// ============================================
function addTerrain() {
    const name = prompt('Nome do novo terreno:');
    if (!name) return;
    const newId = generateId('t');
    // Gerar coordenadas aleatórias próximas ao centro do Brasil para exemplo
    const lat = -14.2350 + (Math.random() - 0.5) * 10;
    const lng = -51.9253 + (Math.random() - 0.5) * 10;
    terrains.push({ id: newId, name: name, lat: lat, lng: lng });
    criteria.forEach(c => {
        scores[c.id][newId] = 5;
        rawValues[c.id][newId] = 0;
        if (c.norm.mode === 'raw') recalcNorm(c.id);
    });
    updateAll();
    if (map) updateMapMarkers();
}

addTerrainBtn.addEventListener('click', addTerrain);

// ============================================
// Validação de pesos
// ============================================
function validateWeights() {
    const total = criteria.reduce((sum, c) => sum + c.weight, 0);
    if (total !== 100) {
        weightWarning.textContent = `⚠️ Soma dos pesos = ${total}% (deve ser 100%)`;
        weightWarning.classList.remove('hidden');
        return false;
    } else {
        weightWarning.classList.add('hidden');
        return true;
    }
}

// ============================================
// Renderização da tabela
// ============================================
function renderScoresTable() {
    // Cabeçalho
    let thead = '<tr><th>Critério</th>';
    terrains.forEach(t => thead += `<th>${t.name}</th>`);
    thead += '</tr>';
    scoresThead.innerHTML = thead;

    // Corpo
    let tbody = '';
    criteria.forEach(c => {
        tbody += '<tr>';
        tbody += `<td>${c.name}</td>`;

        terrains.forEach(t => {
            if (c.norm.mode === 'raw') {
                const raw = rawValues[c.id][t.id] || 0;
                const nota = scores[c.id][t.id] || 5;
                tbody += `<td class="raw-cell">
                    <input type="number" class="raw-input" step="any" value="${raw}" data-criterion="${c.id}" data-terrain="${t.id}" title="Valor bruto">
                    <span class="calc-note">(${nota.toFixed(1)})</span>
                </td>`;
            } else {
                const nota = scores[c.id][t.id] || 5;
                tbody += `<td><input type="number" min="0" max="10" step="0.1" value="${nota}" class="score-input" data-criterion="${c.id}" data-terrain="${t.id}" title="Nota 0-10"></td>`;
            }
        });
        tbody += '</tr>';
    });
    scoresTbody.innerHTML = tbody;

    // Eventos para inputs manuais
    document.querySelectorAll('.score-input').forEach(input => {
        input.addEventListener('input', e => {
            const critId = e.target.dataset.criterion;
            const terrId = e.target.dataset.terrain;
            const val = parseFloat(e.target.value);
            if (!isNaN(val) && val >= 0 && val <= 10) {
                scores[critId][terrId] = val;
                e.target.classList.remove('error');
            } else {
                e.target.classList.add('error');
            }
            updateChartsAndRanking();
        });
    });

    // Eventos para inputs brutos
    document.querySelectorAll('.raw-input').forEach(input => {
        input.addEventListener('input', e => {
            const critId = e.target.dataset.criterion;
            const terrId = e.target.dataset.terrain;
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) {
                rawValues[critId][terrId] = val;
                recalcNorm(critId);
                // Atualiza a nota exibida na célula
                const cell = e.target.closest('td');
                const noteSpan = cell.querySelector('.calc-note');
                noteSpan.textContent = `(${scores[critId][terrId].toFixed(1)})`;
                updateChartsAndRanking();
            }
        });
    });

    refreshFeather();
}

// ============================================
// Cálculos e gráficos
// ============================================
function calculateFinalScores() {
    const final = {};
    terrains.forEach(t => {
        let total = 0;
        criteria.forEach(c => {
            total += (c.weight / 100) * (scores[c.id][t.id] || 0);
        });
        final[t.id] = { name: t.name, score: total };
    });
    return final;
}

function renderRanking(finalScores) {
    const sorted = Object.values(finalScores).sort((a, b) => b.score - a.score);
    let html = '';
    sorted.forEach((item, i) => {
        let medal = '';
        if (i === 0) medal = '<i data-feather="award" style="stroke: gold;"></i>';
        else if (i === 1) medal = '<i data-feather="award" style="stroke: silver;"></i>';
        else if (i === 2) medal = '<i data-feather="award" style="stroke: #cd7f32;"></i>';
        html += `<div class="ranking-item">${medal} ${item.name} <span>${item.score.toFixed(2)}</span></div>`;
    });
    rankingListDiv.innerHTML = html;
    refreshFeather();
}

function updateCharts(finalScores) {
    const names = terrains.map(t => t.name);
    const values = terrains.map(t => finalScores[t.id].score);

    if (barChart) barChart.destroy();
    barChart = new Chart(document.getElementById('bar-chart'), {
        type: 'bar',
        data: {
            labels: names,
            datasets: [{
                label: 'Pontuação',
                data: values,
                backgroundColor: 'rgba(59, 130, 246, 0.7)'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: 10 } }
        }
    });

    if (criteria.length === 0) {
        if (radarChart) radarChart.destroy();
        return;
    }

    const radarLabels = criteria.map(c => c.name);
    const radarDatasets = terrains.map((t, idx) => ({
        label: t.name,
        data: criteria.map(c => scores[c.id][t.id] || 0),
        borderColor: `hsl(${idx * 60}, 70%, 50%)`,
        backgroundColor: `hsla(${idx * 60}, 70%, 50%, 0.1)`
    }));

    if (radarChart) radarChart.destroy();
    radarChart = new Chart(document.getElementById('radar-chart'), {
        type: 'radar',
        data: { labels: radarLabels, datasets: radarDatasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { r: { min: 0, max: 10 } }
        }
    });
}

function updateChartsAndRanking() {
    if (!validateWeights()) {
        rankingListDiv.innerHTML = '<div class="ranking-item">Ajuste os pesos para 100%</div>';
        if (barChart) barChart.destroy();
        if (radarChart) radarChart.destroy();
        return;
    }
    const final = calculateFinalScores();
    renderRanking(final);
    updateCharts(final);
}

function updateAll() {
    renderCriteria();
    renderTerrains();
    renderScoresTable();
    updateChartsAndRanking();
    if (map) updateMapMarkers();
}

// ============================================
// Funções do mapa
// ============================================
function initMap() {
    if (map) return;
    
    map = L.map('map-container').setView([-14.2350, -51.9253], 4);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    
    const drawControl = new L.Control.Draw({
        draw: {
            polyline: {
                metric: true,
                feet: false,
                icon: new L.DivIcon({ iconSize: [8, 8], className: 'leaflet-div-icon leaflet-editing-icon' })
            },
            polygon: false,
            rectangle: false,
            circle: false,
            marker: true
        },
        edit: { featureGroup: drawnItems, remove: true }
    });
    map.addControl(drawControl);
    
    updateMapMarkers();
    
    map.on(L.Draw.Event.CREATED, function(event) {
        const layer = event.layer;
        drawnItems.addLayer(layer);
        
        if (measuringMode && event.layerType === 'polyline') {
            const latlngs = layer.getLatLngs();
            let total = 0;
            for (let i = 0; i < latlngs.length - 1; i++) {
                total += latlngs[i].distanceTo(latlngs[i + 1]);
            }
            distanceValue.textContent = `Distância total: ${(total / 1000).toFixed(2)} km`;
            distanceInfo.classList.remove('hidden');
        }
    });
    
    measureBtn.addEventListener('click', () => {
        measuringMode = true;
        showToast('Clique no mapa para iniciar a linha. Duplo clique para finalizar.', 'info', 4000);
    });
    
    clearBtn.addEventListener('click', () => {
        drawnItems.clearLayers();
        distanceInfo.classList.add('hidden');
        measuringMode = false;
    });
    
    searchBtn.addEventListener('click', async () => {
        const query = addressSearch.value;
        if (!query) return;
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (data && data.length > 0) {
                const result = data[0];
                const lat = parseFloat(result.lat);
                const lon = parseFloat(result.lon);
                map.setView([lat, lon], 12);
                L.marker([lat, lon]).addTo(map).bindPopup(`<b>${result.display_name}</b>`).openPopup();
            } else {
                showToast('Endereço não encontrado', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Erro na busca', 'error');
        }
    });
}

function updateMapMarkers() {
    if (!map) return;
    
    markers.forEach(m => map.removeLayer(m));
    markers = [];
    
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    const finalScores = calculateFinalScores();
    
    terrains.forEach((t, idx) => {
        let popup = `<b>${t.name}</b><br>`;
        popup += `<b>Pontuação final: ${finalScores[t.id].score.toFixed(2)}</b><br><hr>`;
        criteria.forEach(c => {
            const score = scores[c.id][t.id] || 5;
            popup += `${c.name}: ${score.toFixed(1)}/10<br>`;
        });
        
        const marker = L.marker([t.lat, t.lng], {
            icon: L.divIcon({
                className: 'custom-marker',
                html: `<div style="background-color: ${colors[idx % colors.length]}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.2);"></div>`,
                iconSize: [24, 24],
                popupAnchor: [0, -12]
            })
        }).bindPopup(popup);
        
        marker.addTo(map);
        markers.push(marker);
    });
}

// ============================================
// Exemplos práticos
// ============================================
function loadExample1() {
    criteria = [
        { id: 'c0', name: 'Preço (R$)', weight: 50, norm: { mode: 'raw', direction: 'lower' } },
        { id: 'c1', name: 'Localização', weight: 30, norm: { mode: 'manual' } },
        { id: 'c2', name: 'Topografia', weight: 20, norm: { mode: 'manual' } }
    ];
    terrains = [
        { id: 't0', name: 'A', lat: -23.55, lng: -46.63 },
        { id: 't1', name: 'B', lat: -22.90, lng: -43.17 }
    ];
    scores = {}; rawValues = {};
    criteria.forEach(c => {
        scores[c.id] = {};
        rawValues[c.id] = {};
        terrains.forEach(t => {
            if (c.id === 'c0') {
                rawValues[c.id][t.id] = (t.id === 't0') ? 1300 : 1700;
            } else if (c.id === 'c1') {
                scores[c.id][t.id] = (t.id === 't0') ? 8 : 9;
            } else {
                scores[c.id][t.id] = (t.id === 't0') ? 7 : 6;
            }
        });
    });
    recalcNorm('c0');
    activateTab('simulator');
    updateAll();
}

function loadExample2() {
    criteria = [
        { id: 'c0', name: 'Preço (R$)', weight: 30, norm: { mode: 'raw', direction: 'lower' } },
        { id: 'c1', name: 'Dist. fornecedores (km)', weight: 25, norm: { mode: 'raw', direction: 'lower' } },
        { id: 'c2', name: 'Dist. centros (km)', weight: 25, norm: { mode: 'raw', direction: 'lower' } },
        { id: 'c3', name: 'Acesso vias', weight: 20, norm: { mode: 'manual' } }
    ];
    terrains = [
        { id: 't0', name: 'Alpha', lat: -23.55, lng: -46.63 },
        { id: 't1', name: 'Beta', lat: -22.90, lng: -43.17 },
        { id: 't2', name: 'Gamma', lat: -19.91, lng: -43.93 }
    ];
    scores = {}; rawValues = {};
    criteria.forEach(c => {
        scores[c.id] = {};
        rawValues[c.id] = {};
        terrains.forEach(t => {
            if (c.id === 'c0') {
                rawValues[c.id][t.id] = (t.id === 't0') ? 1500 : (t.id === 't1' ? 1800 : 1300);
            } else if (c.id === 'c1') {
                rawValues[c.id][t.id] = (t.id === 't0') ? 12 : (t.id === 't1' ? 25 : 8);
            } else if (c.id === 'c2') {
                rawValues[c.id][t.id] = (t.id === 't0') ? 5 : (t.id === 't1' ? 30 : 15);
            } else {
                scores[c.id][t.id] = (t.id === 't0') ? 8 : (t.id === 't1' ? 5 : 7);
            }
        });
    });
    criteria.forEach(c => { if (c.norm.mode === 'raw') recalcNorm(c.id); });
    activateTab('simulator');
    updateAll();
}

loadExample1Btn.addEventListener('click', loadExample1);
loadExample2Btn.addEventListener('click', loadExample2);

// ============================================
// Persistência com localStorage
// ============================================
function saveSimulation() {
    const state = {
        criteria: criteria,
        terrains: terrains,
        scores: scores,
        rawValues: rawValues
    };
    localStorage.setItem('ponderaCivilState', JSON.stringify(state));
    showToast('Simulação salva com sucesso!', 'success');
}

function loadSimulation() {
    const saved = localStorage.getItem('ponderaCivilState');
    if (!saved) {
        showToast('Nenhuma simulação salva encontrada.', 'error');
        return;
    }
    try {
        const state = JSON.parse(saved);
        criteria = state.criteria;
        terrains = state.terrains;
        scores = state.scores;
        rawValues = state.rawValues;
        updateAll();
        if (map) updateMapMarkers();
        showToast('Simulação carregada!', 'success');
    } catch (e) {
        showToast('Erro ao carregar simulação.', 'error');
    }
}

// Adicionar botões na interface
const saveBtn = document.createElement('button');
saveBtn.id = 'save-simulation';
saveBtn.className = 'btn btn-secondary';
saveBtn.innerHTML = '<i data-feather="save"></i> Salvar';
saveBtn.addEventListener('click', saveSimulation);

const loadBtn = document.createElement('button');
loadBtn.id = 'load-simulation';
loadBtn.className = 'btn btn-secondary';
loadBtn.innerHTML = '<i data-feather="upload"></i> Carregar';
loadBtn.addEventListener('click', loadSimulation);

const exportDiv = document.querySelector('.export-buttons');
exportDiv.appendChild(saveBtn);
exportDiv.appendChild(loadBtn);

// ============================================
// Análise de sensibilidade
// ============================================
function sensitivityAnalysis() {
    if (criteria.length === 0) {
        showToast('Adicione pelo menos um critério.', 'error');
        return;
    }
    // Criar modal simples
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    modal.style.backgroundColor = 'white';
    modal.style.padding = '2rem';
    modal.style.borderRadius = '1.5rem';
    modal.style.boxShadow = '0 20px 40px rgba(0,0,0,0.2)';
    modal.style.zIndex = '1000';
    modal.style.maxWidth = '90vw';
    modal.style.maxHeight = '90vh';
    modal.style.overflow = 'auto';
    
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '✕';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '1rem';
    closeBtn.style.right = '1rem';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.fontSize = '1.5rem';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = () => document.body.removeChild(modal);
    
    const title = document.createElement('h3');
    title.innerHTML = '<i data-feather="trending-up"></i> Análise de sensibilidade';
    title.style.marginBottom = '1rem';
    
    const canvas = document.createElement('canvas');
    canvas.id = 'sensitivity-chart';
    canvas.width = 600;
    canvas.height = 400;
    
    modal.appendChild(closeBtn);
    modal.appendChild(title);
    modal.appendChild(canvas);
    document.body.appendChild(modal);
    refreshFeather();
    
    // Calcular cenários: para cada critério, simular +10% e -10% no peso, redistribuindo
    const baseScores = calculateFinalScores();
    const baseValues = terrains.map(t => baseScores[t.id].score);
    const labels = terrains.map(t => t.name);
    
    const datasets = [];
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
    
    // Cenário base
    datasets.push({
        label: 'Base',
        data: baseValues,
        backgroundColor: 'rgba(59, 130, 246, 0.5)'
    });
    
    criteria.forEach((c, idx) => {
        // +10% no peso deste critério
        const newWeights = criteria.map(crit => crit.weight);
        const delta = Math.min(10, 100 - newWeights[idx]); // não ultrapassar 100
        newWeights[idx] += delta;
        // redistribuir a redução nos outros proporcionalmente
        const others = newWeights.reduce((sum, w, i) => (i !== idx ? sum + w : sum), 0);
        if (others > 0) {
            const factor = (100 - newWeights[idx]) / others;
            for (let i = 0; i < newWeights.length; i++) {
                if (i !== idx) newWeights[i] *= factor;
            }
        }
        // calcular pontuações com esses pesos
        const tempScores = {};
        terrains.forEach(t => {
            let total = 0;
            criteria.forEach((crit, i) => {
                total += (newWeights[i] / 100) * (scores[crit.id][t.id] || 0);
            });
            tempScores[t.id] = total;
        });
        datasets.push({
            label: `${c.name} +10%`,
            data: terrains.map(t => tempScores[t.id]),
            backgroundColor: colors[idx % colors.length] + '80'
        });
        
        // -10% (ou mínimo 0)
        const newWeights2 = criteria.map(crit => crit.weight);
        const delta2 = Math.min(10, newWeights2[idx]);
        newWeights2[idx] -= delta2;
        const others2 = newWeights2.reduce((sum, w, i) => (i !== idx ? sum + w : sum), 0);
        if (others2 > 0) {
            const factor = (100 - newWeights2[idx]) / others2;
            for (let i = 0; i < newWeights2.length; i++) {
                if (i !== idx) newWeights2[i] *= factor;
            }
        }
        const tempScores2 = {};
        terrains.forEach(t => {
            let total = 0;
            criteria.forEach((crit, i) => {
                total += (newWeights2[i] / 100) * (scores[crit.id][t.id] || 0);
            });
            tempScores2[t.id] = total;
        });
        datasets.push({
            label: `${c.name} -10%`,
            data: terrains.map(t => tempScores2[t.id]),
            backgroundColor: colors[idx % colors.length] + '40'
        });
    });
    
    new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 12 } }
            },
            scales: { y: { beginAtZero: true, max: 10 } }
        }
    });
}

// Botão para análise de sensibilidade
const sensitivityBtn = document.createElement('button');
sensitivityBtn.id = 'sensitivity-analysis';
sensitivityBtn.className = 'btn btn-secondary';
sensitivityBtn.innerHTML = '<i data-feather="trending-up"></i> Sensibilidade';
sensitivityBtn.addEventListener('click', sensitivityAnalysis);
exportDiv.appendChild(sensitivityBtn);
refreshFeather();

// ============================================
// Mapa: calcular distância até ponto de interesse
// ============================================
function setupDistanceCalculation() {
    if (!map) {
        showToast('Ative a aba Mapa primeiro.', 'error');
        return;
    }
    
    // Perguntar qual critério de distância usar
    const distanceCriteria = criteria.filter(c => 
        c.norm.mode === 'raw' && 
        (c.name.toLowerCase().includes('distância') || c.name.toLowerCase().includes('km'))
    );
    
    if (distanceCriteria.length === 0) {
        showToast('Nenhum critério de distância encontrado. Adicione um (ex: Distância fornecedores).', 'error');
        return;
    }
    
    let selectedCriterion = distanceCriteria[0];
    if (distanceCriteria.length > 1) {
        const names = distanceCriteria.map(c => c.name).join('\n');
        const idx = prompt(`Múltiplos critérios de distância encontrados. Digite o número do critério desejado:\n${distanceCriteria.map((c, i) => `${i+1}: ${c.name}`).join('\n')}`);
        if (idx) {
            const index = parseInt(idx) - 1;
            if (index >= 0 && index < distanceCriteria.length) selectedCriterion = distanceCriteria[index];
        }
    }
    
    showToast('Clique no mapa para selecionar o ponto de interesse (fornecedor, centro, etc.)', 'info', 4000);
    
    const clickHandler = async (e) => {
        const { lat, lng } = e.latlng;
        
        // Calcular distância de cada terreno até este ponto
        const R = 6371; // km
        terrains.forEach(t => {
            const dLat = (t.lat - lat) * Math.PI / 180;
            const dLon = (t.lng - lng) * Math.PI / 180;
            const a = 
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(t.lat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) * 
                Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c;
            
            rawValues[selectedCriterion.id][t.id] = Math.round(distance * 10) / 10;
        });
        
        recalcNorm(selectedCriterion.id);
        renderScoresTable();
        updateChartsAndRanking();
        
        // Adicionar marcador do ponto de interesse
        L.marker([lat, lng]).addTo(map)
            .bindPopup('Ponto de interesse')
            .openPopup();
        
        map.off('click', clickHandler);
        showToast('Distâncias calculadas e preenchidas!', 'success');
    };
    
    map.on('click', clickHandler);
}

// Botão no mapa para calcular distância
const calcDistanceBtn = document.createElement('button');
calcDistanceBtn.id = 'calc-distance';
calcDistanceBtn.className = 'btn btn-secondary';
calcDistanceBtn.innerHTML = '<i data-feather="target"></i> Calcular distância';
calcDistanceBtn.addEventListener('click', setupDistanceCalculation);
document.querySelector('.map-controls').appendChild(calcDistanceBtn);
refreshFeather();

// ============================================
// PDF com gráficos
// ============================================
async function exportToPDFWithCharts() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    doc.setFontSize(18);
    doc.text('Avaliação de Terrenos - PonderaCivil', 20, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 20, 30);
    
    let y = 40;
    doc.setFontSize(12);
    doc.text('Critérios e Pesos:', 20, y);
    y += 8;
    criteria.forEach(c => {
        doc.text(`${c.name}: ${c.weight}%`, 25, y);
        y += 6;
    });
    
    y += 10;
    doc.text('Notas atribuídas (0-10):', 20, y);
    y += 8;
    
    const head = [['Critério', ...terrains.map(t => t.name)]];
    const body = criteria.map(c => [c.name, ...terrains.map(t => (scores[c.id][t.id] || 0).toFixed(1))]);
    
    doc.autoTable({
        startY: y,
        head: head,
        body: body,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [59, 130, 246] }
    });
    
    const final = calculateFinalScores();
    y = doc.lastAutoTable.finalY + 10;
    doc.text('Pontuação final:', 20, y);
    y += 6;
    terrains.forEach(t => {
        doc.text(`${t.name}: ${final[t.id].score.toFixed(2)}`, 25, y);
        y += 6;
    });
    
    // Capturar gráficos
    const barCanvas = document.getElementById('bar-chart');
    const radarCanvas = document.getElementById('radar-chart');
    
    if (barCanvas && radarCanvas) {
        const barImg = await html2canvas(barCanvas);
        const radarImg = await html2canvas(radarCanvas);
        
        doc.addPage();
        doc.text('Gráfico de Barras', 20, 20);
        doc.addImage(barImg.toDataURL('image/png'), 'PNG', 20, 30, 170, 80);
        
        doc.addPage();
        doc.text('Gráfico Radar', 20, 20);
        doc.addImage(radarImg.toDataURL('image/png'), 'PNG', 20, 30, 170, 80);
    }
    
    doc.save('terrenos_analise_completa.pdf');
}

// Substituir o exportador antigo pelo novo
exportPdfBtn.removeEventListener('click', exportToPDF);
exportPdfBtn.addEventListener('click', exportToPDFWithCharts);
exportXlsxBtn.addEventListener('click', exportToXLSX);

// ============================================
// Inicialização
// ============================================
updateAll();
refreshFeather();
