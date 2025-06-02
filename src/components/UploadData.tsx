
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UploadDataProps {
  onDataUploaded: (data: any) => void;
}

export const UploadData = ({ onDataUploaded }: UploadDataProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const parseCSV = (csvText: string) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return null;

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });

    return { headers, rows, totalRows: rows.length, totalColumns: headers.length };
  };

  const calculateStats = (data: any) => {
    const { rows, headers } = data;
    const stats: any = {};

    headers.forEach((header: string) => {
      const values = rows.map((row: any) => row[header]).filter((val: any) => val !== '');
      const numericValues = values.map(Number).filter(n => !isNaN(n));
      
      if (numericValues.length > 0) {
        stats[header] = {
          type: 'numeric',
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          sum: numericValues.reduce((a: number, b: number) => a + b, 0),
          avg: numericValues.reduce((a: number, b: number) => a + b, 0) / numericValues.length
        };
      } else {
        stats[header] = {
          type: 'text',
          uniqueValues: [...new Set(values)].length
        };
      }
    });

    return stats;
  };

  const handleFile = async (file: File) => {
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
    
    try {
      const text = await file.text();
      const parsedData = parseCSV(text);
      
      if (!parsedData) {
        throw new Error("Failed to parse CSV file");
      }

      if (parsedData.totalRows < 30000 || parsedData.totalColumns < 25) {
        toast({
          title: "File requirements not met",
          description: "File should have at least 30,000 rows and 25 columns",
          variant: "destructive"
        });
        setUploading(false);
        return;
      }

      const stats = calculateStats(parsedData);
      const dataWithStats = { ...parsedData, stats, fileName: file.name };
      
      onDataUploaded(dataWithStats);
      
      toast({
        title: "Upload successful",
        description: `Processed ${parsedData.totalRows} rows and ${parsedData.totalColumns} columns`
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to process the CSV file",
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
              <span>Upload CSV Data</span>
            </CardTitle>
            <CardDescription>
              Upload your CSV file to get started with AI-powered analytics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? "border-blue-500 bg-blue-50" 
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
                  <p className="text-gray-600">Processing your CSV file...</p>
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
              <AlertCircle className="w-5 h-5" />
              <span>Requirements</span>
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
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm">Minimum: 30,000 rows × 25 columns</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm">Data will be securely processed</span>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Your data will be parsed and analyzed</li>
                <li>• Basic statistics will be calculated</li>
                <li>• You can then ask AI questions about your data</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
