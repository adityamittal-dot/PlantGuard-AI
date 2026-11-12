"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { AppShell } from "@/components/AppShell";
import { AuthImage } from "@/components/AuthImage";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { SkeletonCard, SkeletonText } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import { api, ApiError, fetchDiagnosisReport, type Diagnosis } from "@/lib/api";
import { formatConfidence, formatDate, STAGE_LABELS, cn } from "@/lib/utils";
import { staggerContainer, staggerItem, easeSmooth } from "@/lib/motion";

type Tab = "predictions" | "explanation" | "recommendations";

function ConfidenceBar({ probability, delay }: { probability: number; delay: number }) {
  const pct = Math.min(100, probability <= 1 ? probability * 100 : probability);
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream">
      <motion.div
        className="h-full rounded-full bg-emerald"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.7, ease: easeSmooth, delay }}
      />
    </div>
  );
}

export default function DiagnosisDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const toast = useToast();
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("predictions");
  const [downloading, setDownloading] = useState(false);

  async function downloadReport() {
    setDownloading(true);
    try {
      const blob = await fetchDiagnosisReport(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `plantguard-report-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Download failed.";
      toast.push({ title: "Couldn't download report", description: message, tone: "error" });
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.getDiagnosis(id);
        if (!cancelled) setDiagnosis(data);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof ApiError ? err.message : "Failed to load diagnosis.";
          setError(message);
          toast.push({ title: "Couldn't load diagnosis", description: message, tone: "error" });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const status = diagnosis?.status?.toUpperCase() || "";
  const tone =
    status === "COMPLETED" ? "success" : status === "FAILED" ? "danger" : "info";

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/history" className="text-sm text-emerald link-underline">
            ← History
          </Link>
          <h1 className="mt-3 font-display text-4xl text-charcoal">Diagnosis</h1>
          <p className="mt-2 text-sm text-charcoal/50">{formatDate(diagnosis?.created_at)}</p>
        </div>
        {diagnosis && (
          <Badge tone={tone} className="mt-2">
            {diagnosis.status}
            {diagnosis.job_stage ? ` · ${STAGE_LABELS[diagnosis.job_stage] || diagnosis.job_stage}` : ""}
          </Badge>
        )}
      </div>

      {loading && (
        <div className="mt-10 space-y-10">
          <div className="grid gap-8 lg:grid-cols-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonText lines={3} />
        </div>
      )}
      {!loading && error && <p className="mt-10 text-sm text-danger">{error}</p>}

      {diagnosis && (
        <motion.div
          className="mt-10 space-y-12"
          initial="hidden"
          animate="show"
          variants={staggerContainer}
        >
          <motion.div variants={staggerItem} className="grid gap-8 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-charcoal/45">
                Source image
              </p>
              <div className="mt-3 overflow-hidden rounded-md bg-white shadow-soft">
                <AuthImage
                  src={diagnosis.image_url}
                  alt="Diagnosed leaf"
                  className="aspect-[4/3] w-full"
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-charcoal/45">
                Attention heatmap
              </p>
              <div className="mt-3 overflow-hidden rounded-md bg-white shadow-soft">
                {diagnosis.explanation?.heatmap_url ? (
                  <AuthImage
                    src={diagnosis.explanation.heatmap_url}
                    alt="Model attention heatmap"
                    className="aspect-[4/3] w-full"
                  />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-cream text-sm text-charcoal/40">
                    Heatmap unavailable
                  </div>
                )}
              </div>
              {diagnosis.explanation?.disclaimer && (
                <p className="mt-3 text-xs leading-relaxed text-charcoal/50">
                  {diagnosis.explanation.disclaimer}
                </p>
              )}
            </div>
          </motion.div>

          <motion.div
            variants={staggerItem}
            className="grid gap-6 border-y border-charcoal/10 py-8 sm:grid-cols-3"
          >
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-charcoal/45">Confidence</p>
              <p className="mt-2 font-display text-3xl">
                {diagnosis.overall_confidence != null ? (
                  <AnimatedNumber
                    value={
                      diagnosis.overall_confidence <= 1
                        ? diagnosis.overall_confidence * 100
                        : diagnosis.overall_confidence
                    }
                    format={(n) => `${n}%`}
                  />
                ) : (
                  formatConfidence(diagnosis.overall_confidence)
                )}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-charcoal/45">Severity</p>
              <p className="mt-2 font-display text-3xl">
                {diagnosis.severity?.severity_label || "—"}
              </p>
              {diagnosis.severity && (
                <p className="mt-1 text-sm text-charcoal/50">
                  Score {diagnosis.severity.severity_score.toFixed(2)}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-charcoal/45">Inference</p>
              <p className="mt-2 font-display text-3xl">
                {diagnosis.inference_time_ms != null ? (
                  <>
                    <AnimatedNumber value={Math.round(diagnosis.inference_time_ms)} /> ms
                  </>
                ) : (
                  "—"
                )}
              </p>
            </div>
          </motion.div>

          <motion.div variants={staggerItem}>
            <div className="flex gap-6 border-b border-charcoal/10">
              {(
                [
                  ["predictions", "Predictions"],
                  ["explanation", "Explanation"],
                  ["recommendations", "Recommendations"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "relative pb-3 text-sm font-medium transition-colors",
                    tab === key ? "text-emerald" : "text-charcoal/45 hover:text-charcoal"
                  )}
                >
                  {label}
                  {tab === key && (
                    <motion.span
                      layoutId="diagnosis-tab-underline"
                      className="absolute inset-x-0 -bottom-px h-0.5 bg-emerald"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: easeSmooth }}
                className="mt-6"
              >
                {tab === "predictions" && (
                  <ul className="space-y-4">
                    {(diagnosis.predictions || []).length === 0 ? (
                      <p className="text-sm text-charcoal/50">No predictions yet.</p>
                    ) : (
                      diagnosis.predictions.map((p, i) => (
                        <li
                          key={p.id}
                          className="flex items-center justify-between gap-4 border-b border-charcoal/8 py-3"
                        >
                          <div>
                            <p className="font-medium text-charcoal">
                              #{p.rank} {p.label}
                            </p>
                          </div>
                          <div className="flex min-w-[140px] items-center gap-3">
                            <ConfidenceBar probability={p.probability} delay={i * 0.08} />
                            <span className="w-14 text-right text-sm text-charcoal/65">
                              {formatConfidence(p.probability)}
                            </span>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                )}

                {tab === "explanation" && (
                  <div className="max-w-2xl space-y-3 text-sm leading-relaxed text-charcoal/70">
                    <p>
                      Method:{" "}
                      <span className="font-medium text-charcoal">
                        {diagnosis.explanation?.method || "Unavailable"}
                      </span>
                    </p>
                    <p>
                      Highlighted regions indicate areas that most strongly
                      influenced the model&apos;s visual prediction. They do not
                      prove a pathogen is present.
                    </p>
                    {diagnosis.error_message && (
                      <p className="text-danger">{diagnosis.error_message}</p>
                    )}
                  </div>
                )}

                {tab === "recommendations" && (
                  <ul className="space-y-6">
                    {(diagnosis.recommendations || []).length === 0 ? (
                      <p className="text-sm text-charcoal/50">
                        No recommendations available for this result.
                      </p>
                    ) : (
                      diagnosis.recommendations.map((r) => (
                        <li key={r.id} className="border-l-2 border-leaf/50 pl-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium text-charcoal">{r.title}</h3>
                            <Badge tone="neutral">{r.priority}</Badge>
                            <Badge tone="info">{r.category}</Badge>
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-charcoal/65">
                            {r.description}
                          </p>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>

          <motion.aside
            variants={staggerItem}
            className="rounded-md bg-cream/80 px-5 py-4 text-sm leading-relaxed text-charcoal/70"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald">
              Scientific note
            </p>
            <p className="mt-2">
              {diagnosis.scientific_note ||
                "Output is visual symptom classification / advisory assessment, not laboratory-confirmed pathogen identification."}
            </p>
          </motion.aside>

          <motion.div variants={staggerItem} className="flex gap-3">
            <Link href="/analyze">
              <Button>Analyze another</Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="outline">Back to dashboard</Button>
            </Link>
            <Button
              variant="secondary"
              loading={downloading}
              onClick={() => void downloadReport()}
            >
              Download PDF report
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AppShell>
  );
}
