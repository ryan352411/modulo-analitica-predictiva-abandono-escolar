import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const riskColor = {
  bajo: 'text-risk-low bg-risk-low/10',
  medio: 'text-risk-mid bg-risk-mid/10',
  alto: 'text-risk-high bg-risk-high/10',
};

export const riskLabel = { bajo: 'Bajo', medio: 'Medio', alto: 'Alto' };
