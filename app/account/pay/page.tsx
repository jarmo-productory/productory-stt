import { AppLayout } from "@/app/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function PaymentPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center">
          <Link href="/account">
            <Button variant="ghost" size="icon" className="mr-2">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Subscription Plans</h1>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Free Trial</CardTitle>
              <CardDescription>
                Great for getting started with basic features.
              </CardDescription>
              <div className="mt-4 text-4xl font-bold">$0</div>
              <p className="text-sm text-muted-foreground">per month</p>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-2">
                <li className="flex items-center">
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  <span className="text-sm">5 audio files</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  <span className="text-sm">Basic transcription</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  <span className="text-sm">60-day storage</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant="outline">Current Plan</Button>
            </CardFooter>
          </Card>
          
          <Card className="flex flex-col border-blue-200 bg-blue-50/50 dark:bg-blue-900/20 dark:border-blue-900">
            <CardHeader>
              <CardTitle>Pro</CardTitle>
              <CardDescription>
                Perfect for individuals with moderate usage.
              </CardDescription>
              <div className="mt-4 text-4xl font-bold">$9.99</div>
              <p className="text-sm text-muted-foreground">per month</p>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-2">
                <li className="flex items-center">
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  <span className="text-sm">50 audio files</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  <span className="text-sm">Advanced transcription</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  <span className="text-sm">1-year storage</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  <span className="text-sm">Speaker diarization</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button className="w-full">Subscribe Now</Button>
            </CardFooter>
          </Card>
          
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Enterprise</CardTitle>
              <CardDescription>
                For businesses with high volume needs.
              </CardDescription>
              <div className="mt-4 text-4xl font-bold">$29.99</div>
              <p className="text-sm text-muted-foreground">per month</p>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-2">
                <li className="flex items-center">
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  <span className="text-sm">Unlimited audio files</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  <span className="text-sm">Premium transcription</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  <span className="text-sm">Unlimited storage</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  <span className="text-sm">Priority support</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  <span className="text-sm">API access</span>
                </li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant="outline">Subscribe Now</Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
