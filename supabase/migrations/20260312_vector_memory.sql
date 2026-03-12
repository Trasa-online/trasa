-- Enable pgvector extension for similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- User memory: stores AAR content as embeddings for cross-trip recall
CREATE TABLE IF NOT EXISTS public.user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  day_number INT,
  city TEXT,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, route_id)
);

ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own memories" ON public.user_memory
  FOR ALL USING (auth.uid() = user_id);

-- User preference graph: qualitative signals extracted from AAR conversations
CREATE TABLE IF NOT EXISTS public.user_preference_graph (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preference_key TEXT NOT NULL,
  preference_value TEXT NOT NULL,
  confidence FLOAT DEFAULT 0.5,
  evidence_count INT DEFAULT 1,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, preference_key)
);

ALTER TABLE public.user_preference_graph ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own preferences" ON public.user_preference_graph
  FOR ALL USING (auth.uid() = user_id);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS user_memory_embedding_idx
  ON public.user_memory USING hnsw (embedding vector_cosine_ops);

-- RPC: find semantically similar memories for a user
CREATE OR REPLACE FUNCTION match_memories(
  query_embedding vector(1536),
  match_user_id UUID,
  match_threshold FLOAT DEFAULT 0.6,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  route_id UUID,
  day_number INT,
  city TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    um.id,
    um.route_id,
    um.day_number,
    um.city,
    um.content,
    um.metadata,
    1 - (um.embedding <=> query_embedding) AS similarity,
    um.created_at
  FROM public.user_memory um
  WHERE um.user_id = match_user_id
    AND um.embedding IS NOT NULL
    AND 1 - (um.embedding <=> query_embedding) > match_threshold
  ORDER BY um.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
