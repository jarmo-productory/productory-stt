"use client";

import React, { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { SidebarNav } from "./SidebarNav";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Close sidebar by default on mobile
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    } else {
      setIsSidebarOpen(true);
    }
  }, [isMobile]);

  // Render a Sheet on mobile, and a Sidebar on desktop
  return (
    <div className="flex h-screen bg-background">
      {isMobile ? (
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="fixed left-4 top-4 z-50 md:hidden"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[280px]">
            <SidebarNav />
          </SheetContent>
        </Sheet>
      ) : (
        <div className={`border-r bg-card transition-all duration-300 ${
          isSidebarOpen ? "w-[280px]" : "w-0 overflow-hidden"
        }`}>
          <SidebarNav />
        </div>
      )}
      
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mx-auto max-w-7xl h-full flex flex-col">
          {children}
        </div>
      </main>

      {/* Toggle sidebar button - desktop only */}
      {!isMobile && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="fixed left-4 bottom-4 z-50 hidden md:flex"
        >
          <Menu className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
