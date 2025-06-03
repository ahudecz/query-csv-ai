import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, LineChart, TrendingUp, PieChart, AlertCircle } from "lucide-react";

interface ViewResultsProps {
  uploadedData: any;
}

export const ViewResults = ({ uploadedData }: ViewResultsProps) => {
  console.log('ViewResults received data:', uploadedData);

  if (!uploadedData || !uploadedData.preview) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <BarChart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Data Available</h3>
              <p className="text-gray-600">Upload a CSV file first to view charts and visualizations.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { stats, totalRows, totalColumns } = uploadedData.preview;
  
  if (!stats) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="p-8">
            <div className="text-center">
              <AlertCircle className="w-16 h-16 text-orange-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Processing Data</h3>
              <p className="text-gray-600">Your data is being analyzed. Please wait a moment...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const numericColumns = Object.entries(stats).filter(([_, stat]: [string, any]) => stat.type === 'numeric');

  return (
    <div className="p-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart className="w-5 h-5" />
              <span>Column Distribution</span>
            </CardTitle>
            <CardDescription>
              Distribution of numeric vs text columns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Numeric Columns</span>
                <span className="font-semibold">{numericColumns.length}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${(numericColumns.length / totalColumns) * 100}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between">
                <span>Text Columns</span>
                <span className="font-semibold">{totalColumns - numericColumns.length}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-green-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${((totalColumns - numericColumns.length) / totalColumns) * 100}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5" />
              <span>Value Ranges</span>
            </CardTitle>
            <CardDescription>
              Min and max values for numeric columns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {numericColumns.slice(0, 5).map(([column, stat]: [string, any]) => (
                <div key={column} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium truncate">{column}</span>
                    <span className="text-gray-500">{stat.min} - {stat.max}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full w-full"></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <LineChart className="w-5 h-5" />
              <span>Average Values</span>
            </CardTitle>
            <CardDescription>
              Mean values for numeric columns
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {numericColumns.slice(0, 6).map(([column, stat]: [string, any], index) => (
                <div key={column} className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate flex-1">{column}</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-20 bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          index % 4 === 0 ? 'bg-blue-500' :
                          index % 4 === 1 ? 'bg-green-500' :
                          index % 4 === 2 ? 'bg-purple-500' : 'bg-orange-500'
                        }`}
                        style={{ width: `${Math.min((stat.avg / stat.max) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-mono w-20 text-right">
                      {stat.avg.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <PieChart className="w-5 h-5" />
              <span>Data Insights</span>
            </CardTitle>
            <CardDescription>
              Key statistics about your dataset
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {totalRows?.toLocaleString() || 'N/A'}
                </div>
                <div className="text-sm text-blue-600">Total Rows</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {totalColumns || 'N/A'}
                </div>
                <div className="text-sm text-green-600">Columns</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {numericColumns.length}
                </div>
                <div className="text-sm text-purple-600">Numeric</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {totalColumns ? Math.round((numericColumns.length / totalColumns) * 100) : 0}%
                </div>
                <div className="text-sm text-orange-600">Analyzable</div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Ready for Analysis</h4>
              <p className="text-sm text-gray-600">
                Your dataset is ready for AI-powered analysis. Ask questions in the "Ask Questions" section 
                to get insights about trends, patterns, and relationships in your data.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
