import React from 'react';
import {
  FileCode,
  FolderTree,
  LayoutList,
  MessageSquare,
} from 'lucide-react';
import { ActiveTab } from '@/types';

interface MobileNavigationProps {
  activeTab: ActiveTab;
  onTabSelect: (tab: ActiveTab) => void;
  diffsCount?: number;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  activeTab,
  onTabSelect,
  diffsCount = 0,
}) => {
  return (
    <nav className="h-14 border-t border-border bg-surface flex items-center justify-around px-2 md:hidden z-30 shrink-0">
      <button
        type="button"
        onClick={() => onTabSelect('chat')}
        className={`min-w-[48px] min-h-[48px] flex-1 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
          activeTab === 'chat' ? 'text-primary font-semibold' : 'text-muted hover:text-main'
        }`}
      >
        <MessageSquare className="w-5 h-5" />
        <span className="text-[10px]">Czat</span>
      </button>

      <button
        type="button"
        onClick={() => onTabSelect('diffs')}
        className={`min-w-[48px] min-h-[48px] flex-1 flex flex-col items-center justify-center gap-1 relative transition-colors cursor-pointer ${
          activeTab === 'diffs' ? 'text-primary font-semibold' : 'text-muted hover:text-main'
        }`}
      >
        <div className="relative">
          <FileCode className="w-5 h-5" />
          {diffsCount > 0 && (
            <span className="absolute -top-1 -right-2.5 w-4 h-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">
              {diffsCount}
            </span>
          )}
        </div>
        <span className="text-[10px]">Zmiany</span>
      </button>

      <button
        type="button"
        onClick={() => onTabSelect('files')}
        className={`min-w-[48px] min-h-[48px] flex-1 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
          activeTab === 'files' ? 'text-primary font-semibold' : 'text-muted hover:text-main'
        }`}
      >
        <FolderTree className="w-5 h-5" />
        <span className="text-[10px]">Pliki</span>
      </button>

      <button
        type="button"
        onClick={() => onTabSelect('sessions')}
        className={`min-w-[48px] min-h-[48px] flex-1 flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
          activeTab === 'sessions' ? 'text-primary font-semibold' : 'text-muted hover:text-main'
        }`}
      >
        <LayoutList className="w-5 h-5" />
        <span className="text-[10px]">Zadania</span>
      </button>
    </nav>
  );
};
