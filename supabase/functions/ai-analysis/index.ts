
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { message, datasetId, sessionId } = await req.json();

    // Get dataset information
    const { data: dataset, error: datasetError } = await supabase
      .from('datasets')
      .select('*')
      .eq('id', datasetId)
      .eq('user_id', user.id)
      .single();

    if (datasetError || !dataset) {
      return new Response(JSON.stringify({ error: 'Dataset not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Save user message
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: user.id,
      message_type: 'user',
      content: message
    });

    // Prepare context for AI
    const dataContext = `
Dataset: ${dataset.original_filename}
Rows: ${dataset.total_rows}
Columns: ${dataset.total_columns}
Column Names: ${dataset.column_names.join(', ')}

Statistics Summary:
${Object.entries(dataset.stats).map(([col, stats]: [string, any]) => 
  `${col}: ${stats.type === 'numeric' 
    ? `Type: Numeric, Min: ${stats.min}, Max: ${stats.max}, Average: ${stats.avg?.toFixed(2)}`
    : `Type: Text, Unique Values: ${stats.uniqueValues}, Most Common: ${stats.mostCommon}`
  }`
).join('\n')}
    `;

    const systemPrompt = `You are a financial data analyst AI assistant. You help users analyze their financial datasets by providing insights, identifying patterns, and answering questions about their data.

Current dataset context:
${dataContext}

Guidelines:
- Provide specific insights based on the actual data statistics
- Suggest relevant financial analysis techniques
- Identify potential patterns or anomalies
- Recommend visualizations when appropriate
- Be concise but thorough
- Focus on actionable insights
`;

    // Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      throw new Error('OpenAI API error');
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Save AI response
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: user.id,
      message_type: 'ai',
      content: aiResponse
    });

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('AI Analysis error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process AI analysis' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
