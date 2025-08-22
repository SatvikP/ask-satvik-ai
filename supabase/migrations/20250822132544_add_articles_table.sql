-- Create articles table for storing Substack content
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  published_at TIMESTAMP WITH TIME ZONE NOT NULL,
  summary TEXT,
  tags TEXT[],
  substack_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access to articles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'articles' 
    AND policyname = 'Articles are publicly readable'
  ) THEN
    CREATE POLICY "Articles are publicly readable" 
    ON public.articles 
    FOR SELECT 
    USING (true);
  END IF;
END $$;

-- Create policy for service role to manage articles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'articles' 
    AND policyname = 'Service role can manage articles'
  ) THEN
    CREATE POLICY "Service role can manage articles"
    ON public.articles
    FOR ALL
    TO service_role
    USING (true);
  END IF;
END $$;

-- Create trigger for automatic timestamp updates (only if function exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') 
  AND NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_articles_updated_at') THEN
    CREATE TRIGGER update_articles_updated_at
      BEFORE UPDATE ON public.articles
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON public.articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_url ON public.articles(url);
CREATE INDEX IF NOT EXISTS idx_articles_substack_id ON public.articles(substack_id);