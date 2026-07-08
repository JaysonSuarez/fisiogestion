const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://hspbjxiqdzwolrwnngtg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzcGJqeGlxZHp3b2xyd25uZ3RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1OTk1MDIsImV4cCI6MjA5MTE3NTUwMn0.4z7ogNzY7sublEIPFQ9Suk62c_XqW5tvGMS1igNWr24'
);

async function test() {
  const codigoLimpio = "THERAPY10-ZKUA7";
  const { data, error } = await supabase
    .from('encuestas_fisioterapia')
    .select('codigo_cupon, cupon_usado, nombre, objetivo, fecha_expiracion')
    .eq('codigo_cupon', codigoLimpio)
    .single();
  
  console.log('Error:', error);
  console.log('Data:', data);
}

test();
