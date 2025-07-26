import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UseryLogo } from '@/components/client/UseryLogo';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronDown, Settings, Users, LogOut, Plus } from 'lucide-react';
import { useClientAuth } from '@/contexts/ClientAuthContext';

export function ClientHeader() {
  const { user, signOut } = useClientAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Logo and Navigation */}
        <div className="flex items-center gap-8">
          <UseryLogo className="h-8 w-auto" />
          
          <nav className="hidden md:flex items-center gap-6">
            <Button 
              variant="default" 
              size="sm" 
              className="usergy-btn-primary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </Button>
            
            <Button variant="ghost" size="sm">
              My Projects
            </Button>
            
            <Button variant="ghost" size="sm">
              Billing
            </Button>
          </nav>
        </div>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-auto px-3">
              <div className="flex items-center gap-3">
                <div className="hidden md:block text-right">
                  <p className="text-sm font-medium">TechCorp Inc.</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
                <Avatar className="h-8 w-8">
                  <AvatarImage src="" alt="Company" />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    TC
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <div className="flex items-center gap-2 p-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src="" alt="Company" />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  TC
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">TechCorp Inc.</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Account Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Users className="mr-2 h-4 w-4" />
              <span>Team Management</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}