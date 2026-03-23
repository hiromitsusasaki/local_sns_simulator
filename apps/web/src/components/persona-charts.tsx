"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts"

interface AgeData {
  ageGroup: string
  count: number
}

interface SexData {
  sex: string
  count: number
}

interface ActivityData {
  level: string | null
  count: number
}

const PIE_COLORS = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6"]

const ACTIVITY_COLORS: Record<string, string> = {
  high: "#22C55E",
  medium: "#3B82F6",
  low: "#F59E0B",
  inactive: "#9CA3AF",
}

export function AgeDistributionChart({ data }: { data: AgeData[] }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">年齢分布</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="ageGroup" fontSize={12} />
          <YAxis fontSize={12} />
          <Tooltip />
          <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function SexDistributionChart({ data }: { data: SexData[] }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">性別比</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="sex"
            cx="50%"
            cy="50%"
            outerRadius={70}
            label={({ sex, count }) => `${sex}: ${count}`}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ActivityDistributionChart({ data }: { data: ActivityData[] }) {
  const chartData = data.map((d) => ({
    ...d,
    level: d.level ?? "不明",
  }))

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">SNS活動レベル</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="count"
            nameKey="level"
            cx="50%"
            cy="50%"
            outerRadius={70}
            label={({ level, count }) => `${level}: ${count}`}
          >
            {chartData.map((item) => (
              <Cell
                key={item.level}
                fill={ACTIVITY_COLORS[item.level] ?? "#9CA3AF"}
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
