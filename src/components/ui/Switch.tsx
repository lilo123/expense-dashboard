'use client';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
  id?: string;
}

export default function Switch({ checked, onChange, ariaLabel = 'Toggle switch', id }: SwitchProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      style={{ minHeight: 0 }} // Explicit reset to bypass global button height styles
      className={`w-12 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 outline-none cursor-pointer border-none shrink-0 min-h-0 ${
        checked ? 'bg-zen-sage' : 'bg-zen-lavender/40'
      }`}
    >
      <div
        className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ease-in-out ${
          checked ? 'translate-x-6' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
