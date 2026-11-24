/*******************************************************************
 * ASISTENTE DE VOZ (gratis) — Google Apps Script + Gemini
 *
 * El iPhone (Atajo + Siri) manda lo que dijiste a este script.
 * Gemini entiende la frase y decide qué hacer; este script lo hace
 * en tu Google (Hojas, Calendar, Gmail) y devuelve la respuesta
 * que Siri te lee en voz alta.
 *
 * Primera vez: pega tu clave de Gemini en configurar(), ejecútala,
 * y después borra la clave de aquí (queda guardada en el proyecto).
 *******************************************************************/

const P = PropertiesService.getScriptProperties();

function configurar() {
  const GEMINI_KEY = 'PEGA_AQUI_TU_CLAVE_DE_GEMINI';
  if (GEMINI_KEY && GEMINI_KEY.indexOf('PEGA_AQUI') !== 0) P.setProperty('GEMINI_KEY', GEMINI_KEY.trim());
  if (!P.getProperty('CLAVE')) P.setProperty('CLAVE', Utilities.getUuid().replace(/-/g, '').slice(0, 10));
  const libro = libro_();
  Logger.log('Clave de Gemini guardada: ' + (P.getProperty('GEMINI_KEY') ? 'SI' : 'NO (pégala arriba)'));
  Logger.log('CLAVE PARA EL ATAJO DEL IPHONE: ' + P.getProperty('CLAVE'));
  Logger.log('Tu hoja del asistente: ' + libro.getUrl());
}

/** Prueba sin el iPhone: cambia la frase y ejecuta. Mira el resultado en el Registro. */
function probar() {
  Logger.log(JSON.stringify(conversar_('Anota un gasto de 20 dólares en gasolina'), null, 2));
}

/* ======================= Entrada desde el iPhone ======================= */

function doPost(e) {
  let b = {};
  try { b = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) {}
  return json_(atender_(b));
}

function doGet() {
  return json_({ respuesta: 'El asistente está activo.' });
}

function atender_(b) {
  if (!b.clave || String(b.clave).trim() !== P.getProperty('CLAVE')) return { respuesta: 'La clave del atajo no es correcta.' };
  const texto = String(b.texto || '').trim();
  if (!texto) return { respuesta: 'No te escuché. Inténtalo otra vez.' };
  try { return conversar_(texto); }
  catch (err) { return { respuesta: 'Hubo un problema: ' + err.message }; }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ======================= Conversación con Gemini ======================= */

function conversar_(texto) {
  const cache = CacheService.getScriptCache();
  let hist = [];
  if (/^(nueva conversaci[oó]n|olvida( todo)?|empecemos de nuevo)/i.test(texto)) {
    cache.remove('hist');
    return { respuesta: 'Listo, empezamos de cero.', abrir: '', seguir: false };
  }
  try { hist = JSON.parse(cache.get('hist') || '[]'); } catch (x) { hist = []; }
  hist.push({ role: 'user', parts: [{ text: texto }] });

  const salida = { abrir: '' };
  let respuesta = '';
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const r = gemini_(hist);
    const c = r.candidates && r.candidates[0] && r.candidates[0].content;
    if (!c || !c.parts) { respuesta = 'No pude procesar eso. Dilo de otra forma.'; break; }
    c.role = 'model';
    hist.push(c);
    const llamadas = c.parts.filter(p => p.functionCall);
    if (!llamadas.length) {
      respuesta = c.parts.filter(p => p.text && !p.thought).map(p => p.text).join(' ').trim();
      break;
    }
    hist.push({
      role: 'user',
      parts: llamadas.map(p => {
        let res;
        try { res = ejecutar_(p.functionCall.name, p.functionCall.args || {}, salida); }
        catch (err) { res = { error: err.message }; }
        return { functionResponse: { name: p.functionCall.name, response: res } };
      })
    });
  }

  respuesta = limpiar_(respuesta) || 'Listo.';
  try { cache.put('hist', JSON.stringify(recortar_(hist)), 600); } catch (x) { cache.remove('hist'); }
  return { respuesta: respuesta, abrir: salida.abrir || '', seguir: /\?\s*$/.test(respuesta) };
}

