"use client";

import { AppLayout } from "@/app/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState } from "react";

export default function AccountPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("profile");

  // Get user initials for avatar fallback
  const getUserInitials = () => {
    if (!user?.email) return "U";
    return user.email.charAt(0).toUpperCase();
  };

  // Get display name (email or name if available)
  const getDisplayName = () => {
    if (user?.user_metadata?.full_name) return user.user_metadata.full_name;
    if (user?.email) {
      const emailName = user.email.split('@')[0];
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    return "User";
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Account</h1>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full md:w-auto grid-cols-2 md:inline-flex">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>
          
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  Update your account details and preferences.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={user?.user_metadata?.avatar_url || ""} />
                    <AvatarFallback className="text-lg">{getUserInitials()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-medium">{getDisplayName()}</h3>
                    {user?.user_metadata?.full_name && user?.email && (
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    )}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">Email</h3>
                  <p className="text-sm text-muted-foreground">{user?.email || "No email available"}</p>
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">Account Type</h3>
                  <p className="text-sm text-muted-foreground">
                    {user?.app_metadata?.provider === "google" 
                      ? "Google Account" 
                      : "Email & Password"}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">Account Created</h3>
                  <p className="text-sm text-muted-foreground">
                    {user?.created_at 
                      ? new Date(user.created_at).toLocaleDateString() 
                      : "Unknown"}
                  </p>
                </div>
                
                <Button variant="outline">Edit Profile</Button>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="billing">
            <Card>
              <CardHeader>
                <CardTitle>Billing Information</CardTitle>
                <CardDescription>
                  Manage your subscription and payment methods.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">Current Plan</h3>
                  <p className="text-sm text-muted-foreground">Free Trial</p>
                </div>
                
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">Trial Period</h3>
                  <p className="text-sm text-muted-foreground">Expires in 14 days</p>
                </div>
                
                <Link href="/account/pay">
                  <Button>Upgrade Plan</Button>
                </Link>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
