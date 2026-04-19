import { store } from "./state.js";
import { escapeHtml, toggleSelectMode } from "./ui.js";


export function renderCategories(onEdit, onDelete) {
    const list = document.getElementById('category-list');
    if (!list) return;
    list.innerHTML = '';
    store.categories.forEach(cat => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.padding = '8px 15px';
        li.style.background = '#ffffff';
        li.style.borderRadius = '8px';
        li.style.marginBottom = '8px';
        li.style.border = '1px solid #dadce0';
        li.style.transition = 'box-shadow 0.2s';
        li.onmouseover = () => li.style.boxShadow = '0 1px 4px rgba(0,0,0,0.1)';
        li.onmouseout = () => li.style.boxShadow = 'none';
        
        const nameSpan = document.createElement('span');
        nameSpan.innerText = cat.name;
        nameSpan.style.fontWeight = '500';
        nameSpan.style.color = '#3c4043';
        nameSpan.style.flex = '1';
        
        const actionsDiv = document.createElement('div');
        actionsDiv.style.display = 'flex';
        actionsDiv.style.gap = '8px';
        actionsDiv.style.alignItems = 'center';

        const createBtn = (svgPath, color, hoverColor, onClick) => {
            const btn = document.createElement('button');
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${svgPath}</svg>`;
            btn.style.padding = '6px';
            btn.style.borderRadius = '50%';
            btn.style.background = 'transparent';
            btn.style.color = color;
            btn.style.border = 'none';
            btn.style.cursor = 'pointer';
            btn.style.display = 'flex';
            btn.style.alignItems = 'center';
            btn.style.justifyContent = 'center';
            btn.style.transition = 'all 0.2s';
            btn.onmouseover = () => { btn.style.background = '#f1f3f4'; btn.style.color = hoverColor; };
            btn.onmouseout = () => { btn.style.background = 'transparent'; btn.style.color = color; };
            btn.onclick = onClick;
            return btn;
        };

        const editSvg = '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>';
        const deleteSvg = '<polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line>';

        const editBtn = createBtn(editSvg, '#5f6368', '#1a73e8', () => onEdit(cat.id, cat.name));
        const delBtn = createBtn(deleteSvg, '#5f6368', '#d93025', () => onDelete(cat.id));

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(delBtn);

        li.appendChild(nameSpan);
        li.appendChild(actionsDiv);
        list.appendChild(li);
    });
}


export function updateCategorySelects() {
    const addSelect = document.getElementById('add-category');
    const editSelect = document.getElementById('edit-category');
    if (!addSelect || !editSelect) return;
    
    addSelect.innerHTML = '';
    editSelect.innerHTML = '';
    const bulkSelect = document.getElementById('bulk-edit-category');
    if (bulkSelect) {
        bulkSelect.innerHTML = '<option value="">-- Keep Existing Category --</option>';
    }
    
    store.categories.forEach(cat => {
        const opt1 = document.createElement('option');
        opt1.value = cat.name;
        opt1.innerText = cat.name;
        addSelect.appendChild(opt1);
        
        const opt2 = document.createElement('option');
        opt2.value = cat.name;
        opt2.innerText = cat.name;
        editSelect.appendChild(opt2);
        
        if (bulkSelect) {
            const opt3 = document.createElement('option');
            opt3.value = cat.name;
            opt3.innerText = cat.name;
            bulkSelect.appendChild(opt3);
        }
    });
}


export function renderRecent(expenses) {
    const list = document.getElementById('recent-list');
    if (!list) return;
    list.innerHTML = "";

    const sorted = [...store.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(exp => {
        const d = new Date(exp.date);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
        const dateStr = !isNaN(d.getTime()) ? d.toLocaleDateString() : 'Unknown Date';
        const amt = parseFloat(exp.amount) || 0;

        const idSafe = escapeHtml(exp.id);
        const itemSafe = escapeHtml(exp.item);
        const catSafe = escapeHtml(exp.category);
        const dateSafe = escapeHtml(exp.date);

        list.innerHTML += '<div class="expense-item" data-id="' + idSafe + '" data-item="' + itemSafe + '" data-amount="' + amt + '" data-category="' + catSafe + '" data-date="' + dateSafe + '">' +
                '<input type="checkbox" class="expense-checkbox">' +
                '<div class="expense-info">' +
                    '<h4>' + itemSafe + '</h4>' +
                    '<p>' + catSafe + ' &bull; ' + dateStr + '</p>' +
                '</div>' +
                '<div class="expense-amount">$' + amt.toFixed(2) + '</div>' +
            '</div>';
    });
    
    if (store.isSelectMode) toggleSelectMode();
}


export function renderDashboard(expenses, onCategoryClick) {
    const filtered = expenses;
    const total = filtered.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    document.getElementById('total-amount').innerText = "$" + total.toFixed(2);

    const byCategory = {};
    filtered.forEach(exp => {
        if (!byCategory[exp.category]) byCategory[exp.category] = { total: 0, items: [] };
        byCategory[exp.category].total += (parseFloat(exp.amount) || 0);
        byCategory[exp.category].items.push(exp);
    });

    const labels = Object.keys(byCategory).sort((a,b) => byCategory[b].total - byCategory[a].total);
    const data = labels.map(label => byCategory[label].total);
    const bgColors = labels.map((_, i) => "hsl(" + (i * (360 / labels.length)) + ", 70%, 60%)");

    document.querySelector('.chart-container').style.height = Math.max(300, labels.length * 40 + 50) + 'px';
    const ctx = document.getElementById("expenseChart").getContext("2d");
    Chart.register(window.ChartDataLabels);
    if (store.chartInstance) store.chartInstance.destroy();

    if (labels.length === 0) {
        document.getElementById('category-details-container').innerHTML = "<p>No store.expenses in this range.</p>";
        return;
    }

    store.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Expenses by Category',
                data: data,
                backgroundColor: labels.map((_, i) => `hsl(0, 0%, ${15 + (i * 65) / Math.max(1, labels.length - 1)}%)`),
                borderRadius: 4
            }]
        },
        options: { 
            indexAxis: 'y', 
            maintainAspectRatio: false,
            responsive: true, 
            interaction: { mode: "y", intersect: false },
            layout: {
                padding: { right: 60 }
            },
            scales: {
                x: { display: false },
                y: { grid: { display: false }, border: { display: false }, ticks: { font: { weight: 'bold', size: 14 }, color: '#000' } }
            },
            plugins: { 
                legend: { display: false },
                datalabels: {
                    anchor: 'end',
                    align: 'right',
                    formatter: (value) => '$' + Math.round(parseFloat(value)).toLocaleString(),
                    color: '#000',
                    font: { weight: '600', size: 13 }
                }
            },
            onClick: (e, activeElements) => {
                if (activeElements.length > 0) {
                    const index = activeElements[0].index;
                    const categoryName = labels[index];
                    onCategoryClick(categoryName, byCategory[categoryName].items);
                }
            }
        }
    });

    document.getElementById("category-details-container").innerHTML = "";
}


export function renderYearlyChart(onMonthClick) {
    const years = new Set();
    store.expenses.forEach(exp => {
        const d = new Date(exp.date);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
        if (!isNaN(d.getTime())) years.add(d.getFullYear().toString());
    });
    const sortedYears = Array.from(years).sort((a,b) => b - a);

    const yearSelect = document.getElementById('yearSelect');
    if (!yearSelect) return;

    let selectedYear = yearSelect.value;
    yearSelect.innerHTML = '';
    sortedYears.forEach(y => {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        yearSelect.appendChild(opt);
    });
    
    if (!selectedYear || !sortedYears.includes(selectedYear)) {
        selectedYear = sortedYears.length > 0 ? sortedYears[0] : new Date().getFullYear().toString();
    }
    yearSelect.value = selectedYear;

    const byMonth = {};
    for(let i=0; i<12; i++) byMonth[i] = null;

    store.expenses.forEach(exp => {
        const d = new Date(exp.date);
        d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
        if (isNaN(d.getTime()) || d.getFullYear().toString() !== selectedYear) return;
        const m = d.getMonth();
        if (byMonth[m] === null) byMonth[m] = 0;
        byMonth[m] += (parseFloat(exp.amount) || 0);
    });

    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const data = labels.map((_, i) => byMonth[i]);

    const datasets = [{
        label: 'Expenses', 
        data: data, 
        backgroundColor: '#b0b0b0', 
        hoverBackgroundColor: '#808080', 
        borderRadius: 4, 
        borderSkipped: false, 
        maxBarThickness: 40
    }];

    if (window.yearlyChartInstance) window.yearlyChartInstance.destroy();
    const canvas = document.getElementById('yearlyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    window.yearlyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            maintainAspectRatio: false,
            responsive: true, 
            layout: { padding: { top: 60 } },
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { grid: { display: false }, border: { display: false }, ticks: { color: '#000000', font: { weight: 'bold' } } },
                y: { grid: { display: false }, border: { display: false }, ticks: { display: false }, min: 0 }
            },
            plugins: { 
                legend: { display: false }, 
                datalabels: { 
                    display: function(context) { return context.dataset.data[context.dataIndex] !== null; },
                    anchor: 'end',
                    align: 'top',
                    offset: 4,
                    formatter: (value) => '$' + Math.round(parseFloat(value)).toLocaleString(),
                    color: '#000',
                    font: { weight: '600', size: 12 }
                } 
            },
            onHover: (event, chartElement) => { 
                if (event.native && event.native.target) event.native.target.style.cursor = (chartElement && chartElement.length > 0) ? 'pointer' : 'default'; 
            }, 
            onClick: (e, activeEls) => { 
                let idx = -1; 
                if (activeEls && activeEls.length > 0) idx = activeEls[0].index; 
                else if (window.yearlyChartInstance) { 
                    const els = window.yearlyChartInstance.getElementsAtEventForMode(e, 'index', {intersect: false}, false); 
                    if (els && els.length > 0) idx = els[0].index; 
                } 
                if (idx != -1 && data[idx] !== null) {
                    const monthStr = String(idx + 1).padStart(2, '0');
                    onMonthClick(`${selectedYear}-${monthStr}`);
                }
            }
        }
    });
}
