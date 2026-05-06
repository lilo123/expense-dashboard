'use client';
import { useState, useMemo, useRef } from 'react';
import { useExpenseStore } from '@/store/useExpenseStore';
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
  const { expenses, activeCategoryFilter, setActiveCategoryFilter } = useExpenseStore();
  
  const { firstDay, todayStr } = getCurrentMonthDatesLocal();
  
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(todayStr);
  const detailsRef = useRef<HTMLDivElement>(null);

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

  const total = filteredExpenses.reduce((sum, exp) => sum + (parseFloat(exp.amount as any) || 0), 0);

  const { labels, data, bgColors } = useMemo(() => {
    const byCategory: Record<string, { total: number; items: any[] }> = {};
    filteredExpenses.forEach(exp => {
      const catName = exp.categories?.name || "Uncategorized";
      if (!byCategory[catName]) byCategory[catName] = { total: 0, items: [] };
      byCategory[catName].total += (parseFloat(exp.amount as any) || 0);
      byCategory[catName].items.push(exp);
    });

    const sorted = Object.entries(byCategory).sort((a, b) => b[1].total - a[1].total);
    return {
      labels: sorted.map(s => s[0]),
      data: sorted.map(s => s[1].total),
      bgColors: sorted.map((_, i) => `hsl(0, 0%, ${15 + (i * 65) / Math.max(1, sorted.length - 1)}%)`)
    };
  }, [filteredExpenses]);

  const chartData = {
    labels: labels.map(l => wrapLabel(l, 12)),
    datasets: [{
      label: 'Amount',
      data,
      backgroundColor: bgColors,
      borderRadius: 4
    }]
  };

  const onClick = (event: any, elements: any[]) => {
    if (elements.length > 0) {
      const idx = elements[0].index;
      const category = labels[idx];
      setActiveCategoryFilter(category);
      setTimeout(() => {
        detailsRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  const options = {
    maintainAspectRatio: false,
    indexAxis: 'y' as const,
    interaction: { mode: 'index' as const, intersect: false },
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
          color: '#000' 
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
              label += '$' + context.parsed.x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
            return label;
          }
        }
      },
      datalabels: {
        anchor: 'end' as const,
        align: 'right' as const,
        formatter: (value: number) => '$' + Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        color: '#000',
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
      {/* MOBILE DATE FILTER (Vertical Stack with Labels) */}
      <div className="filter-container-mobile flex flex-col gap-2 w-full mb-5 sm:hidden" style={{ boxSizing: 'border-box' }}>
        <div className="flex items-center gap-2 w-full" style={{ height: '44px' }}>
          <span style={{ width: '50px', fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>From</span>
          <input 
            type="month" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)} 
            style={{ flex: 1, height: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', color: 'var(--text)', backgroundColor: 'var(--bg)', boxSizing: 'border-box' }} 
          />
        </div>
        <div className="flex items-center gap-2 w-full" style={{ height: '44px' }}>
          <span style={{ width: '50px', fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', flexShrink: 0 }}>To</span>
          <input 
            type="month" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)} 
            style={{ flex: 1, height: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', color: 'var(--text)', backgroundColor: 'var(--bg)', boxSizing: 'border-box' }} 
          />
        </div>
        <button 
          type="button" 
          onClick={handleClear} 
          className="flex items-center justify-center"
          style={{ height: '44px', width: '100%', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text)', cursor: 'pointer', boxSizing: 'border-box' }}
        >
          Clear
        </button>
      </div>

      {/* DESKTOP DATE FILTER (Horizontal Single Line) */}
      <div className="filter-container-desktop hidden sm:flex sm:flex-row sm:items-stretch gap-2 w-full mb-5 pb-2" style={{ boxSizing: 'border-box' }}>
        <input 
          type="month" 
          id="start-date" 
          value={startDate} 
          onChange={e => setStartDate(e.target.value)} 
          className="sm:flex-1 sm:min-w-[130px]"
          style={{ height: '42px', padding: '8px 12px', border: '1px solid var(--border, #e5e7eb)', borderRadius: '8px', fontSize: '14px', color: 'var(--text, #374151)', backgroundColor: 'var(--bg, #ffffff)', boxSizing: 'border-box' }} 
        />
        <span 
          className="sm:flex sm:items-center sm:justify-center sm:px-2"
          style={{ color: 'var(--text-muted, #6b7280)', fontWeight: 500 }}
        >
          to
        </span>
        <input 
          type="month" 
          id="end-date" 
          value={endDate} 
          onChange={e => setEndDate(e.target.value)} 
          className="sm:flex-1 sm:min-w-[130px]"
          style={{ height: '42px', padding: '8px 12px', border: '1px solid var(--border, #e5e7eb)', borderRadius: '8px', fontSize: '14px', color: 'var(--text, #374151)', backgroundColor: 'var(--bg, #ffffff)', boxSizing: 'border-box' }} 
        />
        <button 
          type="button" 
          onClick={handleClear} 
          className="sm:flex-shrink-0 sm:col-auto flex items-center justify-center"
          style={{ height: '42px', padding: '0 20px', backgroundColor: 'var(--surface, #f3f4f6)', border: '1px solid var(--border, #e5e7eb)', borderRadius: '8px', fontSize: '14px', fontWeight: 600, color: 'var(--text, #374151)', cursor: 'pointer', boxSizing: 'border-box' }}
        >
          Clear
        </button>
      </div>

      <div className="summary-card total-card">
          <h3>Total Expense</h3>
          <p id="total-amount">${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      </div>

      <h2 className="font-bold">By Category</h2>
      <div className="chart-container" style={{ height: Math.max(300, labels.length * 40 + 50) + 'px' }}>
          {labels.length > 0 ? (
            <Bar data={chartData} options={options as any} plugins={[ChartDataLabels]} />
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No expenses in this range.
            </div>
          )}
      </div>
      <div id="category-details-container" ref={detailsRef} style={{ marginTop: '20px' }}>
        {activeCategoryFilter && (
          <div className="category-details">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3>{activeCategoryFilter} Details</h3>
              <button onClick={() => setActiveCategoryFilter(null)} style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--text)' }}>Close</button>
            </div>
            <div className="recent-list">
              {detailExpenses.map(exp => (
                <div key={exp.id} className="expense-item">
                  <div className="expense-info">
                    <h4>{exp.item}</h4>
                    <p>{formatFriendlyDate(exp.date)}</p>
                  </div>
                  <div className="expense-amount">${(parseFloat(exp.amount as any) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
