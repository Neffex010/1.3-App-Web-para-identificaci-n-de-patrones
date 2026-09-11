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
                req = urllib.request.Request(image_payload, headers={'User-Agent': 'Mozilla/5.0'})
                with urllib.request.urlopen(req) as response:
                    image_bytes = response.read()
                openai_image_url = image_payload
            else:
                if "," in image_payload:
                    _, b64_data = image_payload.split(",", 1)
                else:
                    b64_data = image_payload
                
                openai_image_url = f"data:image/jpeg;base64,{b64_data}"
                image_bytes = base64.b64decode(b64_data)

            # PROMPT CORREGIDO: Más permisivo, enfocado en identificar todo sin importar oclusión
            sys_prompt = (
                "Eres un experto en detección de objetos. "
                "Encuentra TODOS los elementos que el usuario indique, incluso si están agrupados, de espaldas o parcialmente ocultos. "
                "Responde ÚNICAMENTE con un objeto JSON que contenga un arreglo llamado 'puntos'. "
                "Cada punto es el centro del objeto detectado con coordenadas 'x' e 'y' normalizadas (0.000 a 1.000). "
                "Ejemplo: {\"puntos\": [{\"x\": 0.450, \"y\": 0.600}, {\"x\": 0.820, \"y\": 0.310}]}. "
                "Incluso si el usuario pide 'contar', tú debes devolver la lista de coordenadas de cada uno."
            )

            # TEXTO DE USUARIO CORREGIDO: Instrucción directa
            response = client.chat.completions.create(
                model="gpt-4o",
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": f"Busca y mapea: {prompt_text}"},
                            {"type": "image_url", "image_url": {"url": openai_image_url, "detail": "high"}}
                        ]
                    }
                ],
                max_tokens=1000,
                temperature=0.0
            )

            response_text = response.choices[0].message.content.strip()
            parsed_json = json.loads(response_text)
            coords = parsed_json.get("puntos", [])
            count = len(coords)

            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            draw = ImageDraw.Draw(img)
            width, height = img.size
            radius = max(width, height) * 0.015 

            for point in coords:
                cx = point.get("x", 0) * width
                cy = point.get("y", 0) * height
                
                draw.ellipse(
                    [(cx - radius, cy - radius), (cx + radius, cy + radius)],
                    outline="#ff0000", width=max(2, int(radius * 0.3))
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
                "count": count,
                "image": f"data:image/jpeg;base64,{out_b64}"
            })

        except json.JSONDecodeError as e:
            self.send_json(500, {"error": f"Fallo estructural del modelo. Payload: {response_text}"})
        except Exception as e:
            self.send_json(500, {"error": str(e)})
