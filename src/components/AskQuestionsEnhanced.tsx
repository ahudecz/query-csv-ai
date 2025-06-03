
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Send, Bot, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface AskQuestionsEnhancedProps {
  uploadedData: any;
}

export const AskQuestionsEnhanced = ({ uploadedData }: AskQuestionsEnhancedProps) => {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Array<{type: 'user' | 'ai', content: string}>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { toast } = useToast();
  const { session } = useAuth();

  const financialQuestions = [
    "What are the main trends in my spending patterns?",
    "Which categories have the highest expenses?",
    "Are there any unusual transactions or outliers?",
    "What is my average monthly spending?",
    "How does my income compare to my expenses?",
    "Can you identify any seasonal patterns in the data?"
  ];

  useEffect(() => {
    if (uploadedData?.dataset?.id) {
      createAnalysisSession();
    }
  }, [uploadedData]);

  const createAnalysisSession = async () => {
    try {
      const { data, error } = await supabase
        .from('analysis_sessions')
        .insert({
          user_id: session?.user?.id,
          dataset_id: uploadedData.dataset.id,
          session_name: `Analysis - ${new Date().toLocaleString()}`
        })
        .select()
        .single();

      if (error) throw error;
      setSessionId(data.id);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handleSubmit = async () => {
    if (!question.trim() || !sessionId) return;
    
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
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-analysis', {
        body: {
          message: question,
          datasetId: uploadedData.dataset.id,
          sessionId: sessionId
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (error) throw error;

      setMessages(prev => [...prev, { type: 'ai', content: data.response }]);
    } catch (error) {
      console.error('AI Analysis error:', error);
      toast({
        title: "Analysis failed",
        description: "Failed to analyze your question. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
    
    setQuestion("");
  };

  return (
    <div className="p-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5" />
                <span>AI Financial Analyst</span>
              </CardTitle>
              <CardDescription>
                Ask questions about your financial data in plain English
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="h-96 border rounded-lg p-4 overflow-y-auto bg-gray-50">
                  {messages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <Bot className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                        <p>Ask me anything about your financial data!</p>
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
                    placeholder="Ask a question about your financial data..."
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
                    disabled={isLoading || !question.trim() || !sessionId}
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
                Try these financial analysis questions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {financialQuestions.map((suggested, index) => (
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
                <CardTitle>Current Dataset</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>File:</span>
                    <span className="font-mono text-xs truncate">{uploadedData.dataset?.original_filename}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rows:</span>
                    <span className="font-mono">{uploadedData.preview?.totalRows?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Columns:</span>
                    <span className="font-mono">{uploadedData.preview?.totalColumns}</span>
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
