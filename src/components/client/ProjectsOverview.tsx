import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Grid, List, MoreHorizontal, Play, Pause, Edit, Trash2, Calendar, DollarSign, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface ProjectsOverviewProps {
  projects: ProjectCard[];
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
}

export function ProjectsOverview({ projects, viewMode, onViewModeChange }: ProjectsOverviewProps) {
  const getStatusColor = (status: ProjectCard['status']) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'pending_review':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'active':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: ProjectCard['status']) => {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'pending_review':
        return 'Pending Review';
      case 'active':
        return 'Active';
      case 'completed':
        return 'Completed';
      default:
        return 'Unknown';
    }
  };

  const EmptyState = () => (
    <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
      <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
        <Grid className="w-12 h-12 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">No projects yet</h3>
      <p className="text-muted-foreground mb-6 max-w-sm">
        Get started by creating your first project and begin engaging with expert users.
      </p>
      <Button className="usergy-btn-primary">
        Create Your First Project
      </Button>
    </div>
  );

  if (projects.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-foreground">Your Projects</h2>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onViewModeChange('grid')}
            >
              <Grid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => onViewModeChange('list')}
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div className="grid">
          <EmptyState />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Your Projects</h2>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('grid')}
          >
            <Grid className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => onViewModeChange('list')}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Projects Grid */}
      <div className={cn(
        "grid gap-6 transition-all duration-300",
        viewMode === 'grid' 
          ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" 
          : "grid-cols-1"
      )}>
        {projects.map((project) => (
          <Card 
            key={project.id}
            className="group relative overflow-hidden border border-border/40 bg-card/60 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-lg"
          >
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Badge className={cn("text-xs font-medium", getStatusColor(project.status))}>
                    {getStatusLabel(project.status)}
                  </Badge>
                  <CardTitle className="text-lg font-semibold line-clamp-2">
                    {project.title}
                  </CardTitle>
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Edit className="w-4 h-4 mr-2" />
                      Edit Project
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Play className="w-4 h-4 mr-2" />
                      Launch Project
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Description */}
              <p className="text-sm text-muted-foreground line-clamp-2">
                {project.description}
              </p>

              {/* Progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{project.progress}%</span>
                </div>
                <Progress value={project.progress} className="h-2" />
              </div>

              {/* Project Details */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span>{project.participantsCount} participants</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <span>${project.budget.toLocaleString()}</span>
                </div>
              </div>

              {/* Participant Avatars */}
              {project.participantsCount > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[...Array(Math.min(3, project.participantsCount))].map((_, i) => (
                      <Avatar key={i} className="w-6 h-6 border-2 border-background">
                        <AvatarFallback className="text-xs">U{i + 1}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  {project.participantsCount > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{project.participantsCount - 3} more
                    </span>
                  )}
                </div>
              )}

              {/* Launch Date */}
              {project.launchDate && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>Launch: {project.launchDate.toLocaleDateString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}