-- Create backup table for deleted pins
CREATE TABLE public.pins_backup (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_pin_id UUID NOT NULL,
  route_id UUID NOT NULL,
  user_id UUID NOT NULL,
  place_name TEXT NOT NULL,
  address TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  images TEXT[],
  rating NUMERIC,
  pin_order INTEGER NOT NULL,
  tags TEXT[],
  latitude NUMERIC,
  longitude NUMERIC,
  is_transport BOOLEAN,
  transport_type TEXT,
  transport_end TEXT,
  mentioned_users UUID[],
  name_translations JSONB,
  original_creator_id UUID,
  original_created_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deletion_source TEXT DEFAULT 'unknown', -- 'auto_save', 'manual', 'route_delete', etc.
  route_title TEXT, -- Store route title for context
  can_restore BOOLEAN DEFAULT true
);

-- Create index for faster lookups
CREATE INDEX idx_pins_backup_user_id ON public.pins_backup(user_id);
CREATE INDEX idx_pins_backup_route_id ON public.pins_backup(route_id);
CREATE INDEX idx_pins_backup_deleted_at ON public.pins_backup(deleted_at DESC);

-- Enable RLS
ALTER TABLE public.pins_backup ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can view their own backups
CREATE POLICY "Users can view their own pin backups"
ON public.pins_backup
FOR SELECT
USING (auth.uid() = user_id);

-- RLS policy: only admins can delete backups (cleanup)
CREATE POLICY "Admins can delete pin backups"
ON public.pins_backup
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger function to backup pins before deletion
CREATE OR REPLACE FUNCTION public.backup_pin_before_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_route_title TEXT;
BEGIN
  -- Get user_id and title from the route
  SELECT r.user_id, r.title INTO v_user_id, v_route_title
  FROM routes r
  WHERE r.id = OLD.route_id;

  -- Insert backup record
  INSERT INTO pins_backup (
    original_pin_id,
    route_id,
    user_id,
    place_name,
    address,
    description,
    image_url,
    images,
    rating,
    pin_order,
    tags,
    latitude,
    longitude,
    is_transport,
    transport_type,
    transport_end,
    mentioned_users,
    name_translations,
    original_creator_id,
    original_created_at,
    route_title,
    deletion_source
  ) VALUES (
    OLD.id,
    OLD.route_id,
    v_user_id,
    OLD.place_name,
    OLD.address,
    OLD.description,
    OLD.image_url,
    OLD.images,
    OLD.rating,
    OLD.pin_order,
    OLD.tags,
    OLD.latitude,
    OLD.longitude,
    OLD.is_transport,
    OLD.transport_type,
    OLD.transport_end,
    OLD.mentioned_users,
    OLD.name_translations,
    OLD.original_creator_id,
    OLD.created_at,
    v_route_title,
    COALESCE(current_setting('app.deletion_source', true), 'unknown')
  );

  RETURN OLD;
END;
$$;

-- Create trigger on pins table
CREATE TRIGGER backup_pins_before_delete
BEFORE DELETE ON public.pins
FOR EACH ROW
EXECUTE FUNCTION public.backup_pin_before_delete();

-- Create function to restore pins from backup (for admins)
CREATE OR REPLACE FUNCTION public.restore_pins_from_backup(
  p_backup_ids UUID[],
  p_target_route_id UUID DEFAULT NULL
)
RETURNS TABLE(restored_count INTEGER, restored_pin_ids UUID[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restored_ids UUID[] := ARRAY[]::UUID[];
  v_backup_record RECORD;
  v_new_pin_id UUID;
  v_count INTEGER := 0;
BEGIN
  -- Check if user is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can restore pins from backup';
  END IF;

  FOR v_backup_record IN 
    SELECT * FROM pins_backup 
    WHERE id = ANY(p_backup_ids) AND can_restore = true
  LOOP
    -- Insert restored pin
    INSERT INTO pins (
      place_name,
      address,
      description,
      image_url,
      images,
      rating,
      pin_order,
      tags,
      latitude,
      longitude,
      is_transport,
      transport_type,
      transport_end,
      mentioned_users,
      name_translations,
      original_creator_id,
      route_id
    ) VALUES (
      v_backup_record.place_name,
      v_backup_record.address,
      v_backup_record.description,
      v_backup_record.image_url,
      v_backup_record.images,
      v_backup_record.rating,
      v_backup_record.pin_order,
      v_backup_record.tags,
      v_backup_record.latitude,
      v_backup_record.longitude,
      v_backup_record.is_transport,
      v_backup_record.transport_type,
      v_backup_record.transport_end,
      v_backup_record.mentioned_users,
      v_backup_record.name_translations,
      v_backup_record.original_creator_id,
      COALESCE(p_target_route_id, v_backup_record.route_id)
    )
    RETURNING id INTO v_new_pin_id;

    v_restored_ids := array_append(v_restored_ids, v_new_pin_id);
    v_count := v_count + 1;

    -- Mark backup as restored (can't restore again)
    UPDATE pins_backup 
    SET can_restore = false 
    WHERE id = v_backup_record.id;
  END LOOP;

  RETURN QUERY SELECT v_count, v_restored_ids;
END;
$$;