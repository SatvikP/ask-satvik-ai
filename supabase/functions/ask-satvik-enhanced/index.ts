import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const baseSystemPrompt = `You are Satvik Puti's AI assistant. You have deep knowledge about Satvik's professional background, expertise, and capabilities. 

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
  console.error(`[ASK-SATVIK-ENHANCED ERROR - ${stage}]`, {
    error: error.message || error,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  });
}

function logInfo(stage: string, info: any) {
  console.log(`[ASK-SATVIK-ENHANCED INFO - ${stage}]`, {
    ...info,
    timestamp: new Date().toISOString(),
  });
}

async function searchRelevantArticles(supabase: any, question: string): Promise<string> {
  try {
    logInfo('SEARCHING_ARTICLES', { questionLength: question.length });

    // Get recent articles (could enhance with vector search later)
    const { data: articles, error } = await supabase
      .from('articles')
      .select('title, summary, content, url, published_at')
      .order('published_at', { ascending: false })
      .limit(10);

    if (error) {
      logError('ARTICLE_SEARCH_ERROR', error);
      return '';
    }

    if (!articles || articles.length === 0) {
      logInfo('NO_ARTICLES_FOUND', {});
      return '';
    }

    // Simple keyword matching for now (could upgrade to semantic search)
    const questionLower = question.toLowerCase();
    const keywords = questionLower.split(/\s+/).filter(word => word.length > 3);
    
    const relevantArticles = articles.filter(article => {
      const searchText = `${article.title} ${article.summary} ${article.content}`.toLowerCase();
      return keywords.some(keyword => searchText.includes(keyword));
    });

    // If no keyword matches, return recent articles
    const articlesToUse = relevantArticles.length > 0 ? relevantArticles.slice(0, 3) : articles.slice(0, 3);

    logInfo('ARTICLES_SELECTED', { 
      totalArticles: articles.length,
      relevantArticles: relevantArticles.length,
      selectedArticles: articlesToUse.length
    });

    // Format articles for the prompt
    const articleContext = articlesToUse.map(article => `
Title: ${article.title}
Published: ${new Date(article.published_at).toDateString()}
Summary: ${article.summary}
URL: ${article.url}
Content Preview: ${article.content.substring(0, 500)}...
`).join('\n---\n');

    return articleContext;
  } catch (error) {
    logError('SEARCH_ARTICLES_ERROR', error);
    return '';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    logInfo('REQUEST_START', { method: req.method, url: req.url });

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Check API key configuration
    if (!ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not configured');
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      throw new Error('Invalid JSON in request body');
    }

    const { question }: ChatRequest = requestBody;

    if (!question || question.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Question is required' }), 
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    logInfo('PROCESSING_QUESTION', { questionLength: question.length });

    // Search for relevant articles
    const articleContext = await searchRelevantArticles(supabase, question);

    // Build enhanced system prompt with article context
    let systemPrompt = baseSystemPrompt;
    if (articleContext) {
      systemPrompt += `\n\nRecent writings by Satvik that might be relevant to this question:\n${articleContext}\n\nUse this content to provide more specific and informed answers about Satvik's thoughts and expertise.`;
    }

    logInfo('ANTHROPIC_REQUEST_START', { 
      hasArticleContext: !!articleContext,
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
        max_tokens: 800,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: question,
          },
        ],
      }),
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      throw new Error(`Anthropic API error: ${anthropicResponse.status} - ${errorText}`);
    }

    const anthropicData = await anthropicResponse.json();
    const answer = anthropicData.content[0]?.text;

    if (!answer) {
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
    logError('FUNCTION_ERROR', error);
    
    // Fallback response for any errors
    const fallbackAnswer = `I'm sorry, I'm having trouble processing that request right now. I'd recommend booking a call with Satvik to discuss this directly. You can schedule at: https://calendly.com/satvikputi/brainstorming
    
In the meantime, here's what I can tell you: Satvik is an experienced business professional with strong expertise in strategy, operations, and business development. He has a proven track record of scaling businesses, optimizing operations, and driving strategic initiatives that create meaningful value for organizations.`;

    return new Response(
      JSON.stringify({ 
        answer: fallbackAnswer,
        debug: {
          error: error.message,
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