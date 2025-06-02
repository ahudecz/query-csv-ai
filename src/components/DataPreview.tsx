
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Database, TrendingUp } from "lucide-react";

interface DataPreviewProps {
  data: any;
}

export const DataPreview = ({ data }: DataPreviewProps) => {
  const { headers, rows, totalRows, totalColumns, stats, fileName } = data;
  const previewRows = rows.slice(0, 100);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rows</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRows.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">from {fileName}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Columns</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalColumns}</div>
            <p className="text-xs text-muted-foreground">data fields identified</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Numeric Columns</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(stats).filter((stat: any) => stat.type === 'numeric').length}
            </div>
            <p className="text-xs text-muted-foreground">ready for analysis</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data Preview</CardTitle>
          <CardDescription>
            Showing first 100 rows of {totalRows.toLocaleString()} total rows
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-auto max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  {headers.slice(0, 10).map((header: string, index: number) => (
                    <TableHead key={index} className="font-medium">
                      {header}
                    </TableHead>
                  ))}
                  {headers.length > 10 && (
                    <TableHead className="text-muted-foreground">
                      +{headers.length - 10} more columns
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.slice(0, 10).map((row: any, rowIndex: number) => (
                  <TableRow key={rowIndex}>
                    {headers.slice(0, 10).map((header: string, colIndex: number) => (
                      <TableCell key={colIndex} className="font-mono text-sm">
                        {String(row[header]).length > 50 
                          ? String(row[header]).substring(0, 50) + "..."
                          : String(row[header])
                        }
                      </TableCell>
                    ))}
                    {headers.length > 10 && (
                      <TableCell className="text-muted-foreground">...</TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Column Statistics</CardTitle>
          <CardDescription>
            Basic statistics for numeric columns in your dataset
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(stats)
              .filter(([_, stat]: [string, any]) => stat.type === 'numeric')
              .slice(0, 6)
              .map(([column, stat]: [string, any]) => (
                <div key={column} className="p-4 border rounded-lg">
                  <h4 className="font-medium text-sm mb-2 truncate">{column}</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Min:</span>
                      <span className="font-mono">{stat.min.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max:</span>
                      <span className="font-mono">{stat.max.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg:</span>
                      <span className="font-mono">{stat.avg.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
