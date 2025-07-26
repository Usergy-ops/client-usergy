import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, FolderPlus, Copy, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  angle: number;
}

const quickActions: QuickAction[] = [
  { id: 'new', label: 'Create New Project', icon: FolderPlus, angle: 0 },
  { id: 'duplicate', label: 'Duplicate Existing', icon: Copy, angle: 60 },
  { id: 'template', label: 'Import Template', icon: FileText, angle: 120 }
];

export function QuickActionsFAB() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);

  const handleActionClick = (actionId: string) => {
    console.log(`Action clicked: ${actionId}`);
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Action Buttons */}
      <div className="relative">
        {quickActions.map((action, index) => {
          const radius = 80;
          const angleInRad = (action.angle * Math.PI) / 180;
          const x = Math.cos(angleInRad) * radius;
          const y = Math.sin(angleInRad) * radius;

          return (
            <Button
              key={action.id}
              size="icon"
              className={cn(
                "absolute transition-all duration-300 ease-spring bg-background/90 backdrop-blur-sm border border-border/40 hover:bg-accent hover:scale-110 shadow-lg",
                isOpen 
                  ? "opacity-100 pointer-events-auto" 
                  : "opacity-0 pointer-events-none scale-50"
              )}
              style={{
                transform: isOpen 
                  ? `translate(${-x}px, ${-y}px)` 
                  : 'translate(0, 0)',
                transitionDelay: isOpen ? `${index * 50}ms` : '0ms'
              }}
              onClick={() => handleActionClick(action.id)}
              title={action.label}
            >
              <action.icon className="w-5 h-5" />
            </Button>
          );
        })}

        {/* Main FAB */}
        <Button
          size="icon"
          className={cn(
            "w-14 h-14 rounded-full usergy-btn-primary shadow-lg transition-all duration-300",
            isOpen && "rotate-45"
          )}
          onClick={toggleMenu}
        >
          {isOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Plus className="w-6 h-6" />
          )}
        </Button>
      </div>
    </div>
  );
}