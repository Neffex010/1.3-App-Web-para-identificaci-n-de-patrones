import json
import os
import base64
import io
import urllib.request
from http.server import BaseHTTPRequestHandler
from openai import OpenAI
from PIL import Image, ImageDraw

ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "").rstrip("/")

class handler(BaseHTTPRequestHandler):
    def add_cors_headers(self):
        origin = self.headers.get("Origin", "")
        if ALLOWED_ORIGIN and origin == ALLOWED_ORIGIN:
            self.send_header("Access-Control-Allow-Origin", origin)
        elif not ALLOWED_ORIGIN:
            self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Vary", "Origin")

    def send_json(self, status_code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.add_cors_headers()
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.add_cors_headers()
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            data = json.loads(body.decode("utf-8"))

            image_payload = data.get("image")
            prompt_text = data.get("prompt")

            if not image_payload or not prompt_text:
                self.send_json(400, {"error": "Petición malformada. Se requiere imagen y texto."})
                return

            client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
            is_url = image_payload.startswith("http://") or image_payload.startswith("https://")

            if is_url:
                openai_image_url = image_payload
                req = urllib.request.Request(image_payload, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as response:
                    image_bytes = response.read()
            else:
                if "," in image_payload:
                    _, b64_data = image_payload.split(",", 1)
                else:
                    b64_data = image_payload
                
                openai_image_url = f"data:image/jpeg;base64,{b64_data}"
                image_bytes = base64.b64decode(b64_data)

            # PROMPT ESTRICTO PARA MÁXIMA PRECISIÓN
            sys_prompt = (
                "Eres un modelo experto en visión computacional de alta precisión. "
                "Tu tarea es analizar la imagen y ubicar el CENTRO EXACTO de cada elemento solicitado. "
                "Devuelve ÚNICAMENTE un array JSON válido con las coordenadas 'x' e 'y' normalizadas (de 0.000 a 1.000). "
                "Ejemplo estricto: [{\"x\": 0.512, \"y\": 0.498}]. "
                "Si un elemento está ocluido o no es claro, omítelo. Si no hay elementos, devuelve []. "
                "NO devuelvas texto, markdown, ni explicaciones adicionales."
            )

            # ANÁLISIS EN ALTA RESOLUCIÓN (detail: "high")
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": f"Mapea con precisión absoluta: {prompt_text}"},
                            {"type": "image_url", "image_url": {"url": openai_image_url, "detail": "high"}}
                        ]
                    }
                ],
                max_tokens=1000,
                temperature=0.0
            )

            response_text = response.choices[0].message.content.strip()
            
            if response_text.startswith("```json"):
                response_text = response_text[7:-3].strip()
            elif response_text.startswith("```"):
                response_text = response_text[3:-3].strip()

            coords = json.loads(response_text)
            count = len(coords)

            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            draw = ImageDraw.Draw(img)
            width, height = img.size
            radius = max(width, height) * 0.015  # Reducido al 1.5% para marcar mejor el centro

            # RENDERIZADO VISUAL MEJORADO (Círculo exterior + Punto central)
            for point in coords:
                cx = point.get("x", 0) * width
                cy = point.get("y", 0) * height
                
                # Aro exterior (rojo vibrante)
                draw.ellipse(
                    [(cx - radius, cy - radius), (cx + radius, cy + radius)],
                    outline="#ff0000", width=max(2, int(radius * 0.3))
                )
                # Punto central (relleno)
                dot_r = radius * 0.3
                draw.ellipse(
                    [(cx - dot_r, cy - dot_r), (cx + dot_r, cy + dot_r)],
                    fill="#ff0000"
                )

            out_buffer = io.BytesIO()
            img.save(out_buffer, format="JPEG", quality=90)
            out_b64 = base64.b64encode(out_buffer.getvalue()).decode("utf-8")

            self.send_json(200, {
                "count": count,
                "image": f"data:image/jpeg;base64,{out_b64}"
            })

        except json.JSONDecodeError:
            self.send_json(500, {"error": "Fallo en la estructura del modelo. No se detectaron coordenadas válidas."})
        except Exception as e:
            self.send_json(500, {"error": str(e)})