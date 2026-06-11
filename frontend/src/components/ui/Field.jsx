export function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink/50">{hint}</p>}
    </div>
  );
}

const base =
  'w-full rounded-md border border-ink/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white';

export function Input(props) {
  return <input {...props} className={base} />;
}

export function Select({ children, ...props }) {
  return (
    <select {...props} className={base}>
      {children}
    </select>
  );
}

export function Textarea(props) {
  return <textarea rows={3} {...props} className={base} />;
}
