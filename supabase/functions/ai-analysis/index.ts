
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

    // Generate embedding for the user's question
    console.log('Generating embedding for user question');
    const questionEmbeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: message
      }),
    });

    let vectorContext = '';
    let relevantChunks: any[] = [];

    if (questionEmbeddingResponse.ok) {
      const questionEmbeddingData = await questionEmbeddingResponse.json();
      const questionEmbedding = questionEmbeddingData.data[0].embedding;

      // Search for relevant data chunks using vector similarity
      console.log('Searching for relevant data chunks');
      const { data: similarChunks, error: vectorError } = await supabase.rpc('match_documents', {
        query_embedding: questionEmbedding,
        match_threshold: 0.7,
        match_count: 5,
        dataset_id: datasetId
      });

      // If the RPC function doesn't exist, fall back to a simple vector search
      if (vectorError) {
        console.log('Using fallback vector search');
        const { data: vectorData, error: fallbackError } = await supabase
          .from('data_vectors')
          .select('*')
          .eq('dataset_id', datasetId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3);

        if (!fallbackError && vectorData) {
          relevantChunks = vectorData;
        }
      } else {
        relevantChunks = similarChunks || [];
      }

      // Build context from relevant chunks
      if (relevantChunks.length > 0) {
        vectorContext = '\n\nRelevant data from your dataset:\n' + 
          relevantChunks.map((chunk: any, index: number) => 
            `\nChunk ${index + 1}:\n${chunk.chunk_text}`
          ).join('\n');
        
        console.log(`Found ${relevantChunks.length} relevant data chunks`);
      }
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
    : `Type: Text, Unique Values: ${stats.uniqueValues}`
  }`
).join('\n')}${vectorContext}
    `;

    const systemPrompt = `You are a financial data analyst AI assistant. You help users analyze their financial datasets by providing insights, identifying patterns, and answering questions about their data.

Current dataset context:
${dataContext}

Guidelines:
- Provide specific insights based on the actual data statistics and relevant data chunks shown above
- When relevant data chunks are provided, reference specific examples from the actual data
- Suggest relevant financial analysis techniques
- Identify potential patterns or anomalies based on the actual data shown
- Recommend visualizations when appropriate
- Be concise but thorough
- Focus on actionable insights
- If you see actual transaction data or financial records, provide detailed analysis of spending patterns, categories, amounts, and trends
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

    // Save AI response with vector context
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: user.id,
      message_type: 'ai',
      content: aiResponse,
      vector_context: {
        chunks_used: relevantChunks.length,
        chunk_metadata: relevantChunks.map(chunk => chunk.chunk_metadata)
      }
    });

    console.log(`AI analysis completed with ${relevantChunks.length} relevant chunks`);

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
