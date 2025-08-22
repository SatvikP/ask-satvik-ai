import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SubstackPost {
  id: string;
  title: string;
  subtitle?: string;
  content: string;
  url: string;
  published_at: string;
  summary?: string;
}

interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  'content:encoded'?: string;
  guid?: string;
}

function logInfo(stage: string, info: any) {
  console.log(`[SYNC-SUBSTACK INFO - ${stage}]`, {
    ...info,
    timestamp: new Date().toISOString(),
  });
}

function logError(stage: string, error: any, context?: any) {
  console.error(`[SYNC-SUBSTACK ERROR - ${stage}]`, {
    error: error.message || error,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  });
}

async function parseRSSFeed(rssUrl: string): Promise<RSSItem[]> {
  try {
    logInfo('FETCHING_RSS', { url: rssUrl });
    
    const response = await fetch(rssUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
    }

    const rssText = await response.text();
    logInfo('RSS_FETCHED', { contentLength: rssText.length });

    // Parse RSS XML manually (since we're in Deno environment)
    const items: RSSItem[] = [];
    
    // Extract items from RSS
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    
    while ((match = itemRegex.exec(rssText)) !== null) {
      const itemContent = match[1];
      
      const title = extractXMLContent(itemContent, 'title');
      const link = extractXMLContent(itemContent, 'link');
      const pubDate = extractXMLContent(itemContent, 'pubDate');
      const description = extractXMLContent(itemContent, 'description');
      const contentEncoded = extractXMLContent(itemContent, 'content:encoded');
      const guid = extractXMLContent(itemContent, 'guid');
      
      if (title && link && pubDate) {
        items.push({
          title: cleanHTMLTags(title),
          link,
          pubDate,
          description: cleanHTMLTags(description || ''),
          'content:encoded': contentEncoded,
          guid: guid || link
        });
      }
    }

    logInfo('RSS_PARSED', { itemCount: items.length });
    return items;
  } catch (error) {
    logError('RSS_PARSE_ERROR', error, { url: rssUrl });
    throw error;
  }
}

function extractXMLContent(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

function cleanHTMLTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .trim();
}

async function getFullPostContent(postUrl: string): Promise<string> {
  try {
    logInfo('FETCHING_FULL_CONTENT', { url: postUrl });
    
    const response = await fetch(postUrl);
    if (!response.ok) {
      logError('CONTENT_FETCH_ERROR', new Error(`HTTP ${response.status}`), { url: postUrl });
      return '';
    }

    const html = await response.text();
    
    // Extract the main content from Substack's HTML structure
    // Look for the article content div
    const contentMatch = html.match(/<div[^>]*class="[^"]*markup[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (contentMatch) {
      return cleanHTMLTags(contentMatch[1]);
    }
    
    // Fallback: look for other content indicators
    const fallbackMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (fallbackMatch) {
      return cleanHTMLTags(fallbackMatch[1]);
    }

    logInfo('CONTENT_EXTRACTION_FALLBACK', { url: postUrl });
    return '';
  } catch (error) {
    logError('FULL_CONTENT_ERROR', error, { url: postUrl });
    return '';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    logInfo('SYNC_START', { method: req.method });

    // Initialize Supabase client with service role key for database writes
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'https://xveyqosfmbdmnbuvldzq.supabase.co';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!supabaseServiceKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    }

    logInfo('SUPABASE_CONFIG', { 
      hasUrl: !!supabaseUrl, 
      hasServiceKey: !!supabaseServiceKey,
      serviceKeyLength: supabaseServiceKey ? supabaseServiceKey.length : 0
    });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request - expect RSS URL or use default
    let body: any = {};
    try {
      if (req.body) {
        body = await req.json();
      }
    } catch {
      // Use defaults if no body provided
    }

    const rssUrl = body.rssUrl || 'https://satvikputi.substack.com/feed'; // Replace with your actual Substack RSS URL
    const fullSync = body.fullSync || false; // Set to true to fetch full content for each post

    logInfo('SYNC_CONFIG', { rssUrl, fullSync });

    // Fetch and parse RSS feed
    const rssItems = await parseRSSFeed(rssUrl);

    if (rssItems.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No items found in RSS feed', count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process each RSS item
    const processedPosts: SubstackPost[] = [];
    let newCount = 0;
    let updatedCount = 0;

    for (const item of rssItems) {
      try {
        // Check if post already exists
        const { data: existing } = await supabase
          .from('articles')
          .select('id, url')
          .eq('url', item.link)
          .single();

        // Get full content if requested and not already stored
        let fullContent = item.description;
        if (fullSync && (!existing || !existing.content)) {
          const fetchedContent = await getFullPostContent(item.link);
          if (fetchedContent) {
            fullContent = fetchedContent;
          }
        }

        // Use content:encoded if available (usually richer than description)
        if (item['content:encoded']) {
          fullContent = cleanHTMLTags(item['content:encoded']);
        }

        const postData = {
          title: item.title,
          content: fullContent,
          url: item.link,
          published_at: new Date(item.pubDate).toISOString(),
          summary: item.description.substring(0, 500) + (item.description.length > 500 ? '...' : ''),
          substack_id: item.guid,
          updated_at: new Date().toISOString()
        };

        if (existing) {
          // Update existing post
          const { error: updateError } = await supabase
            .from('articles')
            .update(postData)
            .eq('id', existing.id);

          if (updateError) {
            logError('UPDATE_ERROR', updateError, { url: item.link });
          } else {
            updatedCount++;
            logInfo('POST_UPDATED', { title: item.title, url: item.link });
          }
        } else {
          // Insert new post
          const { error: insertError } = await supabase
            .from('articles')
            .insert([postData]);

          if (insertError) {
            logError('INSERT_ERROR', insertError, { url: item.link });
          } else {
            newCount++;
            logInfo('POST_INSERTED', { title: item.title, url: item.link });
          }
        }

        processedPosts.push({
          id: item.guid || item.link,
          title: item.title,
          content: fullContent,
          url: item.link,
          published_at: item.pubDate,
          summary: postData.summary
        });

      } catch (error) {
        logError('PROCESS_POST_ERROR', error, { url: item.link, title: item.title });
      }
    }

    const result = {
      message: 'Substack sync completed',
      totalProcessed: rssItems.length,
      newPosts: newCount,
      updatedPosts: updatedCount,
      rssUrl,
      fullSync,
      timestamp: new Date().toISOString()
    };

    logInfo('SYNC_COMPLETED', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logError('SYNC_ERROR', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Sync failed',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
})