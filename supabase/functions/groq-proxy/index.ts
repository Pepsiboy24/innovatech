import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// CORS: override ALLOWED_ORIGIN with your real frontend domain in production.
const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN') || '*'
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.3-70b-versatile'

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

  const apiKey = Deno.env.get('GROQ_API_KEY')
  if (!apiKey) {
    console.error('groq-proxy: GROQ_API_KEY is not configured on the server')
    return new Response(
      JSON.stringify({ error: 'GROQ_API_KEY is not configured on the server' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    const { messages = [], systemPrompt = '' } = await req.json()

    const groqMessages = [
      { role: 'system', content: systemPrompt || 'You are a helpful AI assistant.' },
      ...messages
    ]

    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: groqMessages,
        temperature: 0.7,
        max_tokens: 2048,
        top_p: 0.9
      })
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      console.error('groq-proxy: Groq API error', response.status, err)
      return new Response(
        JSON.stringify({ error: err?.error?.message || `Groq API HTTP ${response.status}` }),
        {
          status: response.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content || ''

    return new Response(
      JSON.stringify({ text }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('groq-proxy error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})