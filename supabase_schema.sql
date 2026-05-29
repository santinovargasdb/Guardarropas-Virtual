-- SCHEMA FOR VIRTUAL WARDROBE (GUARDARROPAS VIRTUAL)
-- Execute this SQL script in the Supabase SQL Editor (SQL Editor -> New Query)

-- 1. Create PRENDAS Table
CREATE TABLE IF NOT EXISTS public.prendas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    image_url TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('superior', 'inferior', 'abrigo', 'calzado', 'monoprenda', 'accesorio')),
    weather TEXT[] NOT NULL, -- Array of ['calido', 'frio', 'templado', 'lluvioso']
    formality TEXT[] NOT NULL, -- Array of ['casual', 'formal', 'trabajo', 'fiesta']
    styles TEXT[] NOT NULL DEFAULT '{}', -- Ej: ['sporty', 'minimalist']
    colors TEXT[] NOT NULL DEFAULT '{}', -- Ej: ['negro', 'blanco']
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS) on prendas
ALTER TABLE public.prendas ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (since this is a personal app, public reads and writes are fine to keep it simple, or authenticated if Auth is configured)
-- For a birthday gift, we will allow anonymous access for ease of use.
CREATE POLICY "Allow public read access" ON public.prendas
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON public.prendas
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public delete access" ON public.prendas
    FOR DELETE USING (true);


-- 2. Create OUTFITS_FAVORITOS Table
CREATE TABLE IF NOT EXISTS public.outfits_favoritos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT, -- Optional name
    items UUID[] NOT NULL, -- Array of prenda UUIDs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on outfits_favoritos
ALTER TABLE public.outfits_favoritos ENABLE ROW LEVEL SECURITY;

-- Policies for outfits_favoritos
CREATE POLICY "Allow public read access" ON public.outfits_favoritos
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON public.outfits_favoritos
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public delete access" ON public.outfits_favoritos
    FOR DELETE USING (true);


-- 3. Storage Bucket instructions
-- In Supabase Storage, create a bucket named "prendas-images".
-- Make it PUBLIC (so we can get image URLs without tokens).
-- RLS policies for storage bucket "prendas-images":
-- 1. Select: Allow public read access (true)
-- 2. Insert/Upload: Allow public upload (true)
-- 3. Delete: Allow public deletion (true)
