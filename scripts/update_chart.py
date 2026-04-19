import re

with open('index.html', 'r') as f:
    html = f.read()
if 'chartjs-plugin-datalabels' not in html:
    html = html.replace('<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>', '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>\n    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0"></script>')
with open('index.html', 'w') as f:
    f.write(html)

with open('app.js', 'r') as f:
    js = f.read()

new_chart_code = """Chart.register(window.ChartDataLabels);
    chartInstance = new Chart(ctx, {
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
            layout: {
                padding: { right: 60 }
            },
            scales: {
                x: { display: false },
                y: { grid: { display: false }, border: { display: false } }
            },
            plugins: { 
                legend: { display: false },
                datalabels: {
                    anchor: 'end',
                    align: 'right',
                    formatter: (value) => '$' + parseFloat(value).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}),
                    color: '#333333',
                    font: { weight: '600', size: 13 }
                }
            },
            onClick: (e, activeElements) => {
                if (activeElements.length > 0) {
                    const index = activeElements[0].index;
                    const categoryName = labels[index];
                    showCategoryDetails(categoryName, byCategory[categoryName].items);
                }
            }
        }
    });

"""

pattern = r"chartInstance\s*=\s*new\s*Chart\(ctx,\s*\{[\s\S]*?\}\);\s*"
js = re.sub(pattern, new_chart_code, js)

with open('app.js', 'w') as f:
    f.write(js)
