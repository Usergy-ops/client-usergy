import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface Node {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  delay: number;
}

export const NetworkNodes: React.FC = () => {
  const [nodes] = useState<Node[]>(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 20 + 10,
      color: i % 3 === 0 ? 'bg-primary-start' : i % 3 === 1 ? 'bg-primary-end' : 'bg-success',
      delay: Math.random() * 6
    }));
  });

  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-start/5 via-transparent to-primary-end/5" />
      
      {/* Floating Nodes */}
      {nodes.map((node) => (
        <div
          key={node.id}
          className={cn(
            "floating-node rounded-full",
            node.color,
            "animate-float"
          )}
          style={{
            left: `${node.x}%`,
            top: `${node.y}%`,
            width: `${node.size}px`,
            height: `${node.size}px`,
            animationDelay: `${node.delay}s`,
            transform: `translate(${(mousePosition.x - 50) * 0.02}px, ${(mousePosition.y - 50) * 0.02}px)`
          }}
        />
      ))}

      {/* Connection Lines */}
      <svg className="absolute inset-0 w-full h-full opacity-20">
        <defs>
          <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="hsl(var(--primary-start))" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        {nodes.slice(0, 4).map((node, i) => {
          const nextNode = nodes[i + 1] || nodes[0];
          return (
            <line
              key={`line-${i}`}
              x1={`${node.x}%`}
              y1={`${node.y}%`}
              x2={`${nextNode.x}%`}
              y2={`${nextNode.y}%`}
              stroke="url(#connectionGradient)"
              strokeWidth="2"
              className="animate-pulse-slow"
            />
          );
        })}
      </svg>

      {/* Floating Tech Icons */}
      <div className="absolute top-1/4 right-1/4 text-primary-start/30 animate-float-delayed">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      </div>
      
      <div className="absolute bottom-1/3 left-1/5 text-primary-end/30 animate-float-slow">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.5 6c-2.61.7-5.67 1-8.5 1s-5.89-.3-8.5-1L3 8c2.61.7 5.67 1 8.5 1s5.89-.3 8.5-1l.5-2z"/>
          <path d="M3 8v8c2.61.7 5.67 1 8.5 1s5.89-.3 8.5-1V8c-2.61.7-5.67 1-8.5 1S5.61 8.7 3 8z"/>
        </svg>
      </div>
      
      <div className="absolute top-1/2 left-1/6 text-success/30 animate-float">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
      </div>
    </div>
  );
};
