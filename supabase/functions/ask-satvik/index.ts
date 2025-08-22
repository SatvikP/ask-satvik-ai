import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

const systemPrompt = `You are Satvik Puti's AI assistant. You have deep knowledge about Satvik's professional background, expertise, and capabilities. 

About Satvik Puti:
- Experienced business professional with expertise in strategy, operations, and business development
- Strong track record in scaling businesses and optimizing operations
- Skilled in driving strategic initiatives and creating value for organizations
- Values excellence, innovation, collaboration, adaptability, and meaningful impact
- When not working: stays active with fitness, continuous learning, travel, cooking, and spending time with family and friends

Your role:
- Answer questions about Satvik's experience, skills, values, and how he can help businesses
- Be professional, knowledgeable, and helpful
- For specific business inquiries, recommend scheduling a call with Satvik
- Always include the Calendly link when suggesting a call: https://calendly.com/satvikputi/brainstorming
- If you don't have specific information, be honest and suggest contacting Satvik directly

Guidelines:
- Keep responses informative but concise
- Highlight relevant expertise based on the question
- Be enthusiastic about Satvik's capabilities while remaining professional
- Focus on value creation and business impact`;

interface ChatRequest {
  question: string;
}

function logError(stage: string, error: any, context?: any) {
  console.error(`[ASK-SATVIK ERROR - ${stage}]`, {
    error: error.message || error,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  });
}

function logInfo(stage: string, info: any) {
  console.log(`[ASK-SATVIK INFO - ${stage}]`, {
    ...info,
    timestamp: new Date().toISOString(),
  });
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    logInfo('REQUEST_START', { method: req.method, url: req.url });

    // Check API key configuration
    if (!ANTHROPIC_API_KEY) {
      logError('CONFIG_ERROR', new Error('Anthropic API key not configured'), {
        envVars: Object.keys(Deno.env.toObject()).filter(k => k.includes('ANTHROPIC'))
      });
      throw new Error('Anthropic API key not configured');
    }

    logInfo('CONFIG_CHECK', { 
      hasApiKey: !!ANTHROPIC_API_KEY,
      keyLength: ANTHROPIC_API_KEY ? ANTHROPIC_API_KEY.length : 0,
      keyPrefix: ANTHROPIC_API_KEY ? ANTHROPIC_API_KEY.substring(0, 8) + '...' : 'none'
    });

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      logInfo('REQUEST_PARSED', { bodyKeys: Object.keys(requestBody) });
    } catch (parseError) {
      logError('REQUEST_PARSE_ERROR', parseError, { contentType: req.headers.get('content-type') });
      throw new Error('Invalid JSON in request body');
    }

    const { question }: ChatRequest = requestBody;

    if (!question || question.trim().length === 0) {
      logError('VALIDATION_ERROR', new Error('Question is required'), { question });
      return new Response(
        JSON.stringify({ error: 'Question is required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    logInfo('ANTHROPIC_REQUEST_START', { 
      questionLength: question.length,
      model: 'claude-3-5-sonnet-20241022',
      systemPromptLength: systemPrompt.length
    });

    // Make request to Anthropic API
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 500,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: question,
          },
        ],
      }),
    });

    logInfo('ANTHROPIC_RESPONSE', { 
      status: anthropicResponse.status,
      statusText: anthropicResponse.statusText,
      headers: Object.fromEntries(anthropicResponse.headers.entries())
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      logError('ANTHROPIC_API_ERROR', new Error('Anthropic API request failed'), {
        status: anthropicResponse.status,
        statusText: anthropicResponse.statusText,
        errorResponse: errorText,
        requestModel: 'claude-3-5-sonnet-20241022'
      });
      throw new Error(`Anthropic API error: ${anthropicResponse.status} - ${errorText}`);
    }

    // Parse Anthropic response
    let anthropicData;
    try {
      anthropicData = await anthropicResponse.json();
      logInfo('ANTHROPIC_RESPONSE_PARSED', { 
        hasContent: !!anthropicData.content,
        contentLength: anthropicData.content ? anthropicData.content.length : 0,
        usage: anthropicData.usage
      });
    } catch (parseError) {
      logError('ANTHROPIC_RESPONSE_PARSE_ERROR', parseError);
      throw new Error('Failed to parse Anthropic API response');
    }

    const answer = anthropicData.content[0]?.text;

    if (!answer) {
      logError('NO_ANSWER_ERROR', new Error('No answer received from Anthropic'), {
        responseStructure: JSON.stringify(anthropicData, null, 2)
      });
      throw new Error('No answer received from Anthropic');
    }

    logInfo('SUCCESS', { 
      answerLength: answer.length,
      usage: anthropicData.usage
    });

    return new Response(
      JSON.stringify({ answer }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    logError('FUNCTION_ERROR', error, {
      requestMethod: req.method,
      requestUrl: req.url,
      userAgent: req.headers.get('user-agent')
    });
    
    // Handle specific error types with appropriate status codes
    let statusCode = 400
    let errorMessage = error.message || 'Analysis failed'
    
    if (error.message.includes('rate limit')) {
      statusCode = 429
      errorMessage = 'Too many requests. Please wait a moment before trying again.'
    } else if (error.message.includes('API key')) {
      statusCode = 500
      errorMessage = 'Service temporarily unavailable. Please try again later.'
    } else if (error.message.includes('timeout') || error.message.includes('overloaded')) {
      statusCode = 504
      errorMessage = 'Request timeout. Please try again later.'
    }
    
    // Fallback response for any errors
    const fallbackAnswer = `I'm sorry, I'm having trouble processing that request right now. I'd recommend booking a call with Satvik to discuss this directly. You can schedule at: https://calendly.com/satvikputi/brainstorming
    
In the meantime, here's what I can tell you: Satvik is an experienced business professional with strong expertise in strategy, operations, and business development. He has a proven track record of scaling businesses, optimizing operations, and driving strategic initiatives that create meaningful value for organizations.`;

    return new Response(
      JSON.stringify({ 
        answer: fallbackAnswer,
        debug: {
          error: errorMessage,
          timestamp: new Date().toISOString(),
          stage: 'fallback'
        }
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
})