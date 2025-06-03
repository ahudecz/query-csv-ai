
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
    console.log('Processing dataset request started');
    
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

    console.log('User authenticated:', user.id);

    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.error('No file provided');
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('File received:', file.name, 'Size:', file.size);

    // Check file size limit (50MB instead of 100MB for better performance)
    if (file.size > 50 * 1024 * 1024) {
      console.error('File too large:', file.size);
      return new Response(JSON.stringify({ error: 'File too large. Maximum size is 50MB.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse CSV content with timeout protection
    console.log('Starting CSV parsing');
    const csvText = await file.text();
    const lines = csvText.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      console.error('Empty file');
      return new Response(JSON.stringify({ error: 'Empty file' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('CSV parsed, lines:', lines.length);

    // Limit processing to first 10,000 rows for performance
    const maxRows = 10000;
    const processLines = lines.slice(0, Math.min(lines.length, maxRows));
    
    const headers = processLines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = processLines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });

    console.log('Data processed, rows:', rows.length, 'columns:', headers.length);

    // Calculate basic statistics (simplified for performance)
    console.log('Calculating statistics');
    const stats: any = {};
    
    // Process only first 5 columns for stats to avoid timeout
    const maxCols = Math.min(headers.length, 5);
    
    for (let i = 0; i < maxCols; i++) {
      const header = headers[i];
      const values = rows.slice(0, 1000).map((row: any) => row[header]).filter((val: any) => val !== '');
      const numericValues = values.map(Number).filter(n => !isNaN(n));
      
      if (numericValues.length > 0) {
        stats[header] = {
          type: 'numeric',
          count: numericValues.length,
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          avg: numericValues.reduce((a: number, b: number) => a + b, 0) / numericValues.length
        };
      } else {
        stats[header] = {
          type: 'text',
          count: values.length,
          uniqueValues: [...new Set(values.slice(0, 100))].length
        };
      }
    }

    console.log('Statistics calculated');

    // Store file in Supabase Storage
    const fileName = `${user.id}/${Date.now()}-${file.name}`;
    console.log('Uploading to storage:', fileName);
    
    const { error: uploadError } = await supabase.storage
      .from('datasets')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(JSON.stringify({ error: 'Failed to upload file: ' + uploadError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('File uploaded successfully');

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
      return new Response(JSON.stringify({ error: 'Failed to save dataset metadata: ' + dbError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('Dataset saved to database');

    const response = {
      dataset,
      preview: {
        headers,
        rows: rows.slice(0, 100),
        totalRows: rows.length,
        totalColumns: headers.length,
        stats,
        processingNote: lines.length > maxRows ? `Only first ${maxRows} rows were processed for performance` : null
      }
    };

    console.log('Request completed successfully');

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error: ' + (error instanceof Error ? error.message : 'Unknown error')
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
