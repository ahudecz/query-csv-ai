
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

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

    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse CSV content
    const csvText = await file.text();
    const lines = csvText.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return new Response(JSON.stringify({ error: 'Empty file' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });

    // Calculate statistics
    const stats: any = {};
    headers.forEach((header: string) => {
      const values = rows.map((row: any) => row[header]).filter((val: any) => val !== '');
      const numericValues = values.map(Number).filter(n => !isNaN(n));
      
      if (numericValues.length > 0) {
        stats[header] = {
          type: 'numeric',
          count: numericValues.length,
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          sum: numericValues.reduce((a: number, b: number) => a + b, 0),
          avg: numericValues.reduce((a: number, b: number) => a + b, 0) / numericValues.length,
          median: numericValues.sort((a, b) => a - b)[Math.floor(numericValues.length / 2)]
        };
      } else {
        stats[header] = {
          type: 'text',
          count: values.length,
          uniqueValues: [...new Set(values)].length,
          mostCommon: values.reduce((a: any, b: any) => 
            values.filter(v => v === a).length >= values.filter(v => v === b).length ? a : b
          )
        };
      }
    });

    // Store file in Supabase Storage
    const fileName = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('datasets')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(JSON.stringify({ error: 'Failed to upload file' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Save dataset metadata to database
    const { data: dataset, error: dbError } = await supabase
      .from('datasets')
      .insert({
        user_id: user.id,
        filename: fileName,
        original_filename: file.name,
        file_size: file.size,
        total_rows: rows.length,
        total_columns: headers.length,
        column_names: headers,
        stats: stats,
        storage_path: fileName
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(JSON.stringify({ error: 'Failed to save dataset metadata' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      dataset,
      preview: {
        headers,
        rows: rows.slice(0, 100),
        totalRows: rows.length,
        totalColumns: headers.length,
        stats
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
