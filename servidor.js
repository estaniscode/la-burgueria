const express = require('express');
const path = require('path');
require('dotenv').config();
const app = express();
const PORT = process.env.PORT || 3001;
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
    const { mensaje, historial } = req.body;
    const messages = [{ role: 'system', content: cerebro() }];
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
app.listen(PORT, () => console.log('🍔 Bot de ' + LOCAL.nombre + ' en http://localhost:' + PORT));




