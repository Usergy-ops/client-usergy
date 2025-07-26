import { useEffect, useState } from 'react';
import CountUp from 'react-countup';
import { Card, CardContent } from '@/components/ui/card';
import { FolderKanban, Activity, Users, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardData {
  title: string;
  value: number;
  change?: number;
  icon: React.ComponentType<{ className?: string }>;
  gradient: 'primary' | 'success' | 'accent';
}

interface StatsCardsProps {
  stats?: {
    totalProjects: number;
    activeProjects: number;
    usersEngaged: number;
  };
}

export function StatsCards({ stats }: StatsCardsProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const statsData: StatsCardData[] = [
    {
      title: 'Total Projects',
      value: stats?.totalProjects || 0,
      change: 12,
      icon: FolderKanban,
      gradient: 'primary'
    },
    {
      title: 'Active Projects', 
      value: stats?.activeProjects || 0,
      change: 8,
      icon: Activity,
      gradient: 'success'
    },
    {
      title: 'Users Engaged',
      value: stats?.usersEngaged || 0,
      change: -3,
      icon: Users,
      gradient: 'accent'
    }
  ];

  const getGradientClasses = (gradient: string) => {
    switch (gradient) {
      case 'primary':
        return 'from-primary-start to-primary-end';
      case 'success':
        return 'from-emerald-400 to-emerald-600';
      case 'accent':
        return 'from-purple-400 to-purple-600';
      default:
        return 'from-primary-start to-primary-end';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {statsData.map((stat, index) => (
        <Card
          key={stat.title}
          className={cn(
            "relative overflow-hidden border border-border/40 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg",
            isVisible ? "animate-fade-in" : "opacity-0"
          )}
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <CardContent className="p-6">
            {/* Icon with gradient background */}
            <div className={cn(
              "inline-flex p-3 rounded-xl bg-gradient-to-br mb-4",
              getGradientClasses(stat.gradient)
            )}>
              <stat.icon className="w-6 h-6 text-white" />
            </div>

            {/* Stats Content */}
            <div className="space-y-2">
              {/* Value with CountUp animation */}
              <div className="text-3xl font-bold text-foreground">
                {isVisible ? (
                  <CountUp
                    end={stat.value}
                    duration={2}
                    separator=","
                  />
                ) : (
                  0
                )}
              </div>

              {/* Title and Change */}
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </p>
                
                {stat.change && (
                  <div className={cn(
                    "flex items-center gap-1 text-xs font-medium",
                    stat.change > 0 
                      ? "text-emerald-600" 
                      : "text-red-600"
                  )}>
                    {stat.change > 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {Math.abs(stat.change)}%
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}