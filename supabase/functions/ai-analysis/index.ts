
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

    console.log(`Processing question: "${message}" for dataset: ${dataset.original_filename}`);

    // Check vectorization status first
    const { data: vectorCount, error: vectorCountError } = await supabase
      .from('data_vectors')
      .select('id', { count: 'exact' })
      .eq('dataset_id', datasetId)
      .eq('user_id', user.id);

    console.log(`Found ${vectorCount?.length || 0} vector chunks for this dataset`);

    let vectorContext = '';
    let relevantChunks: any[] = [];

    if (vectorCount && vectorCount.length > 0) {
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

      if (questionEmbeddingResponse.ok) {
        const questionEmbeddingData = await questionEmbeddingResponse.json();
        const questionEmbedding = questionEmbeddingData.data[0].embedding;

        // Enhanced vector search with better similarity threshold
        console.log('Searching for relevant data chunks with vector similarity');
        const { data: vectorData, error: vectorError } = await supabase
          .from('data_vectors')
          .select('*')
          .eq('dataset_id', datasetId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20); // Get more chunks initially

        if (!vectorError && vectorData) {
          // Calculate cosine similarity manually since we don't have the RPC function
          const similarities = vectorData
            .filter(chunk => chunk.embedding)
            .map(chunk => {
              const similarity = cosineSimilarity(questionEmbedding, chunk.embedding);
              return { ...chunk, similarity };
            })
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 8); // Take top 8 most similar chunks

          relevantChunks = similarities.filter(chunk => chunk.similarity > 0.5); // Lower threshold for better recall
          
          console.log(`Found ${relevantChunks.length} relevant chunks with similarity > 0.5`);
          console.log('Similarity scores:', relevantChunks.map(c => c.similarity));
        }
      }
    } else {
      console.log('No vector data found, vectorization may not be complete');
      // Fallback: get recent raw data chunks
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('data_vectors')
        .select('*')
        .eq('dataset_id', datasetId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (!fallbackError && fallbackData) {
        relevantChunks = fallbackData;
        console.log(`Using fallback: ${relevantChunks.length} recent chunks`);
      }
    }

    // Build context from relevant chunks
    if (relevantChunks.length > 0) {
      vectorContext = '\n\nRelevant data from your sales dataset:\n' + 
        relevantChunks.map((chunk: any, index: number) => 
          `\nData Chunk ${index + 1} (Rows ${chunk.chunk_metadata?.batch_start || 'unknown'}-${chunk.chunk_metadata?.batch_end || 'unknown'}):\n${chunk.chunk_text}`
        ).join('\n');
      
      console.log(`Built context from ${relevantChunks.length} relevant data chunks`);
    } else {
      console.log('No relevant chunks found, using basic dataset context only');
    }

    // Save user message
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: user.id,
      message_type: 'user',
      content: message
    });

    // Enhanced context for AI with better financial analysis focus
    const dataContext = `
Sales Dataset: ${dataset.original_filename}
Total Rows: ${dataset.total_rows}
Total Columns: ${dataset.total_columns}
Column Names: ${dataset.column_names.join(', ')}

Dataset Statistics:
${Object.entries(dataset.stats).map(([col, stats]: [string, any]) => 
  `${col}: ${stats.type === 'numeric' 
    ? `Type: Numeric, Min: ${stats.min}, Max: ${stats.max}, Average: ${stats.avg?.toFixed(2)}`
    : `Type: Text, Unique Values: ${stats.uniqueValues}`
  }`
).join('\n')}

Vectorization Status: ${vectorCount?.length || 0} data chunks processed${vectorContext}
    `;

    const systemPrompt = `You are a financial data analyst AI assistant specializing in sales and market analysis. You help users analyze their sales datasets by providing insights, identifying patterns, and answering questions about their business data.

Current dataset context:
${dataContext}

Guidelines:
- This appears to be sales data with brands, markets, and financial periods
- Focus on providing specific insights based on the actual data shown in the relevant chunks
- When analyzing brands like "JW Red Label", look for all mentions across different time periods and markets
- Provide quantitative analysis with specific numbers from the data
- If asking about breakdowns (e.g., "by customer", "by market"), aggregate the relevant data
- Suggest follow-up questions that would provide deeper business insights
- If limited data is shown, acknowledge this and suggest ways to get more comprehensive analysis
- Always specify which data chunks you're referencing for transparency

For sales analysis:
- Look for patterns across time periods (FY, quarters, months)
- Compare performance across markets and customers
- Identify top/bottom performers
- Calculate growth rates and trends where possible
`;

    // Call OpenAI with enhanced prompt
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
        temperature: 0.3, // Lower temperature for more consistent analysis
        max_tokens: 1200
      }),
    });

    if (!response.ok) {
      throw new Error('OpenAI API error');
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Save AI response with enhanced vector context
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: user.id,
      message_type: 'ai',
      content: aiResponse,
      vector_context: {
        chunks_used: relevantChunks.length,
        chunk_metadata: relevantChunks.map(chunk => chunk.chunk_metadata),
        vectorization_status: `${vectorCount?.length || 0} total chunks available`,
        similarity_scores: relevantChunks.map(chunk => chunk.similarity).filter(Boolean)
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

// Helper function to calculate cosine similarity
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
