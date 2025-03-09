'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

export type JobStatusProps = {
  jobId: string;
  onComplete?: (result: any) => void;
  className?: string;
  showRefresh?: boolean;
  pollingInterval?: number;
  autoRefresh?: boolean;
};

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';

type Job = {
  id: string;
  job_type: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  attempts: number;
  max_attempts: number;
  result?: any;
  error_message?: string;
};

export function JobStatus({
  jobId,
  onComplete,
  className,
  showRefresh = true,
  pollingInterval = 5000,
  autoRefresh = true,
}: JobStatusProps) {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  const fetchJobStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/jobs/${jobId}?logs=true`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch job status: ${response.statusText}`);
      }
      
      const data = await response.json();
      setJob(data.job);
      setLogs(data.logs || []);
      
      // If job is completed, call onComplete callback
      if (data.job.status === 'completed' && onComplete) {
        onComplete(data.job.result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching job status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch job status initially
    fetchJobStatus();
    
    // Set up polling if autoRefresh is enabled
    let intervalId: NodeJS.Timeout | null = null;
    
    if (autoRefresh) {
      intervalId = setInterval(() => {
        // Only continue polling if job is not in a final state
        if (job && ['completed', 'failed'].includes(job.status)) {
          if (intervalId) clearInterval(intervalId);
          return;
        }
        
        fetchJobStatus();
      }, pollingInterval);
    }
    
    // Clean up interval on unmount
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [jobId, autoRefresh, pollingInterval, job?.status]);

  const getStatusIcon = (status: JobStatus) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'retrying':
        return <RefreshCw className="h-5 w-5 text-orange-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: JobStatus) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'processing':
        return 'Processing';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      case 'retrying':
        return 'Retrying';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status: JobStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'retrying':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading && !job) {
    return (
      <div className={cn("flex items-center justify-center p-4", className)}>
        <Loader2 className="h-6 w-6 text-blue-500 animate-spin mr-2" />
        <span>Loading job status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("p-4 border border-red-200 rounded-md bg-red-50 text-red-700", className)}>
        <div className="flex items-center mb-2">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span className="font-medium">Error loading job status</span>
        </div>
        <p className="text-sm">{error}</p>
        {showRefresh && (
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2" 
            onClick={fetchJobStatus}
          >
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (!job) {
    return (
      <div className={cn("p-4 border border-gray-200 rounded-md bg-gray-50", className)}>
        <span>No job information available</span>
      </div>
    );
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">
            {job.job_type === 'transcription' ? 'Transcription Job' : 'Job'} Status
          </CardTitle>
          <Badge className={getStatusColor(job.status)}>
            {getStatusIcon(job.status)}
            <span className="ml-1">{getStatusText(job.status)}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-1">
            <span className="text-gray-500">Job ID:</span>
            <span className="font-mono text-xs truncate">{job.id}</span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <span className="text-gray-500">Created:</span>
            <span>{formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}</span>
          </div>
          {job.started_at && (
            <div className="grid grid-cols-2 gap-1">
              <span className="text-gray-500">Started:</span>
              <span>{formatDistanceToNow(new Date(job.started_at), { addSuffix: true })}</span>
            </div>
          )}
          {job.completed_at && (
            <div className="grid grid-cols-2 gap-1">
              <span className="text-gray-500">Completed:</span>
              <span>{formatDistanceToNow(new Date(job.completed_at), { addSuffix: true })}</span>
            </div>
          )}
          {job.attempts > 0 && (
            <div className="grid grid-cols-2 gap-1">
              <span className="text-gray-500">Attempts:</span>
              <span>{job.attempts} / {job.max_attempts}</span>
            </div>
          )}
        </div>

        {job.error_message && (
          <div className="mt-4 p-2 border border-red-200 rounded-md bg-red-50 text-red-700 text-sm">
            <p className="font-medium">Error:</p>
            <p className="whitespace-pre-wrap">{job.error_message}</p>
          </div>
        )}

        {logs.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium mb-1">Job Logs:</p>
            <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-md bg-gray-50 p-2 text-xs font-mono">
              {logs.map((log, index) => (
                <div key={index} className={cn(
                  "py-1 border-b border-gray-100 last:border-0",
                  log.level === 'error' ? 'text-red-600' : 
                  log.level === 'warning' ? 'text-orange-600' : 'text-gray-700'
                )}>
                  <span className="text-gray-400">[{new Date(log.created_at).toLocaleTimeString()}]</span>{' '}
                  <span className="uppercase text-xs font-bold">{log.level}:</span>{' '}
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      {showRefresh && (
        <CardFooter className="pt-0">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full" 
            onClick={fetchJobStatus}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Status
              </>
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
} 