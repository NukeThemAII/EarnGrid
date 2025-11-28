import { StrategyInfo } from "../lib/vaults";

interface StrategyTableProps {
  strategies: (StrategyInfo & { allocation?: number; supplyRank?: number | null; withdrawRank?: number | null })[];
}

function formatPct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatUsd(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function StrategyTable({ strategies }: StrategyTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/85 shadow-soft backdrop-blur">
      <div className="border-b border-slate-100 px-6 py-4">
        <h3 className="text-lg font-semibold text-ink">Strategy Allocation</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">Strategy</th>
              <th className="px-6 py-3 font-medium">Risk Profile</th>
              <th className="px-6 py-3 font-medium text-right">TVL / Cap</th>
              <th className="px-6 py-3 font-medium text-right">APY</th>
              <th className="px-6 py-3 font-medium text-center">Queue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {strategies.map((s) => (
              <tr key={s.address} className="transition hover:bg-slate-50/50">
                <td className="px-6 py-4 font-medium text-ink">{s.name}</td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.risk === "conservative"
                      ? "bg-emerald-100 text-emerald-800"
                      : s.risk === "moderate"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-rose-100 text-rose-800"
                      }`}
                  >
                    {s.risk}
                  </span>
                </td>
                <td className="px-6 py-4 text-right text-slate-600">
                  <div className="flex flex-col items-end">
                    <span>{formatUsd(s.tvl)}</span>
                    <span className="text-xs text-slate-400">of {formatUsd(s.cap)} cap</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right font-medium text-teal">{(s.apy * 100).toFixed(2)}%</td>
                <td className="px-6 py-4 text-center">
                  <div className="flex flex-col items-center gap-1 text-xs text-slate-500">
                    {s.supplyRank ? (
                      <span className="flex items-center gap-1 text-emerald-600" title="Supply Priority">
                        <span className="font-bold">IN #{s.supplyRank}</span>
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                    {s.withdrawRank ? (
                      <span className="flex items-center gap-1 text-rose-600" title="Withdraw Priority">
                        <span className="font-bold">OUT #{s.withdrawRank}</span>
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