// Guarda solo lo último (10 min de memoria), empezando siempre por algo que dijiste tú.
function recortar_(h) {
  h = h.slice(-16);
  while (h.length && !(h[0].role === 'user' && h[0].parts.some(p => p.text))) h.shift();
  return JSON.stringify(h).length > 90000 ? [] : h;
}

function limpiar_(t) {
  return String(t || '').replace(/[*_#`>]/g, '').replace(/\s+/g, ' ').trim();
}

function gemini_(contents) {
  const key = P.getProperty('GEMINI_KEY');
  if (!key) throw new Error('falta la clave de Gemini. Ejecuta configurar en el script.');
  const modelo = P.getProperty('MODELO') || 'gemini-flash-latest';
  const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' + modelo + ':generateContent', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': key },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      systemInstruction: { parts: [{ text: sistema_() }] },
      contents: contents,
      tools: [{ functionDeclarations: HERRAMIENTAS }],
      generationConfig: { temperature: 0.3 }
    })
  });
  const code = res.getResponseCode();
  if (code === 429) throw new Error('se acabó el uso gratis por este minuto o por hoy. Prueba en un rato.');
  if (code >= 300) throw new Error('Gemini respondió ' + code + '. ' + res.getContentText().slice(0, 150));
  return JSON.parse(res.getContentText());
}

function sistema_() {
  const tz = Session.getScriptTimeZone();
  const ahora = new Date();
  return [
    'Eres el asistente personal de voz del usuario. Hablas español, en tono cercano y breve.',
    'Tu respuesta se lee en voz alta: máximo 2 o 3 frases, sin listas, sin emojis, sin símbolos ni formato.',
    'Fecha y hora actual: ' + Utilities.formatDate(ahora, tz, "yyyy-MM-dd'T'HH:mm:ssXXX") + ' (zona ' + tz + ').',
    'Usa las herramientas para hacer lo que pide. Las fechas que pases a las herramientas van en formato ISO con la zona horaria, por ejemplo 2026-05-03T15:00:00-04:00.',
    'Si dice "mañana a las 3" sin a.m. o p.m., asume la hora más lógica (3 de la tarde). Si un evento no tiene duración, dura 1 hora.',
    'Si falta un dato imprescindible, pregúntalo en una frase corta. No pidas datos que puedes suponer.',
    'Para WhatsApp: el teléfono abrirá WhatsApp con el mensaje escrito y el usuario solo toca enviar. Díselo así.',
    'Para correos: lee remitente y asunto, y resume el contenido en pocas palabras.',
    'Si no tienes una herramienta para lo que pide, responde con lo que sabes o dile qué no puedes hacer todavía.',
    'Al terminar, confirma en pocas palabras lo que hiciste.'
  ].join('\n');
}

/* ======================= Herramientas (lo que sabe hacer) ======================= */

const S = 'STRING', N = 'NUMBER', I = 'INTEGER', B = 'BOOLEAN';
function obj_(props, req) { return { type: 'OBJECT', properties: props, required: req || [] }; }

