# 1.3 App Web para identificación de patrones

Aplicación Web de análisis visual con IA que recibe una imagen, identifica objetos o patrones repetitivos, estima la cantidad de elementos y devuelve la imagen con marcas visuales sobre cada objeto detectado.

**Práctica 1.3** — Inteligencia artificial aplicada a las TIC
Tecnológico Nacional de México, campus Pachuca
Ingeniería en Tecnologías de la Información y Comunicaciones

---

## Enlaces

|                           | URL                                                                      |
| ------------------------- | ------------------------------------------------------------------------ |
| **Aplicación Web** | https://neffex010.github.io/1.3-App-Web-para-identificaci-n-de-patrones/ |
| **Repositorio**     | https://github.com/Neffex010/1.3-App-Web-para-identificaci-n-de-patrones |
| **API (backend)**   | https://1-3-app-web-para-identificaci-n-de-sigma.vercel.app/api/vision   |

---

## Objetivo

Desarrollar y publicar una aplicación Web capaz de:

1. Recibir una imagen desde el navegador (archivo local o URL pública).
2. Analizarla con un modelo multimodal de OpenAI.
3. Identificar los objetos solicitados por el usuario en lenguaje natural.
4. Devolver un conteo estimado y la imagen con marcas visuales sobre cada objeto.

La arquitectura mantiene la `OPENAI_API_KEY` **fuera del navegador**, almacenada únicamente como variable de entorno en Vercel.

---

## Arquitectura



┌─────────────────────────┐ ┌──────────────────────────┐ ┌─────────────────┐
│ GitHub Pages │ │ Vercel Function │ │ OpenAI API │
│ (frontend estático) │─────▶│ (backend Python) │─────▶│ (GPT-5.6) │
│ │ JSON │ │ │ │
│ • index.html │ │ • api/vision.py │ │ • Visión │
│ • assets/css/styles │◀─────│ • OPENAI_API_KEY │◀─────│ • Coordenadas │
│ • assets/js/app.js │ │ • Pillow (dibujo) │ │ • Conteo │
└─────────────────────────┘ └──────────────────────────┘ └─────────────────┘


### Flujo de una petición

1. El usuario selecciona una imagen o pega una URL.
2. `app.js` convierte la imagen local a Data URL (Base64) usando `FileReader`.
3. Se envía `{ prompt, image }` por POST a `/api/vision`.
4. `vision.py` valida, redimensiona con Pillow y llama a GPT-5.6 Terra.
5. OpenAI devuelve coordenadas normalizadas (0.0 a 1.0) de cada objeto detectado.
6. Pillow dibuja círculos rojos sobre la imagen original.
7. El backend devuelve `{ count, image, razonamiento }` al frontend.
8. El frontend renderiza el conteo y la imagen marcada.

---

## Estructura del proyecto



### Flujo de una petición

1. El usuario selecciona una imagen o pega una URL.
2. `app.js` convierte la imagen local a Data URL (Base64) usando `FileReader`.
3. Se envía `{ prompt, image }` por POST a `/api/vision`.
4. `vision.py` valida, redimensiona con Pillow y llama a GPT-5.6 Terra.
5. OpenAI devuelve coordenadas normalizadas (0.0 a 1.0) de cada objeto detectado.
6. Pillow dibuja círculos rojos sobre la imagen original.
7. El backend devuelve `{ count, image, razonamiento }` al frontend.
8. El frontend renderiza el conteo y la imagen marcada.

---

## Estructura del proyecto

1.3 App Web para identificación de patrones/
│
├── api/
│ └── vision.py # Endpoint serverless en Python
│
├── assets/
│ ├── css/
│ │ └── styles.css # Estilos personalizados
│ └── js/
│ └── app.js # Lógica del frontend
│
├── .gitignore
├── .python-version # 3.12
├── index.html # Interfaz principal
├── README.md
├── requirements.txt # Dependencias Python
└── vercel.json # Configuración de despliegue


---
## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | HTML5, CSS3, JavaScript vanilla, Bootstrap 5, Bootstrap Icons |
| Backend | Python 3.12, `BaseHTTPRequestHandler` (stdlib) |
| Serverless | Vercel Functions |
| IA | OpenAI GPT-5.6 Terra (visión multimodal) |
| Procesamiento de imagen | Pillow |
| Despliegue frontend | GitHub Pages |
| Control de versiones | Git + GitHub |

**Sin frameworks de JavaScript.** No se utilizó Node.js, npm, React, Angular, Vue ni Next.js.
---
## Variables de entorno (Vercel)

Configuradas en **Vercel → Settings → Environment Variables**:

| Variable           | Descripción                                                   |
| ------------------ | -------------------------------------------------------------- |
| `OPENAI_API_KEY` | Clave de API de OpenAI.**Nunca se expone al navegador.** |
| `ALLOWED_ORIGIN` | Origen autorizado para CORS (`https://neffex010.github.io`). |

> **Importante**: Ninguna de estas variables está incluida en el repositorio. El código solo hace `os.environ.get(...)` para leerlas en tiempo de ejecución.

---

## Despliegue local (opcional)

Si quieres correr el proyecto en tu propia máquina:

### Requisitos

- Python 3.12 o superior
- Cuenta de Vercel (para el backend)
- API Key de OpenAI

### Pasos

```bash
# 1. Clonar el repositorio
git clone https://github.com/Neffex010/1.3-App-Web-para-identificaci-n-de-patrones.git
cd 1.3-App-Web-para-identificaci-n-de-patrones

# 2. Crear entorno virtual (opcional pero recomendado)
python -m venv .venv
.venv\Scripts\activate         # Windows
# source .venv/bin/activate    # macOS / Linux

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Configurar variables de entorno
#    Crea un archivo .env con:
#    OPENAI_API_KEY=sk-...
#    ALLOWED_ORIGIN=http://localhost:8000

# 5. Servir el frontend
python -m http.server 8000
# Abrir http://localhost:8000 en el navegador
```
