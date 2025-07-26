import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FolderPlus, UserPlus, FileCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Activity {
  id: string;
  type: 'project_created' | 'user_joined' | 'submission_received';
  title: string;
  description: string;
  timestamp: Date;
  icon: string;
}

interface RecentActivityProps {
  activities: Activity[];
}

export function RecentActivity({ activities }: RecentActivityProps) {
  const getActivityIcon = (type: Activity['type']) => {
    switch (type) {
      case 'project_created':
        return FolderPlus;
      case 'user_joined':
        return UserPlus;
      case 'submission_received':
        return FileCheck;
      default:
        return Clock;
    }
  };

  const getActivityColor = (type: Activity['type']) => {
    switch (type) {
      case 'project_created':
        return 'bg-blue-100 text-blue-600 border-blue-200';
      case 'user_joined':
        return 'bg-emerald-100 text-emerald-600 border-emerald-200';
      case 'submission_received':
        return 'bg-purple-100 text-purple-600 border-purple-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
      return `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    }
  };

  if (activities.length === 0) {
    return (
      <Card className="border border-border/40 bg-card/60 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No recent activity</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/40 bg-card/60 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {activities.map((activity, index) => {
            const IconComponent = getActivityIcon(activity.type);
            const isLast = index === activities.length - 1;

            return (
              <div key={activity.id} className="relative flex items-start gap-4">
                {/* Timeline Line */}
                {!isLast && (
                  <div className="absolute left-6 top-12 w-px h-6 bg-border/40" />
                )}

                {/* Activity Icon */}
                <div className={cn(
                  "flex-shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center",
                  getActivityColor(activity.type)
                )}>
                  <IconComponent className="w-5 h-5" />
                </div>

                {/* Activity Content */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-foreground">
                      {activity.title}
                    </h4>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {activity.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* View All Link */}
        {activities.length > 0 && (
          <div className="mt-6 pt-4 border-t border-border/40">
            <button className="text-sm text-primary hover:underline font-medium">
              View all activity
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}