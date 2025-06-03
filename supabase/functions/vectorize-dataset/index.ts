
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
    console.log('Starting vectorization process');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Authentication failed:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { datasetId } = await req.json();

    // Get dataset and file from storage
    const { data: dataset, error: datasetError } = await supabase
      .from('datasets')
      .select('*')
      .eq('id', datasetId)
      .eq('user_id', user.id)
      .single();

    if (datasetError || !dataset) {
      console.error('Dataset not found:', datasetError);
      return new Response(JSON.stringify({ error: 'Dataset not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Dataset found:', dataset.original_filename);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('datasets')
      .download(dataset.storage_path);

    if (downloadError || !fileData) {
      console.error('Failed to download file:', downloadError);
      return new Response(JSON.stringify({ error: 'Failed to download file' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse CSV content
    const csvText = await fileData.text();
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    console.log('CSV parsed, processing rows for vectorization');

    // Process data in chunks for vectorization
    const chunks = [];
    const batchSize = 50; // Process 50 rows per chunk
    
    for (let i = 1; i < lines.length; i += batchSize) {
      const batchLines = lines.slice(i, Math.min(i + batchSize, lines.length));
      const batchData = batchLines.map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });

      // Create a meaningful text representation of this data chunk
      const chunkText = `Financial data batch (rows ${i}-${Math.min(i + batchSize - 1, lines.length - 1)}):
Headers: ${headers.join(', ')}

Data summary:
${batchData.map((row, idx) => {
  const rowSummary = Object.entries(row)
    .filter(([_, value]) => value && value.toString().trim())
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
  return `Row ${i + idx}: ${rowSummary}`;
}).join('\n')}

Statistical context from dataset:
- Total rows: ${dataset.total_rows}
- Total columns: ${dataset.total_columns}
- Columns: ${dataset.column_names.join(', ')}`;

      chunks.push({
        text: chunkText,
        metadata: {
          batch_start: i,
          batch_end: Math.min(i + batchSize - 1, lines.length - 1),
          row_count: batchData.length,
          headers: headers
        }
      });
    }

    console.log(`Created ${chunks.length} chunks for vectorization`);

    // Generate embeddings for each chunk
    let processedChunks = 0;
    
    for (const chunk of chunks) {
      try {
        // Generate embedding using OpenAI
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-ada-002',
            input: chunk.text
          }),
        });

        if (!embeddingResponse.ok) {
          console.error('OpenAI embedding failed:', await embeddingResponse.text());
          continue;
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;

        // Store vector in database
        const { error: insertError } = await supabase
          .from('data_vectors')
          .insert({
            dataset_id: datasetId,
            user_id: user.id,
            chunk_text: chunk.text,
            chunk_metadata: chunk.metadata,
            embedding: embedding
          });

        if (insertError) {
          console.error('Failed to insert vector:', insertError);
          continue;
        }

        processedChunks++;
        console.log(`Processed chunk ${processedChunks}/${chunks.length}`);
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error('Error processing chunk:', error);
        continue;
      }
    }

    console.log(`Vectorization completed. Processed ${processedChunks} chunks successfully.`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Successfully vectorized ${processedChunks} data chunks`,
      chunksProcessed: processedChunks,
      totalChunks: chunks.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Vectorization error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to vectorize dataset: ' + (error instanceof Error ? error.message : 'Unknown error')
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
