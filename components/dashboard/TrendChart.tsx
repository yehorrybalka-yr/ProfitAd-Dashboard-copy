"use client";

import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { TrendPoint } from "@/types";
import { formatCurrency, formatDate } from "@/lib/format";

export function TrendChart({ data, currency }: { data: TrendPoint[]; currency: string }) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-ink-soft">
        Нет данных за выбранный период
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4C4FE0" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#4C4FE0" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#E3E5EE" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: "#9497A6" }}
            axisLine={{ stroke: "#E3E5EE" }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: "#9497A6" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: "#9497A6" }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip
            labelFormatter={(v) => formatDate(String(v))}
            formatter={(value: number, name: string) => {
              if (name === "Расход") return [formatCurrency(value, currency), name];
              if (name === "CPL") return [formatCurrency(value, currency), name];
              return [value, name];
            }}
            contentStyle={{
              borderRadius: 10,
              border: "1px solid #E3E5EE",
              fontSize: 12,
              boxShadow: "0 4px 16px rgba(20,21,31,0.08)",
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="spend"
            name="Расход"
            stroke="#4C4FE0"
            fill="url(#spendFill)"
            strokeWidth={2}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="leads"
            name="Лиды"
            stroke="#0F9E8F"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="cpl"
            name="CPL"
            stroke="#C88A1E"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