const HERRAMIENTAS = [
  { name: 'anotar_gasto', description: 'Anota un gasto en la hoja de gastos.',
    parameters: obj_({ monto: { type: N }, moneda: { type: S, description: 'USD, COP, EUR... por defecto USD' },
      categoria: { type: S, description: 'gasolina, comida, materiales, casa, etc.' }, descripcion: { type: S },
      fecha: { type: S, description: 'ISO; por defecto ahora' } }, ['monto']) },
  { name: 'resumen_gastos', description: 'Suma los gastos de un periodo, opcionalmente de una categoría.',
    parameters: obj_({ periodo: { type: S, enum: ['hoy', 'semana', 'mes', 'año'] }, categoria: { type: S } }, ['periodo']) },
  { name: 'crear_evento', description: 'Crea un evento o recordatorio en Google Calendar.',
    parameters: obj_({ titulo: { type: S }, inicio: { type: S, description: 'ISO' }, fin: { type: S, description: 'ISO' },
      todo_el_dia: { type: B }, lugar: { type: S }, descripcion: { type: S },
      aviso_minutos: { type: I, description: 'minutos antes para avisar; por defecto 15' } }, ['titulo', 'inicio']) },
  { name: 'ver_agenda', description: 'Lista los eventos del calendario entre dos fechas.',
    parameters: obj_({ desde: { type: S, description: 'ISO' }, hasta: { type: S, description: 'ISO' } }, ['desde', 'hasta']) },
  { name: 'leer_correos', description: 'Busca correos en Gmail. Por defecto los no leídos de la bandeja de entrada.',
    parameters: obj_({ busqueda: { type: S, description: 'búsqueda de Gmail, p.ej. "is:unread in:inbox" o "from:juan"' },
      cantidad: { type: I, description: 'máximo 10, por defecto 5' } }) },
  { name: 'borrador_correo', description: 'Deja un correo escrito en Borradores de Gmail (no lo envía).',
    parameters: obj_({ para: { type: S, description: 'correo o nombre de un contacto' }, asunto: { type: S }, cuerpo: { type: S } }, ['para', 'cuerpo']) },
  { name: 'enviar_whatsapp', description: 'Prepara un mensaje de WhatsApp para un contacto o número.',
    parameters: obj_({ contacto: { type: S, description: 'nombre o número' }, mensaje: { type: S } }, ['contacto', 'mensaje']) },
  { name: 'guardar_contacto', description: 'Guarda o actualiza un contacto (nombre, teléfono, correo).',
    parameters: obj_({ nombre: { type: S }, telefono: { type: S }, correo: { type: S } }, ['nombre']) },
  { name: 'anotar_nota', description: 'Guarda una nota, idea o pendiente.',
    parameters: obj_({ texto: { type: S }, tipo: { type: S, description: 'nota, idea, pendiente, compra' } }, ['texto']) },
  { name: 'leer_notas', description: 'Lee las últimas notas o pendientes guardados.',
    parameters: obj_({ tipo: { type: S }, cantidad: { type: I } }) },
  { name: 'registrar_ticket_811', description: 'Apunta un ticket 811 que hay que crear (dirección, trabajo, qué se va a excavar).',
    parameters: obj_({ trabajo: { type: S, description: 'nombre o número del trabajo' }, direccion: { type: S },
      descripcion: { type: S, description: 'qué y dónde se excava' }, fecha: { type: S, description: 'para cuándo, ISO' } }, ['direccion']) }
];

