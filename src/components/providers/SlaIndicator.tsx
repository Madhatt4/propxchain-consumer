interface SlaIndicatorProps {
  slaLoad?: number;
}

interface SlaStatus {
  level: 'green' | 'amber' | 'red';
  label: string;
  dotColor: string;
  textColor: string;
}

function getSlaStatus(slaLoad?: number): SlaStatus {
  if (slaLoad === undefined || slaLoad < 0.7) {
    return {
      level: 'green',
      label: 'Fast turnaround',
      dotColor: 'bg-emerald-500',
      textColor: 'text-emerald-600 dark:text-emerald-400',
    };
  }
  if (slaLoad < 0.9) {
    return {
      level: 'amber',
      label: 'Moderate demand',
      dotColor: 'bg-amber-500',
      textColor: 'text-amber-600 dark:text-amber-400',
    };
  }
  return {
    level: 'red',
    label: 'High demand',
    dotColor: 'bg-red-500',
    textColor: 'text-red-600 dark:text-red-400',
  };
}

export function SlaIndicator({ slaLoad }: SlaIndicatorProps): React.ReactElement {
  const status = getSlaStatus(slaLoad);
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${status.textColor}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${status.dotColor}`} />
      {status.label}
    </span>
  );
}
