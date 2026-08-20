const express = require('express');
const path = require('path');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3001;
const { Server } = require('socket.io');

/* ☁️ SUPABASE — base de datos en la nube (Parche A) */
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const SB = !!(SUPABASE_URL && SUPABASE_KEY);
async function sb(ruta, metodo, cuerpo) {
  const headers = {
    apikey: SUPABASE_KEY,
    Authorization: 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
  };
  if (cuerpo) headers.Prefer = 'return=representation';
  const r = await fetch(SUPABASE_URL + '/rest/v1/' + ruta, {
    method: metodo,
    headers: headers,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined
  });
  const texto = await r.text();
  if (!r.ok) { console.log('⚠️ Supabase error ' + r.status + ': ' + texto); return []; }
  try { return texto ? JSON.parse(texto) : []; } catch (e) { return []; }
}

async function cambiarEstado(id, estado) {
  if (SB) await sb('pedidos?id=eq.' + id, 'PATCH', { estado: estado });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 🧠 CEREBRO DEL NEGOCIO → esto es lo único que cambiás por cliente
const LOCAL = {
  nombre: 'LA BURGUERÍA',
  horario: 'Martes a domingo de 19:00 a 24:00',
  direccion: 'Av. Siempreviva 742',
  delivery: 'Sí, radio de 3 km, sin mínimo',
  pagos: 'Efectivo, transferencia y tarjetas',
  whatsapp: '5491162459363',
  menu: [
    { item: 'Clásica', desc: 'Carne 150g, queso, lechuga y tomate', precio: 4500 },
    { item: 'Doble', desc: 'Doble carne, doble queso y bacon', precio: 6500 },
    { item: 'Crispy', desc: 'Pollo crocante, cheddar y salsa de la casa', precio: 5500 },
    { item: 'Papas fritas', desc: 'Porción grande', precio: 3000 },
    { item: 'Gaseosa', desc: '500 ml', precio: 1500 },
    { item: 'Combo Clásico', desc: 'Clásica + papas + gaseosa', precio: 8000 },
    { item: 'Combo Doble', desc: 'Doble + papas + gaseosa', precio: 10000 }
  ]
};

function cerebro() {
  const menuTxt = LOCAL.menu.map(m => '- ' + m.item + ': ' + m.desc + ' ($' + m.precio + ')').join('\n');
  return [
    'Sos el vendedor virtual de ' + LOCAL.nombre + ', local de comida rápida.',
    'Respondés SIEMPRE en español, corto, amable y con algún emoji 🍔🍟.',
    'DATOS: Horario: ' + LOCAL.horario + '. Dirección: ' + LOCAL.direccion + '. Delivery: ' + LOCAL.delivery + '. Pagos: ' + LOCAL.pagos + '.',
    'MENÚ CON PRECIOS:\n' + menuTxt,
    'REGLAS: 1) Hablá SOLO del local; otra cosa → redirigí amablemente. 2) No inventes platos ni precios fuera del menú. 3) Si piden hamburguesa y bebida, sugerí el combo (ahorra plata). 4) Al cerrar un pedido, mostrá el total y decí que lo confirmen por WhatsApp al ' + LOCAL.whatsapp + '. 5) Si preguntan por humanos: "Te paso con el equipo por WhatsApp 📲".',
  ].join('\n');
}

if (process.env.GROQ_API_KEY) {
  const Groq = require('groq-sdk');
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const MODELOS = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct'];
  app.post('/api/ia', async (req, res) => {
    const { mensaje, historial, mesa } = req.body;
    const messages = [{ role: 'system', content: cerebro() }];
    if (mesa) messages.push({ role: 'system', content: 'El cliente está en: ' + mesa + '. Mencioná la mesa al confirmar el pedido y NO pidas nombre ni apellido: con la mesa alcanza.' });
    (historial || []).forEach(h => messages.push(h));
    messages.push({ role: 'user', content: mensaje });
    for (const modelo of MODELOS) {
      try {
        const r = await groq.chat.completions.create({ model: modelo, messages, temperature: 0.6, max_tokens: 512 });
        return res.json({ ok: true, respuesta: r.choices[0].message.content });
      } catch (e) { /* pruebo el siguiente */ }
    }
    res.json({ ok: false });
  });
}

app.get('/api/local', (req, res) => res.json(LOCAL));

/* 🍳 COCINA EN VIVO + ☁️ SUPABASE */
app.post('/api/pedido', async (req, res) => {          /* Parche B */
  const p = req.body || {};
  const pedido = {
    id: Date.now(),
    mesa: p.mesa || 'Sin mesa',
    items: p.items || [],
    total: p.total || 0,
    hora: new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
    estado: 'pendiente'
  };
  if (SB) await sb('pedidos', 'POST', pedido);          /* Parche C: guarda en la nube */
  io.emit('nuevo-pendiente', pedido);
  console.log('📋 Pedido pendiente: ' + pedido.mesa + ' ($' + pedido.total + ')');
  res.json({ ok: true });
});

app.get('/api/pedidos', async (req, res) => {           /* Parche D: lee de la nube */
  if (!SB) return res.json([]);
  const rows = await sb('pedidos?order=creado.asc');
  res.json(rows);
});

app.post('/api/pedido-aprobar', async (req, res) => {   /* Parche E */
  const id = req.body.id;
  if (SB) {
    const rows = await sb('pedidos?id=eq.' + id);
    const p = rows[0];
    if (p && p.estado === 'pendiente') {
      await cambiarEstado(id, 'aprobado');
      p.estado = 'aprobado';
      io.emit('pedido-aprobado', p);
      console.log('✅ Aprobado: ' + p.mesa);
    }
  }
  res.json({ ok: true });
});

app.post('/api/pedido-rechazar', async (req, res) => {  /* Parche F */
  const id = req.body.id;
  if (SB) {
    await cambiarEstado(id, 'rechazado');
    io.emit('pedido-rechazado', { id: id });
    console.log('❌ Rechazado: ' + id);
  }
  res.json({ ok: true });
});

app.post('/api/pedido-listo', async (req, res) => {     /* Parche G */
  const id = req.body.id;
  if (SB) {
    await cambiarEstado(id, 'listo');
    io.emit('pedido-listo', { id: id });
  }
  res.json({ ok: true });
});

const server = app.listen(PORT, () => console.log('🍔 Bot de ' + LOCAL.nombre + ' en http://localhost:' + PORT));
const io = new Server(server, { cors: { origin: '*' } });
io.on('connection', () => console.log('🍳 Pantalla de cocina conectada'));

/* 🧹 Parche H: limpieza automática de pedidos de +30 días */
if (SB) {
  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  sb('pedidos?creado=lt.' + hace30, 'DELETE').then(() => console.log('🧹 Pedidos de +30 días eliminados'));
}