function ejecutar_(nombre, a, salida) {
  const tz = Session.getScriptTimeZone();
  const fmt = d => Utilities.formatDate(d, tz, "EEE d MMM yyyy, h:mm a");

  switch (nombre) {
    case 'anotar_gasto': {
      const h = hoja_('Gastos');
      const fecha = a.fecha ? new Date(a.fecha) : new Date();
      h.appendRow([fecha, Number(a.monto), (a.moneda || 'USD').toUpperCase(), a.categoria || '', a.descripcion || '']);
      return { ok: true, total_mes: sumar_('mes', '', (a.moneda || 'USD').toUpperCase()) };
    }
    case 'resumen_gastos':
      return { total: sumar_(a.periodo, a.categoria || ''), moneda: 'USD' , nota: 'solo suma gastos en USD' };

    case 'crear_evento': {
      const cal = CalendarApp.getDefaultCalendar();
      const ini = new Date(a.inicio);
      if (isNaN(ini)) throw new Error('fecha de inicio inválida');
      const op = { location: a.lugar || '', description: a.descripcion || '' };
      let ev;
      if (a.todo_el_dia) ev = cal.createAllDayEvent(a.titulo, ini, op);
      else {
        const fin = a.fin ? new Date(a.fin) : new Date(ini.getTime() + 3600000);
        ev = cal.createEvent(a.titulo, ini, fin, op);
      }
      ev.removeAllReminders();
      ev.addPopupReminder(a.aviso_minutos != null ? Number(a.aviso_minutos) : 15);
      return { ok: true, titulo: a.titulo, cuando: fmt(ini) };
    }
    case 'ver_agenda': {
      const evs = CalendarApp.getDefaultCalendar().getEvents(new Date(a.desde), new Date(a.hasta)).slice(0, 15);
      return { eventos: evs.map(e => ({ titulo: e.getTitle(), inicio: e.isAllDayEvent() ? 'todo el día' : fmt(e.getStartTime()), lugar: e.getLocation() })) };
    }
    case 'leer_correos': {
      const n = Math.min(Number(a.cantidad) || 5, 10);
      const hilos = GmailApp.search(a.busqueda || 'is:unread in:inbox', 0, n);
      return { correos: hilos.map(t => {
        const m = t.getMessages().pop();
        return { de: m.getFrom().replace(/<.*>/, '').trim(), asunto: m.getSubject(), fecha: fmt(m.getDate()),
          texto: m.getPlainBody().replace(/\s+/g, ' ').slice(0, 400) };
      }) };
    }
    case 'borrador_correo': {
      let para = a.para;
      if (para.indexOf('@') < 0) {
        const c = buscarContacto_(para);
        if (!c || !c.correo) return { error: 'No tengo el correo de ' + para + '. Dímelo o guárdalo como contacto.' };
        para = c.correo;
      }
      GmailApp.createDraft(para, a.asunto || '(sin asunto)', a.cuerpo);
      return { ok: true, para: para, nota: 'Quedó en Borradores, sin enviar.' };
    }
    case 'enviar_whatsapp': {
      let tel = soloDigitos_(a.contacto);
      if (tel.length < 7) {
        const c = buscarContacto_(a.contacto);
        if (!c || !c.telefono) return { error: 'No tengo el número de ' + a.contacto + '. Dime el número o di: guarda el contacto ' + a.contacto + ' con el número tal.' };
        tel = c.telefono;
      }
      tel = conPais_(tel);
      salida.abrir = 'whatsapp://send?phone=' + tel + '&text=' + encodeURIComponent(a.mensaje);
      return { ok: true, numero: tel };
    }
    case 'guardar_contacto': {
      const h = hoja_('Contactos');
      const filas = h.getDataRange().getValues();
      const clave = norm_(a.nombre);
      for (let i = 1; i < filas.length; i++) {
        if (norm_(filas[i][0]) === clave) {
          if (a.telefono) h.getRange(i + 1, 2).setValue("'" + conPais_(soloDigitos_(a.telefono)));
          if (a.correo) h.getRange(i + 1, 3).setValue(a.correo);
          return { ok: true, actualizado: true };
        }
      }
      h.appendRow([a.nombre, a.telefono ? "'" + conPais_(soloDigitos_(a.telefono)) : '', a.correo || '']);
      return { ok: true };
    }
    case 'anotar_nota':
      hoja_('Notas').appendRow([new Date(), a.tipo || 'nota', a.texto]);
      return { ok: true };
    case 'leer_notas': {
      let filas = hoja_('Notas').getDataRange().getValues().slice(1);
      if (a.tipo) filas = filas.filter(f => norm_(f[1]) === norm_(a.tipo));
      return { notas: filas.slice(-(Number(a.cantidad) || 5)).map(f => f[1] + ': ' + f[2]) };
    }
    case 'registrar_ticket_811': {
      const id = P.getProperty('TICKETS_ID');
      const libro = id ? SpreadsheetApp.openById(id) : libro_();
      const h = hoja_('Tickets por crear (voz)', libro);
      h.appendRow([new Date(), a.trabajo || '', a.direccion, a.descripcion || '', a.fecha ? new Date(a.fecha) : '', 'Pendiente']);
      return { ok: true, nota: 'Quedó en la pestaña Tickets por crear (voz).' };
    }
  }
  return { error: 'No sé hacer ' + nombre };
}

