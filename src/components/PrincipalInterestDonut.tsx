import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'

export type PrincipalInterestSegment = 'Principal' | 'Interest'

interface PrincipalInterestDonutProps {
  principal: number
  interest: number
  selectedSegment?: PrincipalInterestSegment | null
}

/**
 * Donut chart showing the principal-vs-interest split of total lifetime
 * payments. Lazy-loaded from EMI detail so recharts stays out of the
 * main bundle.
 */
export default function PrincipalInterestDonut({
  principal,
  interest,
  selectedSegment = null,
}: PrincipalInterestDonutProps) {
  const data = [
    { name: 'Principal' as const, value: principal, fill: '#2563eb' },
    { name: 'Interest' as const, value: interest, fill: '#cf2c30' },
  ]

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer
        width="100%"
        height="100%"
        minWidth={0}
        minHeight={0}
      >
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            innerRadius={55}
            outerRadius={85}
            startAngle={90}
            endAngle={450}
            stroke="none"
          >
            {data.map((entry) => {
              const isDimmed =
                selectedSegment !== null && entry.name !== selectedSegment
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
