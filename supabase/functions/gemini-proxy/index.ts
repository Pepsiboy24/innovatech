import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// CORS: restrict to your actual frontend domain (replace YOUR_DOMAIN with it)
const corsHeaders = {
  'Access-Control-Allow-Origin': 'YOUR_DOMAIN',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const GEMINI_MODEL = 'gemini-2.0-flash'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'GEMINI_API_KEY is not configured on the server' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    const { messages = [], systemPrompt = '' } = await req.json()

    // Prepend system prompt as a user→model turn (Gemini doesn't have a system role)
    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Understood. I am EduHub AI, ready to assist you.' }] },
      ...messages
    ]

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.9,
          maxOutputTokens: 2048
        }
      })
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return new Response(
        JSON.stringify({ error: err?.error?.message || `Gemini API HTTP ${response.status}` }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const data = await response.json()

    return new Response(
      JSON.stringify(data),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('gemini-proxy error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})