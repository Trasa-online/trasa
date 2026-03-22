DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scraped_places_place_name_city_source_platform_key'
  ) THEN
    ALTER TABLE public.scraped_places
      ADD CONSTRAINT scraped_places_place_name_city_source_platform_key
      UNIQUE (place_name, city, source_platform);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS scraped_places_embedding_idx
  ON public.scraped_places USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);