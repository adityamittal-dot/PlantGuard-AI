"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { MetricStat } from "@/components/MetricStat";
import { SkeletonStat } from "@/components/Skeleton";
import { useToast } from "@/components/Toast";
import {
  api,
  ApiError,
  type AnalyticsOverview,
  type Diagnosis,
} from "@/lib/api";
import { formatConfidence, formatDate } from "@/lib/utils";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

function statusTone(status: string) {
  const s = status.toUpperCase();
  if (s === "COMPLETED") return "success" as const;
  if (s === "FAILED") return "danger" as const;
  return "info" as const;
}

export default function DashboardPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
  const [recent, setRecent] = useState<Diagnosis[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [ov, list] = await Promise.all([
          api.analyticsOverview(),
          api.listDiagnoses(),
        ]);
        if (cancelled) return;
        setOverview(ov);
        setRecent(list.slice(0, 6));
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof ApiError ? err.message : "Failed to load dashboard.";
          setError(message);
          toast.push({ title: "Couldn't load dashboard", description: message, tone: "error" });
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
  }, []);

  return (
    <AppShell>
      <motion.div
        initial="hidden"
        animate="show"
        variants={fadeUp}
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <p className="eyebrow">Overview</p>
          <h1 className="mt-2 font-display text-4xl text-charcoal">Dashboard</h1>
          <p className="mt-2 max-w-xl text-sm text-charcoal/60">
            Track analysis volume, confidence trends, and your latest diagnoses.
          </p>
        </div>
        <Link href="/analyze">
          <Button>New analysis</Button>
        </Link>
      </motion.div>

      {!loading && error && <p className="mt-6 text-sm text-danger">{error}</p>}

      {loading ? (
        <div className="mt-12 grid gap-8 border-y border-charcoal/10 py-10 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonStat key={i} />
          ))}
        </div>
      ) : (
        <>
          <motion.div
            className="mt-12 grid gap-8 border-y border-charcoal/10 py-10 sm:grid-cols-2 lg:grid-cols-3"
            initial="hidden"
            animate="show"
            variants={staggerContainer}
          >
            <MetricStat
              label="Total diagnoses"
              value={overview?.total_diagnoses ?? 0}
            />
            <MetricStat
              label="Completed"
              value={overview?.completed_diagnoses ?? 0}
              hint={`${overview?.failed_diagnoses ?? 0} failed`}
            />
            <MetricStat
              label="Avg. confidence"
              value={formatConfidence(overview?.average_confidence)}
            />
            <MetricStat
              label="Healthy detections"
              value={overview?.healthy_detections ?? 0}
            />
            <MetricStat
              label="Diseased detections"
              value={overview?.diseased_detections ?? 0}
            />
          </motion.div>

          <section className="mt-12">
            <h2 className="font-display text-2xl">Explore</h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-3">
              {[
                { href: "/analytics", title: "Analytics", text: "Trends, category mix and CSV export.", roles: undefined },
                { href: "/research", title: "Research", text: "Dataset, model registry and per-class metrics.", roles: ["RESEARCHER", "ADMIN"] },
                { href: "/admin", title: "Admin", text: "Users, roles and the audit log.", roles: ["ADMIN"] },
              ]
                .filter((l) => !l.roles || (user && l.roles.includes(user.role)))
                .map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="block rounded-lg border border-charcoal/10 bg-white p-4 transition-colors hover:border-emerald"
                    >
                      <p className="font-medium text-charcoal">{l.title}</p>
                      <p className="mt-1 text-sm text-charcoal/55">{l.text}</p>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>

          <section className="mt-12">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-2xl">Recent diagnoses</h2>
              <Link href="/history" className="text-sm text-emerald link-underline">
                View history
              </Link>
            </div>

            {recent.length === 0 ? (
              <EmptyState
                title="No diagnoses yet"
                description="Upload a leaf image to run your first visual symptom analysis."
                actionLabel="Analyze an image"
                onAction={() => router.push("/analyze")}
              />
            ) : (
              <motion.ul
                className="mt-6 divide-y divide-charcoal/10"
                initial="hidden"
                animate="show"
                variants={staggerContainer}
              >
                {recent.map((d) => {
                  const top = d.predictions?.[0];
                  return (
                    <motion.li key={d.id} variants={staggerItem}>
                      <Link
                        href={`/diagnosis/${d.id}`}
                        className="flex flex-wrap items-center justify-between gap-3 py-4 transition-colors hover:bg-white/60"
                      >
                        <div>
                          <p className="font-medium text-charcoal">
                            {top?.label || "Pending classification"}
                          </p>
                          <p className="mt-0.5 text-xs text-charcoal/45">
                            {formatDate(d.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-charcoal/55">
                            {formatConfidence(d.overall_confidence ?? top?.probability)}
                          </span>
                          <Badge tone={statusTone(d.status)}>{d.status}</Badge>
                        </div>
                      </Link>
                    </motion.li>
                  );
                })}
              </motion.ul>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
