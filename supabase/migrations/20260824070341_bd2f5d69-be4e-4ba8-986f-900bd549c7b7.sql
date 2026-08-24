-- Parts: explicit write lockdown (all writes go through trusted server code)
REVOKE INSERT, UPDATE, DELETE ON public.parts FROM anon, authenticated;
GRANT SELECT ON public.parts TO anon, authenticated;
GRANT ALL ON public.parts TO service_role;

DROP POLICY IF EXISTS "No public inserts on parts" ON public.parts;
DROP POLICY IF EXISTS "No public updates on parts" ON public.parts;
DROP POLICY IF EXISTS "No public deletes on parts" ON public.parts;

CREATE POLICY "No public inserts on parts"
ON public.parts FOR INSERT TO anon, authenticated
WITH CHECK (false);

CREATE POLICY "No public updates on parts"
ON public.parts FOR UPDATE TO anon, authenticated
USING (false) WITH CHECK (false);

CREATE POLICY "No public deletes on parts"
ON public.parts FOR DELETE TO anon, authenticated
USING (false);

-- Storage: explicitly deny all direct client access to part-photos
DROP POLICY IF EXISTS "part-photos no public read" ON storage.objects;
DROP POLICY IF EXISTS "part-photos no public insert" ON storage.objects;
DROP POLICY IF EXISTS "part-photos no public update" ON storage.objects;
DROP POLICY IF EXISTS "part-photos no public delete" ON storage.objects;

CREATE POLICY "part-photos no public read"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id <> 'part-photos' AND false);

CREATE POLICY "part-photos no public insert"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (bucket_id <> 'part-photos' AND false);

CREATE POLICY "part-photos no public update"
ON storage.objects FOR UPDATE TO anon, authenticated
USING (bucket_id <> 'part-photos' AND false)
WITH CHECK (bucket_id <> 'part-photos' AND false);

CREATE POLICY "part-photos no public delete"
ON storage.objects FOR DELETE TO anon, authenticated
USING (bucket_id <> 'part-photos' AND false);