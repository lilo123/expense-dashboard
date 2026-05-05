path = '/usr/local/google/home/duynguyenn/expense-dashboard/src/components/YearlyTab.tsx'
with open(path, 'r') as f:
    c = f.read()

lines = c.split('\n')
c = '\n'.join(lines[:221]) + '\n'

bad = "if (context.parsed.y !== null) { label += ' = useMemo(() => {"
good = """if (context.parsed.y !== null) { label += '$' + (Number(context.parsed.y) / 1000).toFixed(1) + 'K'; }
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

const detailExpenses = useMemo(() => {"""

c = c.replace(bad, good)

with open(path, 'w') as f:
    f.write(c)
