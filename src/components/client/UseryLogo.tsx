export function UseryLogo({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative">
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-lg"
        >
          {/* Outer Circle with Gradient */}
          <circle
            cx="16"
            cy="16"
            r="15"
            fill="url(#logoGradient)"
            className="opacity-90"
          />
          
          {/* Connection Nodes */}
          <circle cx="16" cy="8" r="2" fill="white" className="opacity-80" />
          <circle cx="24" cy="16" r="2" fill="white" className="opacity-80" />
          <circle cx="16" cy="24" r="2" fill="white" className="opacity-80" />
          <circle cx="8" cy="16" r="2" fill="white" className="opacity-80" />
          
          {/* Center Node */}
          <circle cx="16" cy="16" r="3" fill="white" />
          
          {/* Connection Lines */}
          <line x1="16" y1="8" x2="16" y2="13" stroke="white" strokeWidth="1.5" className="opacity-60" />
          <line x1="24" y1="16" x2="19" y2="16" stroke="white" strokeWidth="1.5" className="opacity-60" />
          <line x1="16" y1="24" x2="16" y2="19" stroke="white" strokeWidth="1.5" className="opacity-60" />
          <line x1="8" y1="16" x2="13" y2="16" stroke="white" strokeWidth="1.5" className="opacity-60" />
          
          <defs>
            <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(198, 100%, 49%)" />
              <stop offset="100%" stopColor="hsl(220, 100%, 46%)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <span className="gradient-text text-2xl font-bold tracking-tight">
        Usergy
      </span>
    </div>
  );
}