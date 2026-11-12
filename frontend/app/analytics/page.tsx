"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/Button";
import { ChartCard, CHART_COLORS } from "@/components/ChartCard";
import { EmptyState } from "@/components/EmptyState";
import { ErrorNotice } from "@/components/ErrorNotice";
import { Input } from "@/components/Input";
import { MetricStat } from "@/components/MetricStat";
import { Select } from "@/components/Select";
import { Skeleton, SkeletonStat } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import {
  api,
  ApiError,
  fetchAnalyticsCsv,
  type AnalyticsDistribution,
  type AnalyticsFilters,
  type AnalyticsSummary,
  type AnalyticsTimeseries,
} from "@/lib/api";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { formatConfidence } from "@/lib/utils";

const CATEGORIES = ["Bacteria", "Fungi", "Healthy", "Pests", "Virus"];
const CATEGORY_OPTIONS = [
  { value: "", label: "All categories" },
  ...CATEGORIES.map((c) => ({ value: c, label: c })),
];

function isoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  return { from: isoDate(from), to: isoDate(to) };
}

const BAR_COLORS: Record<string, string> = {
  Bacteria: CHART_COLORS.warning,
  Fungi: CHART_COLORS.moss,
  Healthy: CHART_COLORS.emerald,
  Pests: CHART_COLORS.danger,
  Virus: CHART_COLORS.sage,
};

export default function AnalyticsPage() {
  const toast = useToast();
  const initial = useMemo(defaultRange, []);
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [category, setCategory] = useState("");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [series, setSeries] = useState<AnalyticsTimeseries | null>(null);
  const [dist, setDist] = useState<AnalyticsDistribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const rangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const filters = useMemo<AnalyticsFilters>(
    () => ({
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      category: category || undefined,
    }),
    [dateFrom, dateTo, category]
  );

  const load = useCallback(
    async (isCancelled: () => boolean) => {
      if (rangeInvalid) return;
      setLoading(true);
      setError("");
      try {
        const [s, t, d] = await Promise.all([
          api.analyticsSummary(filters),
          api.analyticsTimeseries(filters),
          api.analyticsDistribution(filters),
        ]);
        if (isCancelled()) return;
        setSummary(s);
        setSeries(t);
        setDist(d);
      } catch (err) {
        if (isCancelled()) return;
        const message = err instanceof ApiError ? err.message : "Failed to load analytics.";
        setError(message);
        toast.push({ title: "Couldn't load analytics", description: message, tone: "error" });
      } finally {
        if (!isCancelled()) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filters, rangeInvalid]
  );

  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load, reloadKey]);

  async function exportCsv() {
    setExporting(true);
    try {
      const blob = await fetchAnalyticsCsv(filters);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "plantguard-diagnoses.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Export failed.";
      toast.push({ title: "Couldn't export CSV", description: message, tone: "error" });
    } finally {
      setExporting(false);
    }
  }

  function resetFilters() {
    const r = defaultRange();
    setDateFrom(r.from);
    setDateTo(r.to);
    setCategory("");
  }

  const isEmpty = !loading && !error && (summary?.total_diagnoses ?? 0) === 0;
  const axisProps = {
    tick: { fill: CHART_COLORS.axis, fontSize: 12 },
    tickLine: false,
    axisLine: { stroke: CHART_COLORS.grid },
  };

  return (
    <AppShell>
      <motion.div
        initial="hidden"
        animate="show"
        variants={fadeUp}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <p className="eyebrow">Insights</p>
          <h1 className="mt-2 font-display text-4xl text-charcoal">Analytics</h1>
          <p className="mt-2 max-w-xl text-sm text-charcoal/60">
            Diagnosis volume, category mix, confidence and image quality over time.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} loading={exporting}>
          Export CSV
        </Button>
      </motion.div>

      <div className="mt-8 grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <Input
          label="From"
          type="date"
          value={dateFrom}
          max={dateTo || undefined}
          onChange={(e) => setDateFrom(e.target.value)}
          error={rangeInvalid ? "Start must be before end" : undefined}
        />
        <Input
          label="To"
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(e) => setDateTo(e.target.value)}
        />
        <Select label="Category" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
        <Button variant="ghost" onClick={resetFilters}>
          Reset
        </Button>
      </div>

      {error && <ErrorNotice message={error} onRetry={() => setReloadKey((k) => k + 1)} />}

      {loading ? (
        <>
          <div className="mt-10 grid gap-8 border-y border-charcoal/10 py-10 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonStat key={i} />
            ))}
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </>
      ) : isEmpty ? (
        <EmptyState
          title="No diagnoses in this range"
          description="Widen the date range or clear the category filter, or run a new analysis."
          actionLabel="Reset filters"
          onAction={resetFilters}
        />
      ) : summary && series && dist && !error ? (
        <>
          <motion.div
            className="mt-10 grid gap-8 border-y border-charcoal/10 py-10 sm:grid-cols-2 lg:grid-cols-4"
            initial="hidden"
            animate="show"
            variants={staggerContainer}
          >
            <MetricStat label="Total diagnoses" value={summary.total_diagnoses} />
            <MetricStat
              label="Completed"
              value={summary.completed_diagnoses}
              hint={`${summary.failed_diagnoses} failed`}
            />
            <MetricStat
              label="Avg. confidence"
              value={formatConfidence(summary.average_confidence)}
            />
            <MetricStat
              label="Healthy vs. diseased"
              value={`${summary.healthy_detections} / ${summary.diseased_detections}`}
              hint="Top-prediction categories"
            />
          </motion.div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <ChartCard title="Diagnoses over time" description="Daily count in the selected range">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series.points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis dataKey="date" {...axisProps} minTickGap={28} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Diagnoses"
                    stroke={CHART_COLORS.emerald}
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Category distribution" description="Top prediction of completed diagnoses">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dist.items} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="Diagnoses" radius={[3, 3, 0, 0]}>
                    {dist.items.map((i) => (
                      <Cell key={i.label} fill={BAR_COLORS[i.label] ?? CHART_COLORS.leaf} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Average confidence by category" description="Completed diagnoses only">
              {summary.confidence_by_category.length === 0 ? (
                <p className="py-10 text-sm text-charcoal/50">No completed diagnoses with confidence yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={summary.confidence_by_category.map((c) => ({
                      label: c.label,
                      confidence: Math.round(c.average_confidence * 1000) / 10,
                    }))}
                    margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                    <XAxis dataKey="label" {...axisProps} />
                    <YAxis {...axisProps} domain={[0, 100]} unit="%" />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Bar dataKey="confidence" name="Avg. confidence" fill={CHART_COLORS.leaf} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Image quality" description="Quality-check outcome per diagnosis">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={summary.quality_breakdown}
                  margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
                  <XAxis type="number" {...axisProps} allowDecimals={false} />
                  <YAxis type="category" dataKey="status" {...axisProps} width={80} />
                  <Tooltip />
                  <Bar dataKey="count" name="Diagnoses" fill={CHART_COLORS.emerald} radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
