import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = ["https://trasa.travel", "https://trasa.lovable.app", "http://localhost:8080", "http://localhost:5173", "capacitor://localhost", "https://localhost", "http://localhost"];

serve(async (req) => {
  const reqOrigin = req.headers.get("Origin") ?? "";
  const corsHeaders = {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(reqOrigin) ? reqOrigin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pin_id, place_name, address } = await req.json();
    
    if (!pin_id || !place_name) {
      console.log('Missing required fields:', { pin_id, place_name });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: pin_id and place_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Auth + ownership: pin musi nalezec do trasy zalogowanego usera ──
    // Bez tego = IDOR (nadpisanie tlumaczen dowolnego cudzego pina + koszt AI) - wczesniej
    // brak jakiejkolwiek weryfikacji auth.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: pinRow } = await supabase.from('pins').select('route_id').eq('id', pin_id).maybeSingle();
    if (!pinRow) {
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: ownRoute } = await supabase.from('routes').select('id').eq('id', pinRow.route_id).eq('user_id', user.id).maybeSingle();
    if (!ownRoute) {
      return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('Translating place:', { pin_id, place_name, address });

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Lovable AI Gateway for translations
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a translator. Translate place names to different languages. Return ONLY a valid JSON object with translations, nothing else.'
          },
          {
            role: 'user',
            content: `Translate this place name to 5 languages (English, German, Spanish, French, Italian).
            
Place name: ${place_name}
${address ? `Address context: ${address}` : ''}

Return a JSON object with language codes as keys (en, de, es, fr, it) and translated place names as values.
Example format: {"en": "Tokyo Tower", "de": "Tokio-Turm", "es": "Torre de Tokio", "fr": "Tour de Tokyo", "it": "Torre di Tokyo"}

IMPORTANT: Return ONLY the JSON object, no markdown, no explanation.`
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'save_translations',
              description: 'Save the translations for the place name',
              parameters: {
                type: 'object',
                properties: {
                  translations: {
                    type: 'object',
                    properties: {
                      en: { type: 'string', description: 'English translation' },
                      de: { type: 'string', description: 'German translation' },
                      es: { type: 'string', description: 'Spanish translation' },
                      fr: { type: 'string', description: 'French translation' },
                      it: { type: 'string', description: 'Italian translation' }
                    },
                    required: ['en', 'de', 'es', 'fr', 'it']
                  }
                },
                required: ['translations']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'save_translations' } }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required, please add funds' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI translation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    console.log('AI response:', JSON.stringify(aiData));

    // Extract translations from tool call response
    let translations = {};
    const toolCalls = aiData.choices?.[0]?.message?.tool_calls;
    
    if (toolCalls && toolCalls.length > 0) {
      const args = toolCalls[0].function?.arguments;
      if (args) {
        const parsed = typeof args === 'string' ? JSON.parse(args) : args;
        translations = parsed.translations || parsed;
      }
    } else {
      // Fallback: try to parse from content
      const content = aiData.choices?.[0]?.message?.content;
      if (content) {
        try {
          translations = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());
        } catch (e) {
          console.error('Failed to parse content as JSON:', e);
        }
      }
    }

    console.log('Extracted translations:', translations);

    // Update pin with translations (ownership zweryfikowany na poczatku funkcji)
    const { error: updateError } = await supabase
      .from('pins')
      .update({ name_translations: translations })
      .eq('id', pin_id);

    if (updateError) {
      console.error('Database update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to save translations', details: updateError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully saved translations for pin:', pin_id);

    return new Response(
      JSON.stringify({ success: true, translations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
