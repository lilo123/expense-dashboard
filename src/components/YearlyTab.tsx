'use client';
import { useExpenseStore } from '@/store/useExpenseStore';
import { useMemo, useState, useEffect, useRef } from 'react';
import { formatUTCToLocal, parseLocalDate, formatFriendlyDate, convertAmount, formatFriendlyCurrency } from '@/lib/utils';
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
  const { 
    expenses, activeMonthFilter, setActiveMonthFilter,
    displayCurrency, baseCurrency, exchangeRates
  } = useExpenseStore();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const detailsRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

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
      
      // Convert stored amount (base) dynamically to display currency before summing
      const amtBase = parseFloat(exp.amount as any) || 0;
      const amtDisplay = convertAmount(amtBase, baseCurrency, displayCurrency, exchangeRates);
      byMonth[m] += amtDisplay;
    });

    const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dataVals = labels.map((_, i) => byMonth[i]);

    return { data: dataVals };
  }, [expenses, selectedYear, displayCurrency, baseCurrency, exchangeRates]);

  const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: '#AEC3B0',
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
        x: { grid: { display: false }, border: { display: false }, ticks: { color: '#2D3748', font: { weight: 'bold' as const } } },
        y: { grid: { display: false }, border: { display: false }, ticks: { display: false }, min: 0 }
    },
    plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context: any) {
              let label = context.dataset.label || '';
              if (label) { label += ': '; }
              if (context.parsed.y !== null) { 
                label += formatFriendlyCurrency(context.parsed.y, displayCurrency); 
              }
              return label;
            }
          }
        },
        datalabels: {
            display: function(context: any) { return context.dataset.data[context.dataIndex] !== null; },
            anchor: 'end' as const,
            align: 'top' as const,
            offset: 4,
            formatter: (value: number) => formatFriendlyCurrency(value, displayCurrency),
            color: '#2D3748',
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
        <div className="flex justify-between items-center mb-4">
            <h2 className="margin-0 text-zen-charcoal font-bold">Monthly Expenses</h2>
            <select 
              id="yearSelect" 
              value={selectedYear} 
              onChange={e => setSelectedYear(e.target.value)}
              className="px-4 py-2 bg-white/50 border border-zen-lavender/60 rounded-full text-zen-charcoal text-base outline-none cursor-pointer h-9 flex items-center"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
        </div>
        <div className="chart-container" style={{ height: '300px', maxHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isMounted ? (
              <Bar data={chartData} options={options as any} plugins={[ChartDataLabels]} />
            ) : (
              <div className="text-zen-charcoal/60">Loading Chart...</div>
            )}
        </div>
        <div id="yearly-details-container" ref={detailsRef} style={{ marginTop: '20px' }}>
          {activeMonthFilter !== null && (
            <div className="month-details p-5 bg-white/40 backdrop-blur-md border border-white/20 rounded-3xl mb-5 shadow-sm text-left">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 className="font-bold text-zen-charcoal">{labels[parseInt(activeMonthFilter, 10)]} {selectedYear} Details</h3>
                <button onClick={() => setActiveMonthFilter(null)} className="px-3 py-1 bg-white/60 border border-zen-lavender/40 text-zen-charcoal rounded-full font-semibold hover:bg-white/80 transition-colors text-sm cursor-pointer border-none">Close</button>
              </div>
              {detailExpenses.length > 0 ? (
                <div className="recent-list">
                  {detailExpenses.map(exp => (
                    <div key={exp.id} className="expense-item">
                      <div className="expense-info">
                        <h4>{exp.item}</h4>
                        <p>{exp.categories?.name || "Uncategorized"} &bull; {formatFriendlyDate(exp.date)}</p>
                      </div>
                      <div className="expense-amount">
                        {formatFriendlyCurrency(
                          convertAmount(parseFloat(exp.amount as any) || 0, baseCurrency, displayCurrency, exchangeRates),
                          displayCurrency
                        )}
                      </div>
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
