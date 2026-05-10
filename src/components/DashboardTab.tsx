'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
import { convertAmount, formatFriendlyCurrency, formatChartFriendlyCurrency } from '@/lib/utils';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { formatUTCToLocal, formatFriendlyDate, wrapLabel } from '@/lib/utils';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

function getCurrentMonthDatesLocal() {

const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const currentMonth = y + '-' + m;
  return { firstDay: currentMonth, todayStr: currentMonth };
}

export default function DashboardTab() {
  const { expenses, activeCategoryFilter, setActiveCategoryFilter, displayCurrency, baseCurrency, exchangeRates } = useExpenseStore();
  
  const { firstDay, todayStr } = getCurrentMonthDatesLocal();
  
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(todayStr);
  const detailsRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleClear = () => {
    setStartDate('');
    setEndDate('');
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      if (!exp.date) return false;
      const localDateStr = formatUTCToLocal(exp.date).substring(0, 7);
      if (startDate && localDateStr < startDate) return false;
      if (endDate && localDateStr > endDate) return false;
      return true;
    });
  }, [expenses, startDate, endDate]);

  const total = filteredExpenses.reduce((sum, exp) => {
    const amtBase = parseFloat(exp.amount as any) || 0;
    const amtDisplay = convertAmount(amtBase, baseCurrency, displayCurrency, exchangeRates);
    return sum + amtDisplay;
  }, 0);

  const { labels, data, bgColors } = useMemo(() => {
    const byCategory: Record<string, { total: number; items: any[] }> = {};
    filteredExpenses.forEach(exp => {
      const catName = exp.categories?.name || "Uncategorized";
      if (!byCategory[catName]) byCategory[catName] = { total: 0, items: [] };
      const amtBase = parseFloat(exp.amount as any) || 0;
      const amtDisplay = convertAmount(amtBase, baseCurrency, displayCurrency, exchangeRates);
      byCategory[catName].total += amtDisplay;
      byCategory[catName].items.push(exp);
    });

    const brandColors = ['#AEC3B0', '#D8D2E1', '#F9E4D4'];
    const sorted = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total);
    return {
      labels: sorted.map(s => s[0]),
      data: sorted.map(s => s[1].total),
      bgColors: sorted.map((_, i) => brandColors[i % brandColors.length])
    };
  }, [filteredExpenses, displayCurrency, baseCurrency, exchangeRates]);

  const chartData = {
    labels: labels.map(l => wrapLabel(l, 12)),
    datasets: [{
      label: 'Amount',
      data,
      backgroundColor: bgColors,
      borderRadius: 4,
      minBarLength: 15
    }]
  };

  const onClick = (event: any, elements: any[], chart: any) => {
    if (elements.length > 0) {
      const idx = elements[0].index;
      const category = labels[idx];
      setActiveCategoryFilter(category);
      setTimeout(() => {
        detailsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else if (chart) {
      const yScale = chart.scales.y;
      const x = event.x;
      const y = event.y;
      
      // Check if click was on the Y-axis tick area
      if (x >= yScale.left && x <= yScale.right) {
        const idx = Math.round(yScale.getValueForPixel(y));
        if (idx >= 0 && idx < labels.length) {
          const category = labels[idx];
          setActiveCategoryFilter(category);
          setTimeout(() => {
            detailsRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      }
    }
  };

  const options = {
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    interaction: { mode: 'index' as const, intersect: false, axis: 'y' as const },
    onClick: onClick,
    layout: {
      padding: { right: 80 }
    },
    scales: {
      x: { 
        display: false, 
      },
      y: { 
        grid: { display: false }, 
        border: { display: false }, 
        ticks: { 
          font: (context: any) => {
            const width = context.chart?.width || 0;
            return {
              size: width < 350 ? 10 : 13,
              weight: 'bold' as const
            };
          },
          color: '#2D3748' 
        } 
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.x !== null) {
              label += formatChartFriendlyCurrency(context.parsed.x, displayCurrency);
            }
            return label;
          }
        }
      },
      datalabels: {
        anchor: 'end' as const,
        align: 'right' as const,
        formatter: (value: number) => formatChartFriendlyCurrency(value, displayCurrency),
        color: '#2D3748',
        font: (context: any) => {
          const width = context.chart?.width || 0;
          return {
            size: width < 350 ? 10 : 13,
            weight: 600
          };
        },
        listeners: {
          click: function(context: any) {
            const idx = context.dataIndex;
            setActiveCategoryFilter(labels[idx]);
            setTimeout(() => {
              detailsRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
            return true;
          }
        }
      }
    }
  };

  const detailExpenses = useMemo(() => {
    if (!activeCategoryFilter) return [];
    return filteredExpenses.filter(e => (e.categories?.name || "Uncategorized") === activeCategoryFilter);
  }, [filteredExpenses, activeCategoryFilter]);

  return (
    <div id="tab-dashboard" className="tab-content active" style={{ display: "block" }}>
      <div className="filter-container flex flex-col gap-3 w-full mb-5">
        {/* Row 1: Full-Width Flex-Grow Inputs */}
        <div className="flex flex-row items-center justify-between gap-3 w-full">
          <input 
            type="month" 
            id="start-date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)} 
            className="flex-1 min-w-0 rounded-full bg-white/50 border border-zen-lavender/60 px-4 py-2 text-sm text-zen-charcoal focus:outline-none focus:ring-2 focus:ring-zen-sage outline-none h-9 text-center"
          />
          <span className="flex-shrink-0 text-zen-charcoal/60 font-medium px-1">
            to
          </span>
          <input 
            type="month" 
            id="end-date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)} 
            className="flex-1 min-w-0 rounded-full bg-white/50 border border-zen-lavender/60 px-4 py-2 text-sm text-zen-charcoal focus:outline-none focus:ring-2 focus:ring-zen-sage outline-none h-9 text-center"
          />
        </div>
        
        {/* Row 2: Centered Clear Button */}
        <div className="flex justify-center w-full">
          <button 
            type="button" 
            onClick={handleClear} 
            className="px-6 py-2 bg-white/60 border border-zen-lavender/40 text-zen-charcoal rounded-full font-semibold hover:bg-white/80 transition-all text-xs cursor-pointer border-none h-8 flex items-center justify-center"
            style={{ minWidth: '80px' }}
          >
            Clear Filter
          </button>
        </div>
      </div>

      <div className="bg-white/40 backdrop-blur-md border border-white/20 shadow-sm text-zen-charcoal p-6 rounded-2xl text-center mb-6">
          <h3 className="text-zen-charcoal/70 font-medium text-sm mb-2">Total Expense</h3>
          <div id="total-amount" className="text-zen-charcoal text-4xl font-extrabold flex justify-center items-center">
            <span id="total-amount-mobile" className="block md:hidden">{formatChartFriendlyCurrency(total, displayCurrency)}</span>
            <span id="total-amount-desktop" className="hidden md:block">{formatFriendlyCurrency(total, displayCurrency)}</span>
          </div>
      </div>

      <h2 className="font-bold">By Category</h2>
      <div className="chart-container" style={{ height: Math.max(300, labels.length * 40 + 50) + 'px' }}>
          {isMounted && labels.length > 0 ? (
            <Bar data={chartData} options={options as any} plugins={[ChartDataLabels]} />
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              {isMounted ? 'No expenses in this range.' : 'Loading Chart...'}
            </div>
          )}
      </div>
      <div id="category-details-container" ref={detailsRef} style={{ marginTop: '20px' }}>
        {activeCategoryFilter && (
          <div className="category-details p-5 bg-white/40 backdrop-blur-md border border-white/20 rounded-3xl mb-5 shadow-sm text-left">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 className="font-bold text-zen-charcoal">{activeCategoryFilter} Details</h3>
              <button onClick={() => setActiveCategoryFilter(null)} className="px-3 py-1 bg-white/60 border border-zen-lavender/40 text-zen-charcoal rounded-full font-semibold hover:bg-white/80 transition-colors text-sm cursor-pointer border-none">Close</button>
            </div>
            <div className="recent-list">
              {detailExpenses.map(exp => (
                <div key={exp.id} className="expense-item">
                  <div className="expense-info">
                    <h4>{exp.item}</h4>
                    <p>{formatFriendlyDate(exp.date)}</p>
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
          </div>
        )}
      </div>
    </div>
  );
}
