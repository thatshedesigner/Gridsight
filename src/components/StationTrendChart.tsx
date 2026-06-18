"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WeeklyTimeSeriesPoint } from "@/lib/types";

type StationTrendChartProps = {
  data: WeeklyTimeSeriesPoint[];
};

function formatChartDate(value: unknown, includeYear = false) {
  if (typeof value !== "string") {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: includeYear ? "numeric" : undefined,
  }).format(new Date(value));
}

export default function StationTrendChart({ data }: StationTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-6 text-center text-sm leading-6 text-slate-500">
        No weekly activity data is available for this station.
      </div>
    );
  }

  return (
    <div className="h-72 w-full sm:h-80">
      <ResponsiveContainer height="100%" width="100%">
        <LineChart data={data} margin={{ bottom: 8, left: 0, right: 18, top: 8 }}>
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" />
          <XAxis
            dataKey="week"
            minTickGap={28}
            stroke="#64748b"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => formatChartDate(value)}
          />
          <YAxis
            allowDecimals={false}
            stroke="#64748b"
            tick={{ fontSize: 12 }}
            width={42}
          />
          <Tooltip
            contentStyle={{
              borderColor: "#cbd5e1",
              borderRadius: 8,
              boxShadow: "0 10px 30px rgb(15 23 42 / 0.12)",
            }}
            labelFormatter={(value) => formatChartDate(value, true)}
          />
          <Legend />
          <Line
            activeDot={{ r: 5 }}
            dataKey="violationCount"
            dot={false}
            name="Violations"
            stroke="#334155"
            strokeWidth={3}
            type="monotone"
          />
          <Line
            activeDot={{ r: 5 }}
            dataKey="closureCount"
            dot={false}
            name="Closure incidents"
            stroke="#dc2626"
            strokeWidth={3}
            type="monotone"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
