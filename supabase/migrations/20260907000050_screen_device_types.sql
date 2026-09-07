ALTER TABLE public.screens
  ADD COLUMN IF NOT EXISTS device_type TEXT NOT NULL DEFAULT 'tv';

UPDATE public.screens
SET device_type = 'tv'
WHERE device_type IS NULL OR device_type NOT IN ('tv', 'windows_monitor');

ALTER TABLE public.screens
  DROP CONSTRAINT IF EXISTS screens_device_type_check;

ALTER TABLE public.screens
  ADD CONSTRAINT screens_device_type_check
  CHECK (device_type IN ('tv', 'windows_monitor'));
