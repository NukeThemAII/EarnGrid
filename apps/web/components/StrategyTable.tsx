import { StrategyInfo } from "../lib/vaults";

const riskStyles: Record<StrategyInfo["risk"], string> = {
  conservative: "bg-emerald-50 text-emerald-700 border-emerald-100",
  moderate: "bg-amber-50 text-amber-700 border-amber-100",
  growth: "bg-rose-50 text-rose-700 border-rose-100"
};

function formatPct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatUsd(value: number) {
  return `$${value.toLocaleString()}`;
}

export function StrategyTable({ strategies }: { strategies: StrategyInfo[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-soft backdrop-blur">
      <div className="flex items-center justify-between pb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Strategies</p>
          <p className="text-lg font-semibold text-ink">Allocation map</p>
        </div>
        <span className="text-xs text-slate-500">Capped and ordered per curator policy</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="py-2">Name</th>
              <th className="py-2">Risk</th>
              <th className="py-2">APY</th>
              <th className="py-2">Allocation</th>
              <th className="py-2">Cap</th>
              <th className="py-2">TVL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {strategies.map((strategy) => (
              <tr key={strategy.address} className="align-middle">
                <td className="py-3">
                  <div className="font-medium text-ink">{strategy.name}</div>
                  <div className="text-xs font-mono text-slate-500">{strategy.address}</div>
                </td>
                <td className="py-3">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${riskStyles[strategy.risk]}`}>
                    {strategy.risk}
                  </span>
                </td>
                <td className="py-3 font-semibold text-ink">{(strategy.apy * 100).toFixed(1)}%</td>
                <td className="py-3 text-slate-700">{formatPct(strategy.allocation)}</td>
                <td className="py-3 text-slate-700">{formatUsd(strategy.cap)}</td>
                <td className="py-3 text-slate-700">{formatUsd(strategy.tvl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
