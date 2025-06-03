
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, AlertCircle, CheckCircle, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface UploadDataEnhancedProps {
  onDataUploaded: (data: any) => void;
}

export const UploadDataEnhanced = ({ onDataUploaded }: UploadDataEnhancedProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const { toast } = useToast();
  const { session } = useAuth();

  const handleFile = async (file: File) => {
    console.log('Starting file upload:', file.name, file.size);
    
    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 100MB",
        variant: "destructive"
      });
      return;
    }

    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    setUploadSuccess(false);
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      console.log('Calling process-dataset function...');
      const { data, error } = await supabase.functions.invoke('process-dataset', {
        body: formData,
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      console.log('Function response:', { data, error });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (!data) {
        throw new Error('No data returned from processing function');
      }

      console.log('Processing successful, calling onDataUploaded...');
      setUploadSuccess(true);
      onDataUploaded(data);
      
      toast({
        title: "Upload successful",
        description: `Processed ${data.preview?.totalRows || 'unknown'} rows and ${data.preview?.totalColumns || 'unknown'} columns. AI vectorization started for enhanced analysis.`,
        duration: 5000
      });

      // Reset success state after a delay
      setTimeout(() => setUploadSuccess(false), 3000);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to process the CSV file",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  return (
    <div className="p-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="w-5 h-5" />
              <span>Upload Financial Data</span>
            </CardTitle>
            <CardDescription>
              Upload your CSV file to get started with AI-powered financial analytics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? "border-blue-500 bg-blue-50" 
                  : uploadSuccess
                  ? "border-green-500 bg-green-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {uploading ? (
                <div className="space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600">Processing your financial data...</p>
                  <p className="text-sm text-gray-500">Analyzing patterns and preparing AI vectorization</p>
                </div>
              ) : uploadSuccess ? (
                <div className="space-y-4">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                  <div>
                    <p className="text-lg font-medium text-green-700 mb-2">
                      Upload successful!
                    </p>
                    <p className="text-green-600">AI vectorization started for enhanced analysis</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto" />
                  <div>
                    <p className="text-lg font-medium text-gray-700 mb-2">
                      Drop your CSV file here
                    </p>
                    <p className="text-gray-500 mb-4">or click to browse</p>
                    <Button 
                      onClick={() => document.getElementById('file-input')?.click()}
                      disabled={uploading}
                    >
                      Choose File
                    </Button>
                    <input
                      id="file-input"
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              <span>Enhanced AI Analysis</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm">CSV format required</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm">Maximum file size: 100MB</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-sm font-medium">AI vectorization for deeper insights</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm">Data will be securely processed and stored</span>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-purple-200">
              <h4 className="font-medium text-purple-900 mb-2 flex items-center">
                <Zap className="w-4 h-4 mr-1 text-yellow-500" />
                Enhanced AI Features
              </h4>
              <ul className="text-sm text-purple-700 space-y-1">
                <li>• Your data will be vectorized using OpenAI embeddings</li>
                <li>• AI can now understand semantic patterns in your transactions</li>
                <li>• Get more accurate and contextual financial insights</li>
                <li>• Ask complex questions about spending patterns and trends</li>
                <li>• Similarity-based analysis for anomaly detection</li>
              </ul>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Your data will be parsed and analyzed</li>
                <li>• Advanced financial statistics will be calculated</li>
                <li>• Data will be vectorized for AI analysis</li>
                <li>• You can then ask sophisticated questions about your data</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
