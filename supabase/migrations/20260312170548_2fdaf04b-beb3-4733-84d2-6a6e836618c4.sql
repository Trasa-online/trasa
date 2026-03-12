
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Table for storing vector embeddings of trip memories/experiences
CREATE TABLE public.memory_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route_id uuid REFERENCES public.routes(id) ON DELETE CASCADE,
  pin_id uuid REFERENCES public.pins(id) ON DELETE SET NULL,
  content text NOT NULL,
  embedding vector(768),
  memory_type text NOT NULL DEFAULT 'experience',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast similarity search
CREATE INDEX memory_embeddings_embedding_idx ON public.memory_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX memory_embeddings_user_id_idx ON public.memory_embeddings(user_id);
CREATE INDEX memory_embeddings_route_id_idx ON public.memory_embeddings(route_id);

-- Enable RLS
ALTER TABLE public.memory_embeddings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own memories"
  ON public.memory_embeddings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own memories"
  ON public.memory_embeddings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own memories"
  ON public.memory_embeddings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own memories"
  ON public.memory_embeddings FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Function for similarity search
CREATE OR REPLACE FUNCTION public.match_memories(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  memory_type text,
  metadata jsonb,
  route_id uuid,
  pin_id uuid,
  similarity float
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    me.id,
    me.content,
    me.memory_type,
    me.metadata,
    me.route_id,
    me.pin_id,
    1 - (me.embedding <=> query_embedding) AS similarity
  FROM memory_embeddings me
  WHERE (filter_user_id IS NULL OR me.user_id = filter_user_id)
    AND 1 - (me.embedding <=> query_embedding) > match_threshold
  ORDER BY me.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
