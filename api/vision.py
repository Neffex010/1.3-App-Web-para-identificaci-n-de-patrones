import json
import os
import base64
import io
import urllib.request
from http.server import BaseHTTPRequestHandler
from openai import OpenAI
from PIL import Image, ImageDraw

# ---------- Configuración por entorno ----------
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "").rstrip("/")
APP_KEY = os.environ.get("APP_KEY")  # Opcional: si existe, se exige cabecera X-App-Key

# ---------- Límites ----------
MAX_IMAGE_BYTES = 5_000_000     # 5 MB
MAX_DIMENSION   = 2048          # lado máximo tras redimensión
OPENAI_TIMEOUT  = 25.0          # segundos
MODEL_NAME      = "gpt-5.6-terra"


class handler(BaseHTTPRequestHandler):

    # -------- CORS --------
    def add_cors_headers(self):
        origin = self.headers.get("Origin", "")
        if ALLOWED_ORIGIN and origin == ALLOWED_ORIGIN:
            self.send_header("Access-Control-Allow-Origin", origin)
        elif not ALLOWED_ORIGIN:
            self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Vary", "Origin")

    # -------- Respuesta JSON --------
    def send_json(self, status_code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.add_cors_headers()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # -------- Preflight --------
    def do_OPTIONS(self):
        self.send_response(204)
        self.add_cors_headers()
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-App-Key")
        self.end_headers()

    # -------- POST principal --------
    def do_POST(self):
        response_text = ""  # Inicializado para evitar NameError en except
        try:
            # --- 0. Autenticación opcional ---
            if APP_KEY and self.headers.get("X-App-Key") != APP_KEY:
                self.send_json(403, {"error": "No autorizado. Falta X-App-Key válida."})
                return

            # --- 1. Parsear payload ---
            content_length = int(self.headers.get("Content-Length", 0))
            if content_length <= 0:
                self.send_json(400, {"error": "Payload vacío."})
                return

            body = self.rfile.read(content_length)
            data = json.loads(body.decode("utf-8"))

            image_payload = data.get("image")
            prompt_text   = data.get("prompt")

            if not image_payload or not prompt_text:
                self.send_json(400, {"error": "Petición malformada. Se requiere imagen y texto."})
                return

            # --- 2. Obtener bytes de la imagen (URL o Base64) ---
            is_url = isinstance(image_payload, str) and (
                image_payload.startswith("http://") or image_payload.startswith("https://")
            )

            if is_url:
                req = urllib.request.Request(
                    image_payload,
                    headers={"User-Agent": "Mozilla/5.0"}
                )
                with urllib.request.urlopen(req, timeout=10) as response:
                    image_bytes = response.read()
            else:
                if "," in image_payload:
                    _, b64_data = image_payload.split(",", 1)
                else:
                    b64_data = image_payload
                image_bytes = base64.b64decode(b64_data)

            # --- 3. Validar tamaño en bytes ---
            if len(image_bytes) > MAX_IMAGE_BYTES:
                self.send_json(413, {
                    "error": f"Imagen demasiado grande ({len(image_bytes) // 1024} KB). "
                             f"Máximo permitido: {MAX_IMAGE_BYTES // 1_000_000} MB."
                })
                return

            # --- 4. Normalizar y redimensionar ---
            try:
                img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            except Exception:
                self.send_json(400, {"error": "El archivo no es una imagen válida o está corrupto."})
                return

            img.thumbnail((MAX_DIMENSION, MAX_DIMENSION), Image.LANCZOS)

            buf = io.BytesIO()
            img.save(buf, "JPEG", quality=88)
            image_bytes = buf.getvalue()

            b64_data = base64.b64encode(image_bytes).decode("utf-8")
            openai_image_url = f"data:image/jpeg;base64,{b64_data}"

            # --- 5. Llamada a OpenAI con esquema estricto ---
            client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

            sys_prompt = (
                "Eres un experto en visión computacional especializado en detección exhaustiva. "
                "Tu tarea es localizar TODOS los objetos del tipo solicitado, sin omitir ninguno. "
                "Procedimiento obligatorio:\n"
                "1) Escanea la imagen mentalmente en 4 cuadrantes (superior-izquierdo, superior-derecho, "
                "inferior-izquierdo, inferior-derecho). Revisa cada uno de forma independiente.\n"
                "2) Presta especial atención a: objetos al fondo, objetos parcialmente ocluidos por otros, "
                "objetos cortados por el borde, objetos de color similar al fondo.\n"
                "3) Los objetos agrupados o superpuestos CUENTAN individualmente.\n"
                "4) En el campo 'razonamiento' describe brevemente qué viste en cada cuadrante y el total.\n"
                "5) En el campo 'puntos' devuelve las coordenadas 'x' e 'y' normalizadas (0.000 a 1.000) "
                "del centro de CADA objeto detectado. (0,0) es la esquina superior izquierda. "
                "El número de puntos DEBE coincidir con el conteo que reportaste en 'razonamiento'."
            )

            response = client.chat.completions.create(
                model=MODEL_NAME,
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": "deteccion",
                        "strict": True,
                        "schema": {
                            "type": "object",
                            "properties": {
                                "razonamiento": {"type": "string"},
                                "puntos": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "x": {"type": "number"},
                                            "y": {"type": "number"}
                                        },
                                        "required": ["x", "y"],
                                        "additionalProperties": False
                                    }
                                }
                            },
                            "required": ["razonamiento", "puntos"],
                            "additionalProperties": False
                        }
                    }
                },
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": f"Localiza y mapea exhaustivamente: {prompt_text}"},
                            {"type": "image_url",
                             "image_url": {"url": openai_image_url, "detail": "high"}}
                        ]
                    }
                ],
                max_completion_tokens=2000,  # Nota: 'max_completion_tokens' es el parámetro correcto para GPT-5.6
                temperature=0.0,
                reasoning_effort="high",
                timeout=OPENAI_TIMEOUT
            )

            response_text = (response.choices[0].message.content or "").strip()
            if not response_text:
                self.send_json(500, {"error": "El modelo no devolvió contenido."})
                return

            parsed_json = json.loads(response_text)
            coords = parsed_json.get("puntos", [])
            razonamiento = parsed_json.get("razonamiento", "")

            # --- 6. Dibujar marcadores ---
            width, height = img.size
            draw = ImageDraw.Draw(img)
            radius = max(width, height) * 0.015

            for point in coords:
                try:
                    cx = float(point.get("x", 0)) * width
                    cy = float(point.get("y", 0)) * height
                except (TypeError, ValueError):
                    continue

                draw.ellipse(
                    [(cx - radius, cy - radius), (cx + radius, cy + radius)],
                    outline="#ff0000",
                    width=max(2, int(radius * 0.3))
                )
                dot_r = radius * 0.3
                draw.ellipse(
                    [(cx - dot_r, cy - dot_r), (cx + dot_r, cy + dot_r)],
                    fill="#ff0000"
                )

            out_buffer = io.BytesIO()
            img.save(out_buffer, format="JPEG", quality=90)
            out_b64 = base64.b64encode(out_buffer.getvalue()).decode("utf-8")

            self.send_json(200, {
                "count": len(coords),
                "image": f"data:image/jpeg;base64,{out_b64}",
                "razonamiento": razonamiento
            })

        except json.JSONDecodeError as e:
            self.send_json(500, {
                "error": f"Fallo al parsear JSON del modelo. Detalles: {str(e)}. "
                         f"Payload recibido: {response_text[:300]}"
            })
        except Exception as e:
            self.send_json(500, {"error": f"{type(e).__name__}: {str(e)}"})