// ============================================================
//  VisiÃ³n IA â€” LÃ³gica de cliente
//  - Carga local (Base64) y por URL
//  - EnvÃ­o a /api/vision y render de la imagen marcada
// ============================================================

const API_URL = "https://1-3-app-web-para-identificaci-n-de-sigma.vercel.app/api/vision";

// Si algÃºn dÃ­a activas APP_KEY en Vercel, pon aquÃ­ el mismo valor.
// Mientras sea null, no se envÃ­a la cabecera X-App-Key.
const APP_KEY = null;

// ---------- Referencias del DOM ----------
const form         = document.getElementById("chatForm");
const input        = document.getElementById("messageInput");
const messages     = document.getElementById("messages");
const sendButton   = document.getElementById("sendButton");
const resetButton  = document.getElementById("resetButton");

const imageInput              = document.getElementById("imageInput");
const imagePreviewContainer   = document.getElementById("imagePreviewContainer");
const imagePreview            = document.getElementById("imagePreview");
const removeImageBtn          = document.getElementById("removeImageBtn");

// ---------- BotÃ³n de URL: se crea si no existe en el HTML ----------
let urlButton = document.getElementById("urlButton");
if (!urlButton) {
    urlButton = document.createElement("button");
    urlButton.type = "button";
    urlButton.id = "urlButton";
    urlButton.title = "Insertar URL de imagen";
    urlButton.className = "btn btn-light text-secondary border-0 px-4 py-2 fs-5 m-1 rounded-pill";
    urlButton.style.transition = "0.2s";
    urlButton.innerHTML = '<i class="bi bi-link-45deg"></i>';
    urlButton.addEventListener("mouseover", () => { urlButton.style.backgroundColor = "#e2e8f0"; });
    urlButton.addEventListener("mouseout",  () => { urlButton.style.backgroundColor = "transparent"; });

    // Se inserta justo despuÃ©s del input file, dentro del .input-group
    if (imageInput && imageInput.parentNode) {
        imageInput.parentNode.insertBefore(urlButton, imageInput.nextSibling);
    }
}

// ---------- Estado ----------
let activeImagePayload = null;  // Puede ser un data URI (Base64) o una URL http/https

// ---------- Helpers ----------
function isValidHttpUrl(str) {
    return typeof str === "string" && /^https?:\/\/\S+/i.test(str.trim());
}

function addMessage(text, type, isHtml = false) {
    const container = document.createElement("div");
    container.classList.add("message", type);

    const label = document.createElement("div");
    label.classList.add("message-label");
    label.innerHTML = type === "user"
        ? '<i class="bi bi-person-fill"></i> TÃº'
        : '<i class="bi bi-robot"></i> IA';

    const content = document.createElement("div");
    content.classList.add("message-content");

    if (isHtml) {
        content.innerHTML = text;
    } else if (type === "assistant" && typeof marked !== "undefined") {
        content.innerHTML = marked.parse(text);
    } else {
        content.textContent = text;
    }

    container.appendChild(label);
    container.appendChild(content);
    messages.appendChild(container);
    messages.scrollTop = messages.scrollHeight;
    return container;
}

function showPreview(src) {
    imagePreview.src = src;
    imagePreviewContainer.classList.remove("d-none");
}

function clearPreview() {
    activeImagePayload = null;
    imageInput.value = "";
    imagePreview.removeAttribute("src");
    imagePreviewContainer.classList.add("d-none");
}

// ---------- Carga de archivo local ----------
imageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // ValidaciÃ³n de tamaÃ±o antes de leer (evita 413)
    if (file.size > 5 * 1024 * 1024) {
        addMessage(
            `<div class="text-danger fw-bold">
                <i class="bi bi-exclamation-triangle-fill me-1"></i>
                La imagen pesa ${(file.size / 1024 / 1024).toFixed(2)} MB. El mÃ¡ximo permitido es 5 MB.
             </div>`,
            "assistant", true
        );
        imageInput.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        activeImagePayload = event.target.result;  // data:image/...;base64,...
        showPreview(activeImagePayload);
    };
    reader.onerror = () => {
        addMessage("No se pudo leer el archivo. Intenta de nuevo.", "assistant");
    };
    reader.readAsDataURL(file);
});

// ---------- Carga por URL (botÃ³n) ----------
urlButton.addEventListener("click", () => {
    const url = prompt("Ingresa la URL pÃºblica de la imagen (debe iniciar con http:// o https://):");
    if (!url) return;

    if (isValidHttpUrl(url)) {
        activeImagePayload = url.trim();
        showPreview(activeImagePayload);
    } else {
        alert("Formato de URL invÃ¡lido. Debe comenzar con http:// o https://");
    }
});

