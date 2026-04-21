-- =====================================================================
-- seed.sql — Datos iniciales
-- =====================================================================
-- Se aplica tras las 8 migraciones. NO incluye productos/variantes
-- (se cargan desde el CSV de inventario físico) ni profiles (se crean
-- tras el primer login de cada socio en Supabase Auth).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Proveedores
-- ---------------------------------------------------------------------
insert into proveedores (nombre) values
  ('AUREN'),
  ('YOUR BRAND'),
  ('BRACOR');

-- ---------------------------------------------------------------------
-- Categorías de gasto (fijas 8 + variables 9 = 17)
-- ---------------------------------------------------------------------
insert into categorias_gasto (nombre, tipo, orden) values
  -- Fijos
  ('Arriendo',                    'fijo', 10),
  ('Servicios (Agua/Luz/Gas)',    'fijo', 20),
  ('Internet',                    'fijo', 30),
  ('Nómina',                      'fijo', 40),
  ('Contador',                    'fijo', 50),
  ('Digitales (Shopify/Workspace)', 'fijo', 60),
  ('Seguros',                     'fijo', 70),
  ('Imprevistos',                 'fijo', 80),
  -- Variables
  ('Publicidad/Marketing',        'variable', 110),
  ('Empaque',                     'variable', 120),
  ('Aseo/Mantenimiento',          'variable', 130),
  ('Transporte',                  'variable', 140),
  ('Comisiones datáfono',         'variable', 150),
  ('Ilustraciones/Diseños',       'variable', 160),
  ('Dotación local',              'variable', 170),
  ('Mercancía',                   'variable', 180),
  ('Otros',                       'variable', 190);

-- ---------------------------------------------------------------------
-- Parámetros de costo (del Cotizador del Sheet)
-- ---------------------------------------------------------------------
insert into parametros_costo (concepto, descripcion, costo_unitario, aplicable_a) values
  ('estampado_dtg_grande',       'DTG pecho, espalda o ambos', 12000, array['prenda']::tipo_producto[]),
  ('punto_corazon_estampado',    'Logo estampado punto corazón', 2000,  array['prenda']::tipo_producto[]),
  ('punto_corazon_bordado',      'Logo bordado punto corazón',   7000,  array['prenda']::tipo_producto[]),
  ('etiqueta_espalda',           'Etiqueta tela espalda',        600,   array['prenda']::tipo_producto[]),
  ('marquilla_lavado',           'Marquilla de lavado',          600,   array['prenda']::tipo_producto[]),
  ('bolsa',                      'Bolsa empaque',                1000,
    array['prenda','fragancia','accesorio']::tipo_producto[]);

-- ---------------------------------------------------------------------
-- Diseños (39 referencias culturales) — ver docs/plan/seed-disenos.sql
-- ---------------------------------------------------------------------
insert into disenos (nombre, categoria, referencia_ano, descripcion) values
  ('Pulp Fiction', 'cine', 1994, 'Película de Quentin Tarantino'),
  ('Pedro Navaja', 'musica', 1978, 'Salsa narrativa, Rubén Blades'),
  ('Léon: The Professional', 'cine', 1994, 'Película de Luc Besson'),
  ('Ciudad de Dios', 'cine', 2002, 'Película brasileña, Fernando Meirelles'),
  ('Charles Bukowski', 'literatura', null, 'Literatura cruda, poeta maldito'),
  ('Héctor Lavoe - Vinyl Cover', 'musica', null, 'Salsa, estilo portada de vinilo'),
  ('Gabo - Cien Años de Soledad', 'literatura', 1967, 'García Márquez'),
  ('Blade Runner', 'cine', 1982, 'Ridley Scott, neo-noir cyberpunk'),
  ('Mercedes Sosa - Volver a los 17', 'musica', null, 'Mercedes Sosa con La Fania'),
  ('Taxi Driver', 'cine', 1976, 'Scorsese, De Niro'),
  ('Fight Club', 'cine', 1999, 'Fincher, Pitt/Norton'),
  ('Scarface', 'cine', 1983, 'De Palma, Al Pacino'),
  ('Vendedora de Rosas', 'cine', 1998, 'Víctor Gaviria, Medellín'),
  ('Notorious BIG', 'musica', null, 'Hip hop, East Coast'),
  ('Celia Cruz', 'musica', null, 'Reina de la salsa'),
  ('Mike Tyson', 'deporte', null, 'Boxeo'),
  ('Príncipe de Bel Air', 'tv', 1990, 'Sitcom, Will Smith'),
  ('Jackass', 'tv', 2000, 'MTV, cultura skate'),
  ('Friends', 'tv', 1994, 'Sitcom icónico'),
  ('MTV', 'cultura_pop', null, 'Estética de los 90'),
  ('PlayStation 1', 'cultura_pop', 1994, 'Nostalgia gaming'),
  ('Backstreet Boys', 'musica', null, 'Boy band 90s'),
  ('Punk', 'musica', null, 'Estética punk rock'),
  ('Eminem', 'musica', null, 'Rap, Slim Shady era'),
  ('Tupac y BIG', 'musica', null, 'Hip hop, East vs West'),
  ('Cerati y Rock Español', 'musica', null, 'Soda Stereo, Cadillacs, Caifanes'),
  ('Mi Pobre Angelito', 'cine', 1990, 'Home Alone, clásico navideño'),
  ('Manos de Tijera', 'cine', 1990, 'Edward Scissorhands, Burton'),
  ('Titanic', 'cine', 1997, 'Cameron, DiCaprio/Winslet'),
  ('Sexto Sentido', 'cine', 1999, 'Shyamalan'),
  ('Marc Anthony', 'musica', null, 'Salsa romántica'),
  ('Grupo Niche', 'musica', null, 'Salsa colombiana'),
  ('Gran Combo de las Estrellas', 'musica', null, 'Salsa clásica'),
  ('Rocky', 'cine', 1976, 'Stallone, boxeo'),
  ('Canserbero', 'musica', null, 'Rap venezolano, canon'),
  ('Thalía', 'musica', null, 'Pop latino 90s'),
  ('Vicente Fernández', 'musica', null, 'Ranchera, El Charro'),
  ('El Principito', 'literatura', 1943, 'Saint-Exupéry'),
  ('La Máscara / Show de Truman', 'cine', null, 'Jim Carrey, doble referencia');
