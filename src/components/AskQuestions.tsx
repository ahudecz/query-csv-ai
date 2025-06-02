
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Bot, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AskQuestionsProps {
  uploadedData: any;
}

export const AskQuestions = ({ uploadedData }: AskQuestionsProps) => {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Array<{type: 'user' | 'ai', content: string}>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const suggestedQuestions = [
    "What are the average values for each numeric column?",
    "Which column has the highest variability?",
    "Show me the distribution of values in the first column",
    "What are the most common values in text columns?",
    "Are there any missing values or outliers in the data?"
  ];

  const handleSubmit = async () => {
    if (!question.trim()) return;
    
    if (!uploadedData) {
      toast({
        title: "No data uploaded",
        description: "Please upload a CSV file first to ask questions about your data",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setMessages(prev => [...prev, { type: 'user', content: question }]);
    
    // Simulate AI response - in real implementation, this would call OpenAI API
    setTimeout(() => {
      const mockResponse = generateMockResponse(question, uploadedData);
      setMessages(prev => [...prev, { type: 'ai', content: mockResponse }]);
      setIsLoading(false);
    }, 2000);
    
    setQuestion("");
  };

  const generateMockResponse = (question: string, data: any) => {
    const { stats, totalRows, totalColumns } = data;
    
    if (question.toLowerCase().includes('average')) {
      const numericStats = Object.entries(stats)
        .filter(([_, stat]: [string, any]) => stat.type === 'numeric')
        .map(([col, stat]: [string, any]) => `${col}: ${stat.avg.toFixed(2)}`)
        .slice(0, 5)
        .join(', ');
      return `Based on your data with ${totalRows} rows, here are the average values for your numeric columns: ${numericStats}`;
    }
    
    if (question.toLowerCase().includes('highest') || question.toLowerCase().includes('max')) {
      const maxValues = Object.entries(stats)
        .filter(([_, stat]: [string, any]) => stat.type === 'numeric')
        .map(([col, stat]: [string, any]) => `${col}: ${stat.max.toLocaleString()}`)
        .slice(0, 3)
        .join(', ');
      return `The highest values in your numeric columns are: ${maxValues}`;
    }
    
    return `I analyzed your dataset with ${totalRows} rows and ${totalColumns} columns. To provide more detailed insights, I would need to connect to OpenAI's API to process your specific question: "${question}". The data contains ${Object.values(stats).filter((stat: any) => stat.type === 'numeric').length} numeric columns ready for analysis.`;
  };

  return (
    <div className="p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5" />
                <span>AI Data Assistant</span>
              </CardTitle>
              <CardDescription>
                Ask questions about your data in plain English
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-96 border rounded-lg p-4 overflow-y-auto bg-gray-50">
                  {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <Bot className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p>Ask me anything about your data!</p>
                        <p className="text-sm">I can help you discover insights and patterns.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message, index) => (
                        <div key={index} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`flex items-start space-x-2 max-w-3xl ${message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${message.type === 'user' ? 'bg-blue-600' : 'bg-gray-600'}`}>
                              {message.type === 'user' ? 
                                <User className="w-4 h-4 text-white" /> : 
                                <Bot className="w-4 h-4 text-white" />
                              }
                            </div>
                            <div className={`p-3 rounded-lg ${message.type === 'user' ? 'bg-blue-600 text-white' : 'bg-white border'}`}>
                              {message.content}
                            </div>
                          </div>
                        </div>
                      ))}
                      {isLoading && (
                        <div className="flex justify-start">
                          <div className="flex items-start space-x-2">
                            <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                              <Bot className="w-4 h-4 text-white" />
                            </div>
                            <div className="p-3 rounded-lg bg-white border">
                              <div className="flex space-x-1">
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  <Textarea
                    placeholder="Ask a question about your data..."
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit();
                      }
                    }}
                    className="flex-1"
                    disabled={isLoading}
                  />
                  <Button 
                    onClick={handleSubmit}
                    disabled={isLoading || !question.trim()}
                    size="icon"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Suggested Questions</CardTitle>
              <CardDescription>
                Try these example questions to get started
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {suggestedQuestions.map((suggested, index) => (
                  <button
                    key={index}
                    onClick={() => setQuestion(suggested)}
                    className="w-full text-left p-3 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
                    disabled={isLoading}
                  >
                    {suggested}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {uploadedData && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Data Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Rows:</span>
                    <span className="font-mono">{uploadedData.totalRows.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Columns:</span>
                    <span className="font-mono">{uploadedData.totalColumns}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Numeric:</span>
                    <span className="font-mono">
                      {Object.values(uploadedData.stats).filter((stat: any) => stat.type === 'numeric').length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};
