"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { ErrorNotice } from "@/components/ErrorNotice";
import { MetricStat } from "@/components/MetricStat";
import { RoleGuard } from "@/components/RoleGuard";
import { Skeleton, SkeletonStat } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth";
import {
  api,
  ApiError,
  type ActiveClassMetrics,
  type DatasetSummary,
  type ModelVersionRow,
} from "@/lib/api";
import { fadeUp, staggerContainer } from "@/lib/motion";
import { formatDate } from "@/lib/utils";

function statusTone(status: string) {
  switch (status) {
    case "production":
      return "success" as const;
    case "approved":
      return "info" as const;
    case "candidate":
    case "validation":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
}

function pct(value?: number | null) {
  return value == null ? "—" : `${(value * 100).toFixed(2)}%`;
}

function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="mt-6 space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

function errMsg(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback;
}

function ResearchContent() {
  const toast = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  const [datasets, setDatasets] = useState<DatasetSummary | null>(null);
  const [models, setModels] = useState<ModelVersionRow[] | null>(null);
  const [classMetrics, setClassMetrics] = useState<ActiveClassMetrics | null>(null);
  const [errors, setErrors] = useState<{ datasets?: string; models?: string; metrics?: string }>({});
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const load = useCallback(async (isCancelled: () => boolean = () => false) => {
    setLoading(true);
    const [d, m, c] = await Promise.allSettled([
      api.researchDatasets(),
      api.researchModels(),
      api.researchClassMetrics(),
    ]);
    if (isCancelled()) return;
    const next: typeof errors = {};
    if (d.status === "fulfilled") setDatasets(d.value);
    else next.datasets = errMsg(d.reason, "Failed to load dataset summary.");
    if (m.status === "fulfilled") setModels(m.value);
    else next.models = errMsg(m.reason, "Failed to load model registry.");
    if (c.status === "fulfilled") setClassMetrics(c.value);
    else next.metrics = errMsg(c.reason, "Failed to load per-class metrics.");
    setErrors(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function promote(row: ModelVersionRow) {
    setPromotingId(row.id);
    try {
      await api.promoteModel(row.id);
      toast.push({
        title: "Model promoted",
        description: `${row.model_name} ${row.version} is now the active model.`,
        tone: "success",
      });
      setConfirmId(null);
      await load();
    } catch (err) {
      toast.push({ title: "Couldn't promote model", description: errMsg(err, "Promotion failed."), tone: "error" });
    } finally {
      setPromotingId(null);
    }
  }

  return (
    <>
      <motion.div initial="hidden" animate="show" variants={fadeUp}>
        <p className="eyebrow">Research</p>
        <h1 className="mt-2 font-display text-4xl text-charcoal">Research dashboard</h1>
        <p className="mt-2 max-w-xl text-sm text-charcoal/60">
          Dataset composition, the model registry, and per-class evaluation of the active model.
        </p>
      </motion.div>

      {/* Dataset */}
      <section className="mt-12">
        <h2 className="font-display text-2xl">Dataset</h2>
        {errors.datasets ? (
          <ErrorNotice message={errors.datasets} onRetry={() => void load()} />
        ) : loading ? (
          <TableSkeleton />
        ) : !datasets || datasets.classes.length === 0 ? (
          <EmptyState title="No dataset information" description="No class counts were found for the dataset." />
        ) : (
          <>
            <p className="mt-2 text-sm text-charcoal/60">
              {datasets.name} ·{" "}
              <a href={datasets.source_url} target="_blank" rel="noreferrer" className="text-emerald link-underline">
                source
              </a>{" "}
              · counts from {datasets.source}
            </p>
            <motion.div
              className="mt-6 grid gap-8 border-y border-charcoal/10 py-8 sm:grid-cols-3"
              initial="hidden"
              animate="show"
              variants={staggerContainer}
            >
              <MetricStat label="Total images" value={datasets.total_images} hint={datasets.approximate ? "Approximate" : undefined} />
              <MetricStat label="Classes" value={datasets.class_count} />
              <MetricStat
                label="Imbalance ratio"
                value={datasets.imbalance_ratio ? `${datasets.imbalance_ratio}×` : "—"}
                hint="Largest / smallest class"
              />
            </motion.div>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead>
                  <tr className="border-b border-charcoal/15 text-xs uppercase tracking-[0.12em] text-charcoal/45">
                    <th className="pb-3 font-semibold">Class</th>
                    <th className="pb-3 font-semibold">Images</th>
                    <th className="pb-3 font-semibold">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.classes.map((c) => (
                    <tr key={c.label} className="border-b border-charcoal/8">
                      <td className="py-3 font-medium text-charcoal">{c.label}</td>
                      <td className="py-3 text-charcoal/65">{c.count.toLocaleString()}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-1.5 w-32 rounded-full bg-charcoal/8">
                            <div className="h-1.5 rounded-full bg-emerald" style={{ width: `${c.share * 100}%` }} />
                          </div>
                          <span className="text-charcoal/55">{(c.share * 100).toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-charcoal/50">{datasets.note}</p>
          </>
        )}
      </section>

      {/* Registry */}
      <section className="mt-14">
        <h2 className="font-display text-2xl">Model registry</h2>
        {errors.models ? (
          <ErrorNotice message={errors.models} onRetry={() => void load()} />
        ) : loading ? (
          <TableSkeleton />
        ) : !models || models.length === 0 ? (
          <EmptyState title="No model versions" description="No model versions are registered yet." />
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="border-b border-charcoal/15 text-xs uppercase tracking-[0.12em] text-charcoal/45">
                  <th className="pb-3 font-semibold">Model</th>
                  <th className="pb-3 font-semibold">Version</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Accuracy</th>
                  <th className="pb-3 font-semibold">Precision</th>
                  <th className="pb-3 font-semibold">Recall</th>
                  <th className="pb-3 font-semibold">F1</th>
                  <th className="pb-3 font-semibold">Created</th>
                  {isAdmin && <th className="pb-3 text-right font-semibold">Action</th>}
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.id} className="border-b border-charcoal/8 align-middle">
                    <td className="py-3">
                      <p className="font-medium text-charcoal">{m.model_name}</p>
                      <p className="text-xs text-charcoal/45">{m.architecture}</p>
                    </td>
                    <td className="py-3 text-charcoal/70">{m.version}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={statusTone(m.status)}>{m.is_active ? "active" : m.status}</Badge>
                        {!m.artifact_available && <Badge tone="danger">no artifact</Badge>}
                      </div>
                    </td>
                    <td className="py-3 text-charcoal/65">{pct(m.metrics.accuracy)}</td>
                    <td className="py-3 text-charcoal/65">{pct(m.metrics.precision)}</td>
                    <td className="py-3 text-charcoal/65">{pct(m.metrics.recall)}</td>
                    <td className="py-3 text-charcoal/65">{pct(m.metrics.f1_score)}</td>
                    <td className="py-3 text-charcoal/55">{formatDate(m.created_at)}</td>
                    {isAdmin && (
                      <td className="py-3 text-right">
                        {m.is_active ? (
                          <span className="text-xs text-charcoal/45">Serving</span>
                        ) : confirmId === m.id ? (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" loading={promotingId === m.id} onClick={() => void promote(m)}>
                              Confirm
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!m.artifact_available}
                            onClick={() => setConfirmId(m.id)}
                          >
                            Promote
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Per-class metrics */}
      <section className="mt-14">
        <h2 className="font-display text-2xl">Per-class metrics (active model)</h2>
        {errors.metrics ? (
          <ErrorNotice message={errors.metrics} onRetry={() => void load()} />
        ) : loading ? (
          <TableSkeleton rows={5} />
        ) : !classMetrics ? (
          <EmptyState title="No active model" description="Promote a model version to see its per-class evaluation." />
        ) : !classMetrics.available ? (
          <EmptyState
            title="No evaluation report"
            description={classMetrics.note || "No per-class metrics are recorded for the active model."}
          />
        ) : (
          <>
            <p className="mt-2 text-sm text-charcoal/60">
              {classMetrics.model_name} · {classMetrics.version}
              {classMetrics.accuracy != null && ` · accuracy ${pct(classMetrics.accuracy)}`}
            </p>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead>
                  <tr className="border-b border-charcoal/15 text-xs uppercase tracking-[0.12em] text-charcoal/45">
                    <th className="pb-3 font-semibold">Class</th>
                    <th className="pb-3 font-semibold">Precision</th>
                    <th className="pb-3 font-semibold">Recall</th>
                    <th className="pb-3 font-semibold">F1</th>
                    <th className="pb-3 font-semibold">Support</th>
                  </tr>
                </thead>
                <tbody>
                  {classMetrics.classes.map((c) => (
                    <tr key={c.label} className="border-b border-charcoal/8">
                      <td className="py-3 font-medium text-charcoal">{c.label}</td>
                      <td className="py-3 text-charcoal/65">{pct(c.precision)}</td>
                      <td className="py-3 text-charcoal/65">{pct(c.recall)}</td>
                      <td className="py-3 text-charcoal/65">{pct(c.f1)}</td>
                      <td className="py-3 text-charcoal/55">{c.support.toLocaleString()}</td>
                    </tr>
                  ))}
                  {classMetrics.macro && (
                    <tr className="text-charcoal">
                      <td className="py-3 font-semibold">Macro average</td>
                      <td className="py-3">{pct(classMetrics.macro.precision)}</td>
                      <td className="py-3">{pct(classMetrics.macro.recall)}</td>
                      <td className="py-3">{pct(classMetrics.macro.f1)}</td>
                      <td className="py-3" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </>
  );
}

export default function ResearchPage() {
  return (
    <AppShell>
      <RoleGuard roles={["RESEARCHER", "ADMIN"]}>
        <ResearchContent />
      </RoleGuard>
    </AppShell>
  );
}
