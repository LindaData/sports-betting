export type AbilityState = 'ready' | 'armed' | 'used' | 'passive';

export interface AbilityButtonProps {
  name: string;
  state: AbilityState;
  charges: number;
  hint: string;
  disabled?: boolean;
  onClick?: () => void;
}

const LABEL: Record<AbilityState, string> = { ready: 'READY', armed: 'ARMED', used: 'USED', passive: 'READY' };

export function AbilityButton({ name, state, charges, hint, disabled, onClick }: AbilityButtonProps) {
  const clickable = !!onClick && state !== 'used' && !disabled;
  return (
    <button
      type="button"
      className={`ability ability--${state}`}
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      aria-pressed={state === 'armed'}
      title={hint}
    >
      <span className="ability__name">{name}</span>
      <span className="ability__sep">—</span>
      <span className="ability__state">
        {LABEL[state]}
        {state !== 'used' && charges > 1 ? ` ×${charges}` : ''}
      </span>
      <span className="ability__hint">{hint}</span>
    </button>
  );
}
