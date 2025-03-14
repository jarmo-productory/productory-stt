'use client';

import { useState, useEffect } from 'react';
import { FileObject } from "@/contexts/FileContext";
import { 
  Loader2,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AISummaryTabProps {
  file: FileObject | null;
}

interface AISummary {
  id: string;
  file_id: string;
  summary_text: string;
  model_used: string;
  created_at: string;
}

export function AISummaryTab({ file }: AISummaryTabProps) {
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  
  // Fetch AI summary when file changes
  useEffect(() => {
    if (file) {
      fetchSummary(file.id);
    } else {
      setSummary(null);
      setIsLoading(false);
    }
  }, [file]);
  
  // Fetch summary from API
  const fetchSummary = async (fileId: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/files/${fileId}/summary`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          // No summary exists yet, not an error
          setSummary(null);
          setIsLoading(false);
          return;
        }
        throw new Error(`Failed to fetch summary: ${response.status}`);
      }
      
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error('Error fetching summary:', error);
      setError('Failed to load AI summary.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Generate AI summary
  const generateSummary = async () => {
    if (!file) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      // First check if there's a completed transcription
      const transcriptionResponse = await fetch(`/api/files/${file.id}/transcription`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!transcriptionResponse.ok) {
        throw new Error('No transcription available. Please transcribe the file first.');
      }
      
      const transcriptionData = await transcriptionResponse.json();
      
      if (transcriptionData.status !== 'completed') {
        throw new Error('Transcription is not complete. Please wait for transcription to finish.');
      }
      
      // Request summary generation
      const response = await fetch(`/api/files/${file.id}/summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          transcriptionId: transcriptionData.id,
          options: {
            maxLength: 500
          }
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to generate summary: ${response.status}`);
      }
      
      await response.json();
      toast.success('AI summary generation started');
      
      // Poll for summary completion
      const checkInterval = setInterval(async () => {
        const checkResponse = await fetch(`/api/files/${file.id}/summary`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });
        
        if (checkResponse.ok) {
          const summaryData = await checkResponse.json();
          setSummary(summaryData);
          clearInterval(checkInterval);
          setIsGenerating(false);
          toast.success('AI summary generated successfully');
        }
      }, 5000);
      
      // Stop polling after 2 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        if (isGenerating) {
          setIsGenerating(false);
          toast.info('Summary generation is taking longer than expected. Check back later.');
        }
      }, 120000);
      
    } catch (error: any) {
      console.error('Error generating summary:', error);
      setError(error.message || 'Failed to generate AI summary.');
      toast.error(error.message || 'Failed to generate AI summary.');
      setIsGenerating(false);
    }
  };
  
  if (!file) {
    return <div className="p-4">No file selected</div>;
  }
  
  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <Sparkles className="h-5 w-5 mr-2 text-primary" />
          <h2 className="text-lg font-medium">AI Summary</h2>
        </div>
        {!summary && !isLoading && !isGenerating && (
          <Button 
            size="sm" 
            onClick={generateSummary}
          >
            <Sparkles className="h-3 w-3 mr-2" />
            Generate Summary
          </Button>
        )}
      </div>
      
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {isLoading || isGenerating ? (
        <div className="min-h-[150px] flex flex-col items-center justify-center bg-muted/30 rounded-md p-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            {isGenerating ? 'Generating AI summary...' : 'Loading...'}
          </p>
        </div>
      ) : summary ? (
        <div className="p-4 bg-muted/20 rounded-md">
          <p className="whitespace-pre-wrap">{summary.summary_text}</p>
          <div className="mt-4 text-xs text-muted-foreground">
            Generated on {new Date(summary.created_at).toLocaleDateString()} using {summary.model_used || 'AI'}
          </div>
        </div>
      ) : (
        <div className="p-4 bg-muted/30 rounded-md">
          <p className="text-muted-foreground text-sm italic">
            AI-generated summary will appear here once generated. Make sure the file is transcribed first.
          </p>
        </div>
      )}
    </div>
  );
} 