import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NetworkNodes } from '@/components/client/NetworkNodes';
import { DashboardLayout } from '@/components/client/DashboardLayout';
import { ClientHeader } from '@/components/client/ClientHeader';
import { DashboardHero } from '@/components/client/DashboardHero';
import { StatsCards } from '@/components/client/StatsCards';
import { ProjectsOverview } from '@/components/client/ProjectsOverview';
import { QuickActionsFAB } from '@/components/client/QuickActionsFAB';
import { RecentActivity } from '@/components/client/RecentActivity';
import { useClientAuth } from '@/contexts/ClientAuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ClientDashboardData {
  stats: {
    totalProjects: number;
    activeProjects: number;
    usersEngaged: number;
  };
  projects: ProjectCard[];
  activities: Activity[];
  companyName: string;
}

interface ProjectCard {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'pending_review' | 'active' | 'completed';
  progress: number;
  participantsCount: number;
  launchDate?: Date;
  budget: number;
}

interface Activity {
  id: string;
  type: 'project_created' | 'user_joined' | 'submission_received';
  title: string;
  description: string;
  timestamp: Date;
  icon: string;
}

async function fetchDashboardData(): Promise<ClientDashboardData> {
  // Mock data for now - replace with actual Supabase queries
  return {
    stats: {
      totalProjects: 12,
      activeProjects: 4,
      usersEngaged: 247
    },
    projects: [
      {
        id: '1',
        title: 'Mobile Banking App',
        description: 'Testing user experience for new mobile banking features',
        status: 'active',
        progress: 75,
        participantsCount: 45,
        budget: 5000,
        launchDate: new Date('2024-02-15')
      },
      {
        id: '2',
        title: 'E-commerce Checkout',
        description: 'Optimizing checkout flow for better conversion',
        status: 'pending_review',
        progress: 100,
        participantsCount: 32,
        budget: 3000
      },
      {
        id: '3',
        title: 'SaaS Dashboard',
        description: 'User testing for new analytics dashboard',
        status: 'draft',
        progress: 25,
        participantsCount: 0,
        budget: 7500
      }
    ],
    activities: [
      {
        id: '1',
        type: 'project_created',
        title: 'New project created',
        description: 'Mobile Banking App project has been created',
        timestamp: new Date(),
        icon: 'FolderPlus'
      },
      {
        id: '2',
        type: 'user_joined',
        title: 'New participant joined',
        description: 'Sarah Johnson joined E-commerce Checkout project',
        timestamp: new Date(Date.now() - 3600000),
        icon: 'UserPlus'
      }
    ],
    companyName: 'TechCorp Inc.'
  };
}

export default function ClientDashboard() {
  const { user } = useClientAuth();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data, isLoading, error } = useQuery({
    queryKey: ['clientDashboard'],
    queryFn: fetchDashboardData,
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse space-y-8">
          <div className="h-32 bg-muted rounded-lg"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-lg"></div>
            ))}
          </div>
          <div className="h-64 bg-muted rounded-lg"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load dashboard data</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <NetworkNodes />
      
      <div className="relative z-10 space-y-8">
        <ClientHeader />
        
        <DashboardHero 
          companyName={data?.companyName || 'Your Company'}
          activeProjects={data?.stats.activeProjects || 0}
          totalUsersEngaged={data?.stats.usersEngaged || 0}
        />
        
        <StatsCards stats={data?.stats} />
        
        <ProjectsOverview 
          projects={data?.projects || []}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
        
        <RecentActivity activities={data?.activities || []} />
        
        <QuickActionsFAB />
      </div>
    </DashboardLayout>
  );
}