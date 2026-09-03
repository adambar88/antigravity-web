import React from 'react';
import { ArrowDown } from 'lucide-react';

interface ScrollAnchorBadgeProps {
  show: boolean;
  onClick: () => void;
}

export const ScrollAnchorBadge: React.FC<ScrollAnchorBadgeProps> = ({ show, onClick }) => {
  if (!show) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 transition-all duration-200 animate-bounce">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface border border-border shadow-lg text-xs font-medium text-main hover:bg-surface-hover hover:border-primary transition-all duration-150 cursor-pointer"
      >
        <span>Przewiń na dół</span>
        <ArrowDown className="w-3.5 h-3.5 text-primary" />
      </button>
    </div>
  );
};
