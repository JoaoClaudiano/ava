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
    { id: 't0', name: 'Terreno A' },
    { id: 't1', name: 'Terreno B' },
    { id: 't2', name: 'Terreno C' }
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
            // Valores iniciais
            if (c.norm.mode === 'raw') {
                rawValues[c.id][t.id] = 0;
                scores[c.id][t.id] = 5; // temporário, será recalculado
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
const exportPdfBtn = document.getElementById('export-pdf');
const exportXlsxBtn = document.getElementById('export-xlsx');
const weightWarning = document.getElementById('weight-warning');
const startTourBtn = document.getElementById('start-tour');

// Gráficos
let barChart, radarChart;

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
// Tour interativo
// ============================================
if (startTourBtn) {
    startTourBtn.addEventListener('click', () => {
        introJs().setOptions({
            steps: [
                { title: 'Avaliação de Terrenos', intro: 'Ferramenta para comparar terrenos usando o método da pontuação ponderada.' },
                { element: '#terrains-list', title: 'Terrenos', intro: 'Adicione ou remova terrenos. Clique no lápis para editar o nome.' },
                { element: '#criteria-list', title: 'Critérios', intro: 'Critérios pré-definidos. Use os botões para escolher: nota manual, menor melhor (↓) ou maior melhor (↑).' },
                { element: '.scores-panel', title: 'Tabela', intro: 'Para critérios manuais, insira notas de 0 a 10. Para valores brutos, insira o valor real (ex: preço) – a nota é calculada automaticamente.' },
                { element: '.results-panel', title: 'Resultados', intro: 'Compare as pontuações e exporte relatórios.' }
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
                // Inicializa scores manuais se necessário
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
        });
    });

    refreshFeather();
}

// ============================================
// Adicionar critério/terreno
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

function addTerrain() {
    const name = prompt('Nome do novo terreno:');
    if (!name) return;
    const newId = generateId('t');
    terrains.push({ id: newId, name: name });
    criteria.forEach(c => {
        scores[c.id][newId] = 5;
        rawValues[c.id][newId] = 0;
        if (c.norm.mode === 'raw') recalcNorm(c.id);
    });
    updateAll();
}

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
}

// ============================================
// Exportações
// ============================================
async function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Avaliação de Terrenos - PonderaCivil', 20, 20);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 20, 30);
    let y = 40;
    doc.text('Critérios e Pesos:', 20, y);
    y += 8;
    criteria.forEach(c => {
        doc.text(`${c.name}: ${c.weight}%`, 25, y);
        y += 6;
    });
    y += 10;
    const head = [['Critério', ...terrains.map(t => t.name)]];
    const body = criteria.map(c => [c.name, ...terrains.map(t => (scores[c.id][t.id] || 0).toFixed(1))]);
    doc.autoTable({ startY: y, head, body, theme: 'grid' });
    const final = calculateFinalScores();
    y = doc.lastAutoTable.finalY + 10;
    doc.text('Pontuação final:', 20, y);
    y += 6;
    terrains.forEach(t => {
        doc.text(`${t.name}: ${final[t.id].score.toFixed(2)}`, 25, y);
        y += 6;
    });
    doc.save('terrenos_analise.pdf');
}

function exportToXLSX() {
    const wb = XLSX.utils.book_new();

    const criteriaSheet = [['Critério', 'Peso (%)', 'Modo']];
    criteria.forEach(c => {
        let modo = 'Manual';
        if (c.norm.mode === 'raw') modo = c.norm.direction === 'lower' ? 'Menor melhor' : 'Maior melhor';
        criteriaSheet.push([c.name, c.weight, modo]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(criteriaSheet), 'Critérios');

    const notesSheet = [['Critério', ...terrains.map(t => t.name)]];
    criteria.forEach(c => notesSheet.push([c.name, ...terrains.map(t => (scores[c.id][t.id] || 0).toFixed(1))]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(notesSheet), 'Notas');

    const final = calculateFinalScores();
    const finalSheet = [['Terreno', 'Pontuação']];
    terrains.forEach(t => finalSheet.push([t.name, final[t.id].score]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(finalSheet), 'Resultado');

    XLSX.writeFile(wb, 'terrenos_analise.xlsx');
}

// ============================================
// Event listeners
// ============================================
addCriterionBtn.addEventListener('click', addCriterion);
addTerrainBtn.addEventListener('click', addTerrain);
exportPdfBtn.addEventListener('click', exportToPDF);
exportXlsxBtn.addEventListener('click', exportToXLSX);

// Inicialização
updateAll();
refreshFeather();
