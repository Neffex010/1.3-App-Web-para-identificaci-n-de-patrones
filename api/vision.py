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
                self.send_json(400, {"error": "Se requiere 'image' (Base64 o URL) y 'prompt'."})
                return

            client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
            is_url = image_payload.startswith("http://") or image_payload.startswith("https://")

            # Manejo bifurcado para URLs externas y strings Base64
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

            sys_prompt = (
                "Actúa como un modelo de detección de objetos. "
                "Devuelve ÚNICAMENTE un array JSON válido con las coordenadas 'x' e 'y' normalizadas (de 0.0 a 1.0) "
                "del centro de cada elemento solicitado encontrado. Ejemplo: [{\"x\": 0.5, \"y\": 0.5}]. "
                "Si no hay elementos, devuelve []. No incluyas markdown ni explicaciones."
            )

            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": f"Encuentra: {prompt_text}"},
                            {"type": "image_url", "image_url": {"url": openai_image_url}}
                        ]
                    }
                ],
                max_tokens=1000,
                temperature=0.0
            )

            response_text = response.choices[0].message.content.strip()
            
            # Sanitización de bloque de código Markdown si el modelo lo agrega
            if response_text.startswith("```json"):
                response_text = response_text[7:-3].strip()
            elif response_text.startswith("```"):
                response_text = response_text[3:-3].strip()

            coords = json.loads(response_text)
            count = len(coords)

            # Dibujo de elipses con Pillow
            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            draw = ImageDraw.Draw(img)
            width, height = img.size
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