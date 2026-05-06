'use client';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useMemo, useState, useEffect, useRef } from 'react';
import { formatUTCToLocal, parseLocalDate, formatFriendlyDate } from '@/lib/utils';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

export default function YearlyTab() {
  const { expenses, activeMonthFilter, setActiveMonthFilter } = useExpenseStore();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const detailsRef = useRef<HTMLDivElement>(null);

  const years = useMemo(() => {
    const yrSet = new Set<string>();
    expenses.forEach(exp => {
      if (!exp.date) return;
      const d = parseLocalDate(exp.date);
      if (!isNaN(d.getTime())) yrSet.add(d.getFullYear().toString());
    });
    const sorted = Array.from(yrSet).sort((a,b) => parseInt(b) - parseInt(a));
    return sorted;
  }, [expenses]);

  useEffect(() => {
    if(years.length > 0 && !years.includes(selectedYear)) {
      setSelectedYear(years[0]);
    }
  }, [years, selectedYear]);

  const { data } = useMemo(() => {
    const byMonth: Record<number, number | null> = {};
    for(let i=0; i<12; i++) byMonth[i] = null;

    expenses.forEach(exp => {
      if (!exp.date) return;
      const d = parseLocalDate(exp.date);
      if (isNaN(d.getTime()) || d.getFullYear().toString() !== selectedYear) return;
      const m = d.getMonth();
      if (byMonth[m] === null) byMonth[m] = 0;
      byMonth[m] += (parseFloat(exp.amount as any) || 0);
    });

    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dataVals = labels.map((_, i) => byMonth[i]);

    return { data: dataVals };
  }, [expenses, selectedYear]);

  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: 'var(--primary)',
        borderRadius: 4,
        barPercentage: 0.6
      }
    ]
  };

  const options = {
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: { top: 30 } },
  onClick: (event: any, elements: any[]) => {
    if (elements.length > 0) {
      const idx = elements[0].index;
      setActiveMonthFilter(idx.toString());
      setTimeout(() => { detailsRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
    }
  },
  scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: '#000000', font: { weight: 'bold' as const } } },
      y: { grid: { display: false }, border: { display: false }, ticks: { display: false }, min: 0 }
  },
  plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) { label += ': '; }
            if (context.parsed.y !== null) { label += '$' + (Number(context.parsed.y) / 1000).toFixed(1) + 'K'; }
            return label;
          }
          }
        },
        datalabels: {
            display: function(context: any) { return context.dataset.data[context.dataIndex] !== null; },
            anchor: 'end' as const,
            align: 'top' as const,
            offset: 4,
            formatter: (value: number) => '$' + (Number(value) / 1000).toFixed(1) + 'K',
            color: '#000',
            font: { weight: 600, size: 12 }
        }
    }
};

const detailExpenses = useMemo(() => {
    if (activeMonthFilter === null) return [];
    const monthIdx = parseInt(activeMonthFilter, 10);
    return expenses.filter(exp => {
      if (!exp.date) return false;
      const d = parseLocalDate(exp.date);
      return d.getFullYear().toString() === selectedYear && d.getMonth() === monthIdx;
    });
  }, [expenses, activeMonthFilter, selectedYear]);

  return (
    <div id="tab-yearly" className="tab-content active" style={{ display: "block" }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h2 style={{ margin: 0 }}>Monthly Expenses</h2>
            <select 
              id="yearSelect" 
              value={selectedYear} 
              onChange={e => setSelectedYear(e.target.value)}
              style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '16px', border: '1px solid var(--border)', backgroundColor: 'var(--bg)', cursor: 'pointer' }}
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
        </div>
        <div className="chart-container" style={{ height: '300px', maxHeight: '40vh' }}>
            <Bar data={chartData} options={options as any} plugins={[ChartDataLabels]} />
        </div>
        <div id="yearly-details-container" ref={detailsRef} style={{ marginTop: '20px' }}>
          {activeMonthFilter !== null && (
            <div className="month-details">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3>{labels[parseInt(activeMonthFilter, 10)]} {selectedYear} Details</h3>
                <button onClick={() => setActiveMonthFilter(null)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text)' }}>Close</button>
              </div>
              {detailExpenses.length > 0 ? (
                <div className="recent-list">
                  {detailExpenses.map(exp => (
                    <div key={exp.id} className="expense-item">
                      <div className="expense-info">
                        <h4>{exp.item}</h4>
                        <p>{exp.categories?.name || "Uncategorized"} &bull; {formatFriendlyDate(exp.date)}</p>
                      </div>
                      <div className="expense-amount">${(parseFloat(exp.amount as any) || 0).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No expenses for this month.</p>
              )}
            </div>
          )}
        </div>
    </div>
  );
}
