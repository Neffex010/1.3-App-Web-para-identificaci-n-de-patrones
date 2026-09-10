
# Chat IA | Ciberseguridad 🛡️

**Práctica 1.2: Aplicaciones Web IA**

Aplicación web de inteligencia artificial especializada en Ciberseguridad y Tecnologías de la Información, desarrollada con una arquitectura cliente-servidor. El frontend proporciona una interfaz moderna, responsiva y segura, mientras que el backend gestiona la conexión con OpenAI de forma invisible para el usuario.

🔗 **[Ver proyecto en vivo](https://neffex010.github.io/1.2-aplicaciones-web-ia/)**

---

## 🚀 Características y Retos Completados

* **1. Especialización del Asistente:** El modelo está configurado vía backend mediante instrucciones de sistema para actuar exclusivamente como un experto en Ciberseguridad.
* **2. Contador en Tiempo Real:** Validación visual de caracteres dinámicos (0 / 1000).
* **3. Nueva Conversación:** Botón que limpia la interfaz gráfica y vacía la memoria sin necesidad de recargar la página.
* **4. Historial Conversacional:** Gestión de estado mediante arreglos en JavaScript que se envían al backend, permitiéndole a la IA tener "memoria" del contexto.
* **5. Manejo de Errores HTTP:** Alertas personalizadas en la interfaz según el código de estado devuelto por el servidor (ver tabla abajo).
* **6. Diseño Premium y UI/UX:**
  * Interfaz bloqueada sin scroll exterior, adaptada a dispositivos móviles.
  * Uso de **Bootstrap 5**, íconos de Bootstrap y Google Fonts (*Inter*).
  * Renderizado de formato Markdown usando la librería *Marked.js* para hacer legibles las listas y fragmentos de código.

---

## 🛠️ Stack Tecnológico

* **Frontend:** HTML5, CSS3, JavaScript (Vanilla).
* **Backend:** Python (Serverless Functions).
* **Despliegue:** GitHub Pages (Frontend) y Vercel (Backend).
* **Motor de IA:** OpenAI API (`gpt-4o-mini-2024-07-18`).

---

## 🚨 Códigos de Error (Reto 5)

La aplicación captura las excepciones del servidor y las traduce en mensajes amigables para el usuario.

| Código       | Estado HTTP           | Significado en nuestra aplicación                                                      |
| :------------ | :-------------------- | :-------------------------------------------------------------------------------------- |
| **400** | Bad Request           | El mensaje enviado está mal estructurado o vacío.                                     |
| **403** | Forbidden             | Problemas de acceso, generalmente origen (CORS) no autorizado o API Key inválida.      |
| **413** | Payload Too Large     | El usuario escribió un mensaje que supera el tamaño máximo permitido por el backend. |
| **500** | Internal Server Error | Hubo un fallo en el servidor de Vercel o los servidores de OpenAI están caídos.       |

---

## 👨‍💻 Autor

**Luis Enrique Cabrera Garcia**
*[Ver código fuente en GitHub](https://github.com/neffex010/1.2-aplicaciones-web-ia)*
