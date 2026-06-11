import { cn, riskColor, riskLabel } from '../../lib/utils.js';

export default function RiskBadge({ level }) {
  if (!level) return null;
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', riskColor[level])}>
      Riesgo {riskLabel[level]}
    </span>
  );
}