// ---------- Remover imagen ----------
removeImageBtn.addEventListener("click", clearPreview);

// ---------- EnvÃ­o del formulario ----------
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();

    // Nada que enviar
    if (!message && !activeImagePayload) return;

    // Caso especial: el usuario escribiÃ³/pegÃ³ una URL como mensaje y no hay imagen adjunta
    if (!activeImagePayload && isValidHttpUrl(message)) {
        activeImagePayload = message.trim();
        showPreview(activeImagePayload);
        addMessage(
            "URL detectada. Ahora escrÃ­beme quÃ© elementos debo contar o identificar en esa imagen.",
            "assistant"
        );
        input.value = "";
        input.focus();
        return;
    }

    if (!activeImagePayload) {
        addMessage(
            'Adjunta una imagen (<i class="bi bi-image"></i>), usa el botÃ³n <i class="bi bi-link-45deg"></i> o pega una URL como mensaje.',
            "assistant", true
        );
        return;
    }

    if (!message) {
        addMessage("Escribe quÃ© elementos quieres que identifique y cuente.", "assistant");
        return;
    }

    // Reflejar mensaje del usuario
    addMessage(`${message}\n\n[Imagen adjunta para anÃ¡lisis]`, "user");

    // Bloqueo de UI
    input.value = "";
    input.disabled = true;
    sendButton.disabled = true;
    imageInput.disabled = true;
    urlButton.disabled = true;

    // Spinner
    const loading = addMessage(
        `<div class="d-flex align-items-center gap-2">
            <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
            <span>Analizando imagen con gpt-4o (alta resoluciÃ³n)...</span>
         </div>`,
        "loading", true
    );

    try {
        const headers = { "Content-Type": "application/json" };
        if (APP_KEY) headers["X-App-Key"] = APP_KEY;

        const response = await fetch(API_URL, {
            method: "POST",
            headers,
            body: JSON.stringify({ prompt: message, image: activeImagePayload })
        });

        // El server podrÃ­a devolver HTML en un error de Vercel (502, etc.)
        let data;
        try {
            data = await response.json();
        } catch {
            data = { error: `Respuesta no-JSON del servidor (HTTP ${response.status}).` };
        }

        loading.remove();

        if (!response.ok) {
            let errorMsg = `Error ${response.status}: `;
            switch (response.status) {
                case 400: errorMsg += "PeticiÃ³n invÃ¡lida. Verifica la imagen."; break;
                case 403: errorMsg += "Acceso bloqueado (CORS o autenticaciÃ³n)."; break;
                case 413: errorMsg += "La imagen es demasiado pesada (mÃ¡x 5 MB)."; break;
                case 429: errorMsg += "Demasiadas peticiones. Espera un momento."; break;
                case 500: errorMsg += `Fallo interno del servidor. ${data.error || "Sin detalles."}`; break;
                case 504: errorMsg += "El anÃ¡lisis agotÃ³ el tiempo de espera."; break;
                default:  errorMsg += data.error || "Error desconocido.";
            }
            throw new Error(errorMsg);
        }

        const htmlResponse = `
            <strong>Elementos identificados: ${data.count}</strong><br><br>
            <img src="${data.image}" class="img-fluid rounded mt-2 border shadow-sm" style="max-width: 100%;">
        `;

        addMessage(htmlResponse, "assistant", true);
        clearPreview();

    } catch (error) {
        loading.remove();
        addMessage(
            `<div class="text-danger fw-bold">
                <i class="bi bi-exclamation-triangle-fill me-1"></i> ${error.message}
             </div>`,
            "assistant", true
        );
    } finally {
        input.disabled = false;
        sendButton.disabled = false;
        imageInput.disabled = false;
        urlButton.disabled = false;
        input.focus();
    }
});

// ---------- Reinicio de la interfaz ----------
resetButton.addEventListener("click", () => {
    messages.innerHTML = `
        <div class="message assistant">
            <div class="message-label"><i class="bi bi-robot"></i> IA</div>
            <div class="message-content">
                Sube una imagen, usa el botÃ³n <i class="bi bi-link-45deg"></i> para pegar una URL,
                o pega la URL directamente como mensaje.
            </div>
        </div>
    `;
    input.value = "";
    clearPreview();
    input.focus();
});