/* ======================= Hojas y ayudas ======================= */

const ENCABEZADOS = {
  'Gastos': ['Fecha', 'Monto', 'Moneda', 'Categoría', 'Descripción'],
  'Notas': ['Fecha', 'Tipo', 'Texto'],
  'Contactos': ['Nombre', 'Teléfono (con código de país)', 'Correo'],
  'Tickets por crear (voz)': ['Registrado', 'Trabajo', 'Dirección', 'Descripción', 'Para cuándo', 'Estado']
};

function libro_() {
  const id = P.getProperty('DATOS_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (x) {} }
  const libro = SpreadsheetApp.create('Asistente de voz');
  P.setProperty('DATOS_ID', libro.getId());
  ['Gastos', 'Notas', 'Contactos'].forEach(n => hoja_(n, libro));
  const sobra = libro.getSheetByName('Hoja 1') || libro.getSheetByName('Sheet1');
  if (sobra && libro.getSheets().length > 1) libro.deleteSheet(sobra);
  return libro;
}

function hoja_(nombre, libro) {
  libro = libro || libro_();
  let h = libro.getSheetByName(nombre);
  if (!h) {
    h = libro.insertSheet(nombre);
    h.appendRow(ENCABEZADOS[nombre]);
    h.setFrozenRows(1);
    h.getRange(1, 1, 1, ENCABEZADOS[nombre].length).setFontWeight('bold');
  }
  return h;
}

function sumar_(periodo, categoria, moneda) {
  const tz = Session.getScriptTimeZone();
  const hoy = new Date(Utilities.formatDate(new Date(), tz, 'yyyy/MM/dd'));
  let desde = new Date(hoy);
  if (periodo === 'semana') desde.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
  else if (periodo === 'mes') desde.setDate(1);
  else if (periodo === 'año') desde = new Date(hoy.getFullYear(), 0, 1);
  const cat = norm_(categoria);
  return hoja_('Gastos').getDataRange().getValues().slice(1)
    .filter(f => f[0] instanceof Date && f[0] >= desde && String(f[2]).toUpperCase() === (moneda || 'USD')
      && (!cat || norm_(f[3]).indexOf(cat) >= 0))
    .reduce((s, f) => s + (Number(f[1]) || 0), 0);
}

function buscarContacto_(nombre) {
  const q = norm_(nombre);
  const filas = hoja_('Contactos').getDataRange().getValues().slice(1);
  const f = filas.find(r => norm_(r[0]) === q) || filas.find(r => norm_(r[0]).indexOf(q) >= 0);
  if (f) return { telefono: soloDigitos_(f[1]), correo: String(f[2] || '') };
  // Si activaste el servicio "People API", también busca en tus contactos de Google.
  try {
    const r = People.People.searchContacts({ query: nombre, readMask: 'names,phoneNumbers,emailAddresses' });
    const p = r.results && r.results[0] && r.results[0].person;
    if (p) return { telefono: soloDigitos_(p.phoneNumbers && p.phoneNumbers[0] && p.phoneNumbers[0].value),
                    correo: (p.emailAddresses && p.emailAddresses[0] && p.emailAddresses[0].value) || '' };
  } catch (x) {}
  return null;
}

function soloDigitos_(t) { return String(t || '').replace(/\D/g, ''); }
// Números de 10 dígitos sin código de país: se les pone el de PAIS (por defecto 1 = EE. UU.).
function conPais_(tel) { return tel.length === 10 ? (P.getProperty('PAIS') || '1') + tel : tel; }
function norm_(t) { return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
