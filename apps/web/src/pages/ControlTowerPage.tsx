import React, { useEffect, useState } from 'react';
import {
  ControlTowerSummaryDto,
  AccountabilityMetricsDto,
  AdvancedAnalyticsDto,
  DeliveryHealthDto,
  HealthState,
} from '@workdesk/shared';
import {
  ShieldAlert,
  Activity,
  CheckCircle,
  AlertTriangle,
  Clock,
  TrendingUp,
  BarChart3,
  Layers,
  RefreshCw,
  Info,
} from 'lucide-react';

export const ControlTowerPage: React.FC = () => {
  const [controlTowerData, setControlTowerData] = useState<ControlTowerSummaryDto | null>(null);
  const [metricsData, setMetricsData] = useState<AccountabilityMetricsDto | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AdvancedAnalyticsDto | null>(null);
  const [selectedHealth, setSelectedHealth] = useState<DeliveryHealthDto | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ctRes, metRes, anaRes] = await Promise.all([
        fetch('/api/v1/delivery-health/control-tower', { credentials: 'include' }),
        fetch('/api/v1/accountability/metrics?windowDays=30', { credentials: 'include' }),
        fetch('/api/v1/analytics/advanced?windowDays=30', { credentials: 'include' }),
      ]);

      if (ctRes.ok) setControlTowerData(await ctRes.json());
      if (metRes.ok) setMetricsData(await metRes.json());
      if (anaRes.ok) setAnalyticsData(await anaRes.json());
    } catch (err) {
      console.error('Failed to fetch control tower data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getHealthBadge = (state: HealthState) => {
    switch (state) {
      case 'HEALTHY':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            HEALTHY
          </span>
        );
      case 'AT_RISK':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            AT RISK
          </span>
        );
      case 'CRITICAL':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            CRITICAL
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-400" />
            <span>Management Control Tower</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Authoritative delivery health, accountability metrics, and real-time operational risk surveillance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {loading && (
            <span className="text-xs text-indigo-400 font-mono animate-pulse">Refreshing telemetry...</span>
          )}
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Portfolio Health Summary Cards */}
      {controlTowerData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Active Projects</span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-3xl font-extrabold text-white mt-2">
              {controlTowerData.projectHealth.totalProjects}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span className="text-emerald-400 font-semibold">{controlTowerData.projectHealth.healthy} Healthy</span>
              <span>•</span>
              <span className="text-amber-400 font-semibold">{controlTowerData.projectHealth.atRisk} At Risk</span>
              <span>•</span>
              <span className="text-rose-400 font-semibold">{controlTowerData.projectHealth.critical} Critical</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Active Blockers</span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-3xl font-extrabold text-white mt-2">
              {controlTowerData.blockers.activeCount}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              <span className="text-rose-400 font-semibold">{controlTowerData.blockers.stagnantCount} Stagnant (&gt; 48h)</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Workload At-Risk</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-extrabold text-white mt-2">
              {controlTowerData.workload.overAllocatedUsersCount + controlTowerData.workload.criticalUsersCount}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              <span>{controlTowerData.workload.criticalUsersCount} capacity critical (&gt; 125%)</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span>Due-Date Adherence</span>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-extrabold text-white mt-2">
              {metricsData ? `${Math.round(metricsData.dueDateAdherence.adherenceRate * 100)}%` : '100%'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              <span>{metricsData?.dueDateAdherence.onTimeCount} on-time of {metricsData?.dueDateAdherence.completedWithDeadline}</span>
            </div>
          </div>
        </div>
      )}

      {/* Project Health Status Grid */}
      {controlTowerData && controlTowerData.projectHealth.items.length > 0 && (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <span>Project Delivery Health Engine</span>
            </h2>
            <span className="text-xs text-slate-400">Deterministic signal evaluations</span>
          </div>

          <div className="divide-y divide-slate-800">
            {controlTowerData.projectHealth.items.map((proj) => (
              <div key={proj.scopeId} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-base">{proj.scopeName}</span>
                    {getHealthBadge(proj.overallState)}
                  </div>
                  <p className="text-xs text-slate-400">{proj.summary}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedHealth(proj)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-colors"
                  >
                    <Info className="w-3.5 h-3.5 text-indigo-400" />
                    <span>View Evidence</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accountability Metrics Section */}
      {metricsData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sprint Say/Do & Scope Creep */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <span>Sprint Say/Do Ratio & Scope Creep</span>
            </h3>

            {metricsData.sprintSayDo.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">No completed sprints recorded in window.</p>
            ) : (
              <div className="space-y-4 pt-2">
                {metricsData.sprintSayDo.map((s, idx) => {
                  const creep = metricsData.scopeCreep[idx];
                  return (
                    <div key={s.sprintId} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">{s.sprintName}</span>
                        <span className="font-mono text-indigo-400 font-bold">
                          Say/Do: {Math.round(s.sayDoRatio * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-indigo-500 h-full rounded-full"
                          style={{ width: `${Math.min(100, Math.round(s.sayDoRatio * 100))}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                        <span>Planned: {s.plannedPoints} pts | Completed: {s.completedPlannedPoints} pts</span>
                        {creep && (
                          <span className={creep.scopeCreepRate > 0.2 ? 'text-amber-400' : 'text-slate-400'}>
                            Scope Creep: +{creep.midSprintAddedPoints} pts ({Math.round(creep.scopeCreepRate * 100)}%)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Blocker Aging & Rework */}
          <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span>Blocker Aging & Review Rework</span>
            </h3>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-xs font-bold text-slate-400">Avg Blocker Resolution</div>
                <div className="text-2xl font-black text-white mt-1">
                  {metricsData.blockerAging.avgResolutionHours} hrs
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Longest active: {metricsData.blockerAging.longestActiveHours} hrs
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <div className="text-xs font-bold text-slate-400">Review Rework Rate</div>
                <div className="text-2xl font-black text-white mt-1">
                  {Math.round(metricsData.reworkRate.reworkRate * 100)}%
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {metricsData.reworkRate.reworkedTasksCount} tasks reopened / changes requested
                </div>
              </div>
            </div>

            {/* Active Blockers List */}
            {metricsData.blockerAging.activeBlockers.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Active Impediment Ledger
                </div>
                <div className="divide-y divide-slate-800">
                  {metricsData.blockerAging.activeBlockers.slice(0, 3).map((b) => (
                    <div key={b.taskId} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono font-bold text-rose-400 mr-2">{b.ticketId}</span>
                        <span className="text-slate-200">{b.title}</span>
                      </div>
                      <span className="font-mono text-slate-400">{b.hoursBlocked} hrs</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Advanced Analytics: Lead & Cycle Time Percentiles */}
      {analyticsData && (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <span>Delivery Performance & Lead Time Percentiles</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                Lead Time (Creation → Completion)
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                <div>
                  <div className="text-xl font-bold text-white">{analyticsData.leadTimeDays.avg}d</div>
                  <div className="text-xs text-slate-500">Average</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-white">{analyticsData.leadTimeDays.median}d</div>
                  <div className="text-xs text-slate-500">Median (50th)</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-amber-400">{analyticsData.leadTimeDays.p85}d</div>
                  <div className="text-xs text-slate-500">85th Percentile</div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                Cycle Time (In Progress → Completion)
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                <div>
                  <div className="text-xl font-bold text-white">{analyticsData.cycleTimeDays.avg}d</div>
                  <div className="text-xs text-slate-500">Average</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-white">{analyticsData.cycleTimeDays.median}d</div>
                  <div className="text-xs text-slate-500">Median (50th)</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-amber-400">{analyticsData.cycleTimeDays.p85}d</div>
                  <div className="text-xs text-slate-500">85th Percentile</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Operational Risks */}
      {controlTowerData && controlTowerData.risks.length > 0 && (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <span>Top Operational Risks & Automated Interventions</span>
          </h3>

          <div className="divide-y divide-slate-800">
            {controlTowerData.risks.map((risk, i) => (
              <div key={i} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-400">{risk.ticketId}</span>
                    <span className="font-semibold text-white">{risk.title}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        risk.severity === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                      }`}
                    >
                      {risk.severity}
                    </span>
                  </div>
                  <p className="text-slate-400">{risk.issue}</p>
                </div>

                <div className="text-slate-300 font-medium bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/50 shrink-0">
                  <span className="text-indigo-400 font-bold mr-1">Action:</span>
                  {risk.operationalAction}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Health Evidence Modal */}
      {selectedHealth && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedHealth.scopeName} — Health Signals</h3>
                <p className="text-xs text-slate-400 mt-0.5">Detailed signal breakdown with explainable thresholds</p>
              </div>
              {getHealthBadge(selectedHealth.overallState)}
            </div>

            <div className="space-y-4">
              {selectedHealth.signals.map((sig, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{sig.signalName}</span>
                    {getHealthBadge(sig.healthState)}
                  </div>
                  <p className="text-slate-300"><span className="text-slate-500 font-medium">Evidence:</span> {sig.observedEvidence}</p>
                  <p className="text-slate-400"><span className="text-slate-500 font-medium">Rule & Threshold:</span> {sig.rule} ({sig.threshold})</p>
                  <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                    <span className="font-bold">Operational Action:</span> {sig.operationalAction}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setSelectedHealth(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors"
              >
                Close Evidence
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
