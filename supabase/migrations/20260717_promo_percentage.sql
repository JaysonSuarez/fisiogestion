ALTER TABLE public.promociones ADD COLUMN porcentaje_descuento INTEGER;
ALTER TABLE public.promociones DROP COLUMN precio_original;
ALTER TABLE public.promociones DROP COLUMN precio_promo;
