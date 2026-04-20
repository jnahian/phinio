import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'

interface AllocationDonutProps {
  data: Array<{ type: string; value: string; percent: number }>
  selectedType?: string | null
}

const COLORS: Record<string, string> = {
  stock: '#2563eb',
  mutual_fund: '#4edea3',
  fd: '#8d90a0',
  gold: '#ffd46a',
  crypto: '#c4a8ff',
  other: '#434655',
}

/**
 * Compact donut chart for the home-screen investment allocation snapshot.
 * Lazy-loaded so recharts stays out of bundles that don't need it.
 */
export default function AllocationDonut({
  data,
  selectedType = null,
}: AllocationDonutProps) {
  if (data.length === 0) {
    return null
  }
  const chartData = data.map((d) => ({
    name: d.type,
    value: Number(d.value),
    fill: COLORS[d.type] ?? COLORS.other,
  }))
  return (
    <div className="h-32 w-32">
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        minHeight={0}
      >
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            innerRadius={38}
            outerRadius={56}
            startAngle={90}
            endAngle={450}
            stroke="none"
            paddingAngle={2}
            isAnimationActive={false}
          >
            {chartData.map((entry) => {
              const isDimmed =
                selectedType !== null && entry.name !== selectedType
              return (
                <Cell
                  key={entry.name}
                  fill={entry.fill}
                  fillOpacity={isDimmed ? 0.15 : 1}
                  style={{ transition: 'fill-opacity 200ms ease' }}
                />
              )
            })}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
