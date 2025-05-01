-- Create database_settings table
CREATE TABLE IF NOT EXISTS database_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  supabase_url TEXT NOT NULL,
  supabase_api_key TEXT NOT NULL,
  temperature JSONB NOT NULL DEFAULT '{"enabled": true, "frequency": 60}',
  humidity JSONB NOT NULL DEFAULT '{"enabled": true, "frequency": 60}',
  soil_moisture JSONB NOT NULL DEFAULT '{"enabled": true, "frequency": 300}',
  light_level JSONB NOT NULL DEFAULT '{"enabled": true, "frequency": 60}',
  led_state JSONB NOT NULL DEFAULT '{"enabled": true}',
  relay_state JSONB NOT NULL DEFAULT '{"enabled": true}',
  light_relay_state JSONB NOT NULL DEFAULT '{"enabled": true}',
  light_auto_mode JSONB NOT NULL DEFAULT '{"enabled": true}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint on user_id (one settings record per user)
ALTER TABLE database_settings ADD CONSTRAINT unique_settings_per_user UNIQUE (user_id);

-- Set up Row Level Security for database_settings
ALTER TABLE database_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for database_settings
CREATE POLICY "Users can view their own database settings"
  ON database_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own database settings"
  ON database_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own database settings"
  ON database_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own database settings"
  ON database_settings FOR DELETE
  USING (auth.uid() = user_id);
