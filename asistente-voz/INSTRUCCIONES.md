# Asistente de voz para iPhone (gratis)

**Cómo funciona:** le hablas a Siri → el Atajo manda tu frase a tu script de Google → Gemini (IA gratis de Google) entiende qué quieres → el script lo hace en tu Google (Hojas, Calendar, Gmail) → Siri te lee la respuesta.

Todo es gratis: Apps Script, Gemini (plan gratuito) y Atajos de iPhone.

---

## Paso 1 — Clave gratis de Gemini (2 min)

1. Entra a **aistudio.google.com/apikey** con tu cuenta de Google.
2. Toca **Create API key** (Crear clave) y copia la clave (empieza con `AIza…`).

> Plan gratuito: alcanza de sobra para uso personal (varios cientos de órdenes al día). Si en algún momento se pasa del límite, el asistente te dirá "prueba en un rato". Ojo: en el plan gratis, Google puede usar lo que mandas para mejorar sus modelos, así que no le dictes contraseñas ni datos sensibles.

## Paso 2 — El script en Google (5 min, mejor desde la computadora)

1. Entra a **script.google.com** → **Nuevo proyecto**. Ponle de nombre `Asistente de voz`.
2. Borra lo que hay y pega todo el contenido de `Codigo.gs`.
3. ⚙️ **Configuración del proyecto** → **Zona horaria**: elige la tuya (p. ej. `(GMT-05:00) Hora del Este`).
4. En el código, en la función `configurar`, reemplaza `PEGA_AQUI_TU_CLAVE_DE_GEMINI` por tu clave. Guarda (💾).
5. Arriba, elige la función **configurar** y toca **Ejecutar**. Google te pedirá permisos: **Revisar permisos** → tu cuenta → **Configuración avanzada** → **Ir a Asistente de voz** → **Permitir**.
6. Abajo, en el **Registro**, copia la línea **CLAVE PARA EL ATAJO DEL IPHONE**. También verás el link de tu nueva hoja **Asistente de voz** (con las pestañas Gastos, Notas y Contactos).
7. Vuelve a dejar `PEGA_AQUI_TU_CLAVE_DE_GEMINI` en el código y guarda. La clave ya quedó guardada en el proyecto y así no queda a la vista.
8. (Opcional) Prueba sin el teléfono: elige la función **probar** → Ejecutar → mira el Registro y la pestaña Gastos.
9. **Implementar** → **Nueva implementación** → ⚙️ tipo **Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
   - **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).

> "Cualquier usuario" es necesario para que el iPhone pueda llamarlo sin iniciar sesión. Nadie puede usarlo sin tu clave del paso 6.

## Paso 3 — El Atajo en el iPhone (5 min)

Abre la app **Atajos** → **+** (nuevo atajo) → nómbralo **Mi asistente**. Agrega estas acciones en orden (búscalas con la barra de abajo):

1. **Dictar texto**: idioma *Español*, Dejar de escuchar: *Después de una pausa*.
2. **Obtener contenido de URL**:
   - URL: tu URL `/exec`
   - Toca la flecha ▸ → Método: **POST** → Cuerpo de solicitud: **JSON**
   - Agrega campo **Texto**: clave `texto`, valor → la variable **Texto dictado**
   - Agrega campo **Texto**: clave `clave`, valor → tu clave del paso 2.6
3. **Obtener valor del diccionario**: Valor de la clave `abrir` en *Contenido de la URL*.
4. **Si** *Valor del diccionario* **tiene algún valor** → dentro: **Abrir URL** (con *Valor del diccionario*). → **Fin de Si**.
5. **Obtener valor del diccionario**: Valor de la clave `respuesta` en *Contenido de la URL*.
6. **Pronunciar texto**: *Valor del diccionario* (idioma Español).
7. (Opcional, para que siga escuchando cuando te hace una pregunta) **Obtener valor del diccionario**: clave `seguir` en *Contenido de la URL* → **Si** *Valor del diccionario* **tiene algún valor** → **Ejecutar atajo** *Mi asistente* → **Fin de Si**.

Listo. Ahora:

- Di **"Oye Siri, Mi asistente"** y habla cuando suene.
- O asígnalo al **Botón de Acción** (Ajustes → Botón de Acción → Atajo), o a **Tocar atrás** (Ajustes → Accesibilidad → Tocar → Tocar atrás → Doble toque).
- Puedes ponerlo en la pantalla de inicio desde el menú del atajo → **Añadir a pantalla de inicio**.

## Qué le puedes decir (lenguaje libre)

| Tarea | Ejemplo |
|---|---|
| Gastos | "Gasté 45 dólares en materiales en Home Depot" · "¿Cuánto llevo gastado este mes en gasolina?" |
| Calendario | "Ponme una cita con el inspector el jueves a las 9 en la obra de Raleigh" · "¿Qué tengo mañana?" |
| Recordatorios | "Recuérdame el viernes a las 7 de la mañana llamar a la ciudad" (crea evento con aviso) |
| Correos | "Léeme mis correos nuevos" · "¿Me escribió Duke Energy esta semana?" · "Escríbele a Ana un correo diciendo que mañana mando la factura" (queda en Borradores) |
| WhatsApp | "Mándale un WhatsApp a Juan diciendo que voy tarde" (abre WhatsApp con el mensaje listo, solo tocas enviar) |
| Contactos | "Guarda el contacto Juan con el número 919 555 1234" |
| Notas | "Anota que hay que comprar cinta de marcar" · "¿Qué pendientes tengo?" |
| Tickets 811 | "Registra un ticket 811 para el trabajo Oak Street, 120 Oak St Cary, excavar desde el poste hasta la casa, para el lunes" |
| Preguntas | "¿Cuánto es 15 % de 340?" · "¿Cómo se dice *zanja* en inglés?" |
| Reiniciar | "Nueva conversación" (olvida lo que hablaron; si no, recuerda 10 minutos) |

## Ajustes opcionales (Configuración del proyecto → Propiedades del script)

- `TICKETS_ID`: el ID de tu hoja **Tickets 811** (lo que va entre `/d/` y `/edit` en su link). Así los tickets dictados quedan en una pestaña nueva **Tickets por crear (voz)** dentro de esa hoja. No toca tus otras pestañas.
- `PAIS`: código de país para números de 10 dígitos (por defecto `1`, EE. UU.; Colombia sería `57`).
- `MODELO`: modelo de Gemini (por defecto `gemini-flash-latest`).
- Para que use tus **contactos de Google**: en el editor, **Servicios +** → **People API** → Agregar. Si no, usa la pestaña Contactos de la hoja.

## Cuando cambies el código

**Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión → Implementar.** Así la URL sigue siendo la misma y no hay que tocar el Atajo.

## Si algo falla

- Siri dice "La clave del atajo no es correcta": revisa el campo `clave` del Atajo.
- "Falta la clave de Gemini": vuelve a hacer el paso 2.4–2.5.
- El Atajo muestra una página de Google en vez de responder: la implementación no está en *Cualquier usuario*, o usaste la URL que termina en `/dev` en vez de `/exec`.
