import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'

interface PrincipalInterestDonutProps {
  principal: number
  interest: number
}

/**
 * Donut chart showing the principal-vs-interest split of total lifetime
 * payments. Lazy-loaded from EMI detail so recharts stays out of the
 * main bundle.
 */
export default function PrincipalInterestDonut({
  principal,
  interest,
}: PrincipalInterestDonutProps) {
  const data = [
    { name: 'Principal', value: principal, fill: '#2563eb' },
    { name: 'Interest', value: interest, fill: '#cf2c30' },
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
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
