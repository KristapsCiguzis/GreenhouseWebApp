-- Create database_connections table
CREATE TABLE IF NOT EXISTS database_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port TEXT NOT NULL,
  database TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  connection_type TEXT NOT NULL DEFAULT 'supabase',
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint on user_id and name
ALTER TABLE database_connections ADD CONSTRAINT unique_connection_name_per_user UNIQUE (user_id, name);

-- Set up Row Level Security for database_connections
ALTER TABLE database_connections ENABLE ROW LEVEL SECURITY;

-- Create policies for database_connections
CREATE POLICY "Users can view their own database connections"
  ON database_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own database connections"
  ON database_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own database connections"
  ON database_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own database connections"
  ON database_connections FOR DELETE
  USING (auth.uid() = user_id);
