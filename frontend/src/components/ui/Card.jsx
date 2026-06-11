import { cn } from '../../lib/utils.js';

export function Card({ className, children }) {
  return (
    <div className={cn('rounded-lg border border-ink/10 bg-white shadow-sm', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between px-5 pt-5">
      <div>
        <h3 className="font-semibold">{title}</h3>
        {subtitle && <p className="text-sm text-ink/60">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}
