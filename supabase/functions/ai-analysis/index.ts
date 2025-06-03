
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
    let searchMethod = 'none';

    if (vectorCount && vectorCount.length > 0) {
      // First try vector similarity search
      console.log('Attempting vector similarity search');
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

        // Get all vectorized chunks for similarity calculation
        const { data: vectorData, error: vectorError } = await supabase
          .from('data_vectors')
          .select('*')
          .eq('dataset_id', datasetId)
          .eq('user_id', user.id);

        if (!vectorError && vectorData && vectorData.length > 0) {
          // Calculate similarities
          const similarities = vectorData
            .filter(chunk => chunk.embedding)
            .map(chunk => {
              const similarity = cosineSimilarity(questionEmbedding, chunk.embedding);
              return { ...chunk, similarity };
            })
            .sort((a, b) => b.similarity - a.similarity);

          // Use much lower threshold for better recall
          relevantChunks = similarities.filter(chunk => chunk.similarity > 0.3).slice(0, 10);
          
          if (relevantChunks.length === 0) {
            // If no chunks meet similarity threshold, use top 5 chunks
            relevantChunks = similarities.slice(0, 5);
            searchMethod = 'top_chunks';
            console.log('Using top 5 chunks as fallback');
          } else {
            searchMethod = 'vector_similarity';
            console.log(`Found ${relevantChunks.length} relevant chunks with similarity > 0.3`);
          }
        }
      }
    }

    // If we still have no relevant chunks, try keyword-based search
    if (relevantChunks.length === 0) {
      console.log('Falling back to keyword-based search');
      const keywords = extractKeywords(message);
      
      const { data: keywordData, error: keywordError } = await supabase
        .from('data_vectors')
        .select('*')
        .eq('dataset_id', datasetId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!keywordError && keywordData) {
        // Simple keyword matching
        relevantChunks = keywordData
          .filter(chunk => {
            const text = chunk.chunk_text.toLowerCase();
            return keywords.some(keyword => text.includes(keyword.toLowerCase()));
          })
          .slice(0, 8);
        
        if (relevantChunks.length > 0) {
          searchMethod = 'keyword_search';
          console.log(`Found ${relevantChunks.length} chunks using keyword search`);
        } else {
          // Last resort: get recent chunks
          relevantChunks = keywordData.slice(0, 5);
          searchMethod = 'recent_chunks';
          console.log('Using recent chunks as final fallback');
        }
      }
    }

    // Build context from relevant chunks
    if (relevantChunks.length > 0) {
      vectorContext = '\n\nRelevant data from your dataset:\n' + 
        relevantChunks.map((chunk: any, index: number) => 
          `\nData Chunk ${index + 1} (Rows ${chunk.chunk_metadata?.batch_start || 'unknown'}-${chunk.chunk_metadata?.batch_end || 'unknown'}):\n${chunk.chunk_text}`
        ).join('\n');
      
      console.log(`Built context using ${searchMethod} with ${relevantChunks.length} chunks`);
    } else {
      console.log('No relevant chunks found - providing dataset overview only');
    }

    // Save user message
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: user.id,
      message_type: 'user',
      content: message
    });

    // Enhanced context for AI
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

Search Method Used: ${searchMethod}
Data Chunks Available: ${vectorCount?.length || 0}
Relevant Chunks Found: ${relevantChunks.length}${vectorContext}
    `;

    const systemPrompt = `You are a financial data analyst AI assistant specializing in sales and business analytics. You help users analyze their sales datasets by providing insights, identifying patterns, and answering questions about their business data.

Current dataset context:
${dataContext}

Guidelines:
- This is sales data with brands, markets, customers, and financial periods (FY = Financial Year)
- When users ask for breakdowns "by customer" or "by market", look for those specific data fields in the chunks
- Provide specific quantitative analysis with actual numbers from the data shown
- If asking about specific brands like "JW Red Label", search through all provided chunks for mentions
- Always specify which data chunks you're referencing and acknowledge any limitations
- If limited data is available, suggest how to get more comprehensive analysis
- Focus on actionable business insights

For sales analysis:
- Look for patterns across time periods (FY, quarters, months)
- Compare performance across markets, customers, and products
- Identify top/bottom performers when possible
- Calculate totals and trends where data allows

IMPORTANT: If you cannot find specific data for the user's question in the provided chunks, clearly state this and suggest alternative approaches or clarify what data would be needed.
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
        temperature: 0.2,
        max_tokens: 1500
      }),
    });

    if (!response.ok) {
      throw new Error('OpenAI API error');
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // Save AI response with metadata
    await supabase.from('chat_messages').insert({
      session_id: sessionId,
      user_id: user.id,
      message_type: 'ai',
      content: aiResponse,
      vector_context: {
        search_method: searchMethod,
        chunks_used: relevantChunks.length,
        total_chunks_available: vectorCount?.length || 0,
        chunk_ranges: relevantChunks.map(chunk => ({
          start: chunk.chunk_metadata?.batch_start,
          end: chunk.chunk_metadata?.batch_end,
          similarity: chunk.similarity
        }))
      }
    });

    console.log(`Analysis completed using ${searchMethod} with ${relevantChunks.length} chunks`);

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

// Helper function to extract keywords from user query
function extractKeywords(query: string): string[] {
  // Simple keyword extraction - remove common words and extract meaningful terms
  const commonWords = ['what', 'is', 'the', 'of', 'by', 'for', 'and', 'or', 'in', 'on', 'at', 'to', 'from'];
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !commonWords.includes(word));
}

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
