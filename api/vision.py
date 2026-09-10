import json
import os
import base64
import io
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

            b64_image = data.get("image")
            prompt_text = data.get("prompt")

            if not b64_image or not prompt_text:
                self.send_json(400, {"error": "Se requiere 'image' en base64 y 'prompt'."})
                return

            if "," in b64_image:
                _, b64_data = b64_image.split(",", 1)
            else:
                b64_data = b64_image

            client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

            # Restricción estricta de formato JSON para coordenadas
            sys_prompt = (
                "Actúa como un modelo de detección de objetos. "
                "Devuelve ÚNICAMENTE un array JSON válido con las coordenadas 'x' e 'y' normalizadas (de 0.0 a 1.0) "
                "del centro de cada elemento solicitado encontrado. Ejemplo: [{\"x\": 0.5, \"y\": 0.5}]. "
                "Si no hay elementos, devuelve []. No incluyas markdown ni explicaciones."
            )

            # Uso de gpt-4o para mejor razonamiento espacial
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": f"Encuentra: {prompt_text}"},
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_data}"}}
                        ]
                    }
                ],
                max_tokens=1000,
                temperature=0.0
            )

            response_text = response.choices[0].message.content.strip()
            
            # Limpieza de sintaxis Markdown residual
            if response_text.startswith("```json"):
                response_text = response_text[7:-3].strip()
            elif response_text.startswith("```"):
                response_text = response_text[3:-3].strip()

            coords = json.loads(response_text)
            count = len(coords)

            # Modificación de la imagen en memoria
            image_bytes = base64.b64decode(b64_data)
            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            draw = ImageDraw.Draw(img)
            width, height = img.size
            
            # Radio dinámico basado en la resolución (2%)
            radius = max(width, height) * 0.02 

            for point in coords:
                cx = point.get("x", 0) * width
                cy = point.get("y", 0) * height
                draw.ellipse(
                    [(cx - radius, cy - radius), (cx + radius, cy + radius)],
                    outline="red", width=int(max(2, radius * 0.2))
                )

            out_buffer = io.BytesIO()
            img.save(out_buffer, format="JPEG")
            out_b64 = base64.b64encode(out_buffer.getvalue()).decode("utf-8")

            self.send_json(200, {
                "count": count,
                "image": f"data:image/jpeg;base64,{out_b64}"
            })

        except Exception as e:
            self.send_json(500, {"error": str(e)})