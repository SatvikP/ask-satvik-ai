#!/usr/bin/env bun
import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = 'https://xveyqosfmbdmnbuvldzq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUBSTACK_RSS_URL = process.env.SUBSTACK_RSS_URL || 'https://satvikputi.substack.com/feed'; // Replace with your actual URL

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY environment variable');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
  'content:encoded'?: string;
  guid?: string;
}

function cleanHTMLTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function extractXMLContent(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : '';
}

async function parseRSSFeed(rssUrl: string): Promise<RSSItem[]> {
  console.log(`📡 Fetching RSS feed from: ${rssUrl}`);
  
  const response = await fetch(rssUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`);
  }

  const rssText = await response.text();
  console.log(`📄 RSS content length: ${rssText.length} characters`);

  const items: RSSItem[] = [];
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

  console.log(`📚 Found ${items.length} articles in RSS feed`);
  return items;
}

async function getFullPostContent(postUrl: string): Promise<string> {
  try {
    console.log(`🔍 Fetching full content for: ${postUrl}`);
    
    const response = await fetch(postUrl);
    if (!response.ok) {
      console.warn(`⚠️ Failed to fetch ${postUrl}: ${response.status}`);
      return '';
    }

    const html = await response.text();
    
    // Try to extract main content from various Substack HTML structures
    const contentSelectors = [
      /<div[^>]*class="[^"]*markup[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<div[^>]*class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<article[^>]*>([\s\S]*?)<\/article>/i,
      /<div[^>]*class="[^"]*body[^"]*"[^>]*>([\s\S]*?)<\/div>/i
    ];
    
    for (const selector of contentSelectors) {
      const match = html.match(selector);
      if (match) {
        const cleanedContent = cleanHTMLTags(match[1]);
        if (cleanedContent.length > 100) { // Only return if we got substantial content
          console.log(`✅ Extracted ${cleanedContent.length} characters of content`);
          return cleanedContent;
        }
      }
    }

    console.warn(`⚠️ Could not extract substantial content from ${postUrl}`);
    return '';
  } catch (error) {
    console.error(`❌ Error fetching content for ${postUrl}:`, error);
    return '';
  }
}

async function syncSubstackContent(fullSync: boolean = false) {
  try {
    console.log('🚀 Starting Substack content sync...');
    console.log(`📍 RSS URL: ${SUBSTACK_RSS_URL}`);
    console.log(`🔄 Full content sync: ${fullSync ? 'YES' : 'NO'}`);
    
    // Fetch and parse RSS feed
    const rssItems = await parseRSSFeed(SUBSTACK_RSS_URL);

    if (rssItems.length === 0) {
      console.log('❌ No items found in RSS feed');
      return;
    }

    let newCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    console.log(`\n📝 Processing ${rssItems.length} articles...\n`);

    for (const [index, item] of rssItems.entries()) {
      try {
        console.log(`[${index + 1}/${rssItems.length}] Processing: ${item.title}`);
        
        // Check if post already exists
        const { data: existing } = await supabase
          .from('articles')
          .select('id, url, content')
          .eq('url', item.link)
          .single();

        // Get full content if requested
        let fullContent = item.description;
        
        if (fullSync) {
          const fetchedContent = await getFullPostContent(item.link);
          if (fetchedContent && fetchedContent.length > fullContent.length) {
            fullContent = fetchedContent;
          }
        }

        // Use content:encoded if available (usually richer than description)
        if (item['content:encoded']) {
          const encodedContent = cleanHTMLTags(item['content:encoded']);
          if (encodedContent.length > fullContent.length) {
            fullContent = encodedContent;
          }
        }

        const postData = {
          title: item.title,
          content: fullContent,
          url: item.link,
          published_at: new Date(item.pubDate).toISOString(),
          summary: item.description.substring(0, 500) + (item.description.length > 500 ? '...' : ''),
          substack_id: item.guid || item.link,
          updated_at: new Date().toISOString()
        };

        if (existing) {
          // Only update if content has changed or we're doing full sync
          const shouldUpdate = fullSync || existing.content !== fullContent;
          
          if (shouldUpdate) {
            const { error } = await supabase
              .from('articles')
              .update(postData)
              .eq('id', existing.id);

            if (error) {
              console.error(`❌ Update failed: ${error.message}`);
              errorCount++;
            } else {
              console.log(`✅ Updated existing article`);
              updatedCount++;
            }
          } else {
            console.log(`⏭️ No changes, skipped`);
          }
        } else {
          // Insert new post
          const { error } = await supabase
            .from('articles')
            .insert([postData]);

          if (error) {
            console.error(`❌ Insert failed: ${error.message}`);
            errorCount++;
          } else {
            console.log(`✨ Added new article`);
            newCount++;
          }
        }

        // Add small delay to be nice to servers
        if (fullSync && index < rssItems.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`❌ Error processing ${item.title}:`, error);
        errorCount++;
      }
      
      console.log(''); // Empty line for readability
    }

    console.log('🎉 Sync completed!');
    console.log(`📊 Results:`);
    console.log(`   • New articles: ${newCount}`);
    console.log(`   • Updated articles: ${updatedCount}`);
    console.log(`   • Errors: ${errorCount}`);
    console.log(`   • Total processed: ${rssItems.length}`);

  } catch (error) {
    console.error('💥 Sync failed:', error);
    process.exit(1);
  }
}

// Parse command line arguments
const fullSync = process.argv.includes('--full') || process.argv.includes('-f');
const help = process.argv.includes('--help') || process.argv.includes('-h');

if (help) {
  console.log(`
Substack Content Sync Utility

Usage:
  bun scripts/sync-substack.ts [options]

Options:
  --full, -f    Fetch full content for each post (slower but more complete)
  --help, -h    Show this help message

Environment Variables:
  SUPABASE_SERVICE_ROLE_KEY    Required: Your Supabase service role key
  SUBSTACK_RSS_URL            Optional: Your Substack RSS URL (defaults to satvikputi.substack.com/feed)

Examples:
  bun scripts/sync-substack.ts              # Quick sync (RSS content only)
  bun scripts/sync-substack.ts --full       # Full sync (fetch complete articles)
`);
  process.exit(0);
}

// Run the sync
syncSubstackContent(fullSync);