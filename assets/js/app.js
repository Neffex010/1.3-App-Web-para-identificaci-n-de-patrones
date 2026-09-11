// ============================================================
//  Visión IA — Lógica de cliente
//  - Carga local (Base64) y por URL
//  - Drag & drop (Reto 3)
//  - Render de categorías en tarjetas (Reto 4)
// ============================================================

const API_URL = "https://1-3-app-web-para-identificaci-n-de-sigma.vercel.app/api/vision";
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

// ---------- Botón de URL: se crea si no existe ----------
let urlButton = document.getElementById("urlButton");
if (!urlButton) {
    urlButton = document.createElement("button");
    urlButton.type = "button";
    urlButton.id = "urlButton";
    urlButton.title = "Insertar URL de imagen";
    urlButton.className = "btn btn-light text-secondary border-0 px-4 py-2 fs-5 m-1 rounded-pill action-btn";
    urlButton.innerHTML = '<i class="bi bi-link-45deg"></i>';
    if (imageInput && imageInput.parentNode) {
        imageInput.parentNode.insertBefore(urlButton, imageInput.nextSibling);
    }
}

// ---------- Estado ----------
let activeImagePayload = null;

// ---------- Helpers ----------
function isValidHttpUrl(str) {
    return typeof str === "string" && /^https?:\/\/\S+/i.test(str.trim());
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function addMessage(text, type, isHtml = false) {
    const container = document.createElement("div");
    container.classList.add("message", type);

    const label = document.createElement("div");
    label.classList.add("message-label");
    label.innerHTML = type === "user"
        ? '<i class="bi bi-person-fill"></i> Tú'
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

// ---------- Reto 4: construir tarjetas HTML ----------
function buildResultHtml(data) {
    const categorias = Array.isArray(data.categorias) ? data.categorias : [];
    const razonamiento = data.razonamiento || "";

    // Colores por nivel de certeza
    const certezaClass = {
        alta:  "certeza-alta",
        media: "certeza-media",
        baja:  "certeza-baja"
    };

    // Encabezado con total
    let html = `
        <div class="result-header">
            <div class="result-total">
                <i class="bi bi-check2-circle"></i>
                <strong>${data.count}</strong> elemento${data.count === 1 ? "" : "s"} identificado${data.count === 1 ? "" : "s"}
            </div>
        </div>
    `;

    // Tarjetas por categoría
    if (categorias.length > 0) {
        html += `<div class="category-grid">`;
        categorias.forEach(cat => {
            const nombre = escapeHtml(cat.nombre || "sin nombre");
            const cantidad = Number(cat.cantidad) || 0;
            const certeza = (cat.certeza || "media").toLowerCase();
            const cClass = certezaClass[certeza] || "certeza-media";

            html += `
                <div class="category-card">
                    <div class="category-name">${nombre}</div>
                    <div class="category-count">${cantidad}</div>
                    <span class="certeza-badge ${cClass}">Certeza ${certeza}</span>
                </div>
            `;
        });
        html += `</div>`;
    }

    // Razonamiento (si existe)
    if (razonamiento) {
        html += `
            <details class="razonamiento-block">
                <summary><i class="bi bi-lightbulb"></i> Ver razonamiento del modelo</summary>
                <p>${escapeHtml(razonamiento)}</p>
            </details>
        `;
    }

    // Imagen procesada
    if (data.image) {
        html += `
            <div class="result-image-wrapper">
                <img src="${data.image}" alt="Imagen con detecciones marcadas" class="result-image">
                <a href="${data.image}" download="analisis-vision-ia.jpg" class="download-btn" title="Descargar imagen">
                    <i class="bi bi-download"></i> Descargar
                </a>
            </div>
        `;
    }

    return html;
}

// ---------- Carga de archivo local ----------
imageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        addMessage(
            `<div class="text-danger fw-bold">
                <i class="bi bi-exclamation-triangle-fill me-1"></i>
                La imagen pesa ${(file.size / 1024 / 1024).toFixed(2)} MB. El máximo permitido es 5 MB.
             </div>`,
            "assistant", true
        );
        imageInput.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        activeImagePayload = event.target.result;
        showPreview(activeImagePayload);
    };
    reader.onerror = () => {
        addMessage("No se pudo leer el archivo. Intenta de nuevo.", "assistant");
    };
    reader.readAsDataURL(file);
});

// ---------- Carga por URL (botón) ----------
urlButton.addEventListener("click", () => {
    const url = prompt("Ingresa la URL pública de la imagen (debe iniciar con http:// o https://):");
    if (!url) return;

    if (isValidHttpUrl(url)) {
        activeImagePayload = url.trim();
        showPreview(activeImagePayload);
    } else {
        alert("Formato de URL inválido. Debe comenzar con http:// o https://");
    }
});

// ---------- Remover imagen ----------
removeImageBtn.addEventListener("click", clearPreview);

// ============================================================
//  RETO 3: Drag & Drop
// ============================================================
let dragCounter = 0;  // Para manejar dragenter/dragleave anidados

// Overlay visual (se crea una sola vez)
const dropOverlay = document.createElement("div");
dropOverlay.id = "dropOverlay";
dropOverlay.className = "drop-overlay";
dropOverlay.innerHTML = `
    <div class="drop-overlay-inner">
        <i class="bi bi-cloud-arrow-down-fill"></i>
        <p>Suelta la imagen aquí</p>
        <small>Formatos: JPG, PNG, WebP · Máx 5 MB</small>
    </div>
`;
document.body.appendChild(dropOverlay);

function isFileDrag(e) {
    if (!e.dataTransfer) return false;
    const types = e.dataTransfer.types;
    return types && Array.from(types).includes("Files");
}

document.addEventListener("dragenter", (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) {
        dropOverlay.classList.add("active");
    }
});

document.addEventListener("dragover", (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
});

document.addEventListener("dragleave", (e) => {
    if (!isFileDrag(e)) return;
    dragCounter--;
    if (dragCounter <= 0) {
        dragCounter = 0;
        dropOverlay.classList.remove("active");
    }
});

document.addEventListener("drop", (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragCounter = 0;
    dropOverlay.classList.remove("active");

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validar tipo
    if (!file.type.startsWith("image/")) {
        addMessage(
            `<div class="text-danger fw-bold">
                <i class="bi bi-exclamation-triangle-fill me-1"></i>
                El archivo soltado no es una imagen. Solo se aceptan JPG, PNG o WebP.
             </div>`,
            "assistant", true
        );
        return;
    }

    // Validar tamaño
    if (file.size > 5 * 1024 * 1024) {
        addMessage(
            `<div class="text-danger fw-bold">
                <i class="bi bi-exclamation-triangle-fill me-1"></i>
                La imagen pesa ${(file.size / 1024 / 1024).toFixed(2)} MB. El máximo permitido es 5 MB.
             </div>`,
            "assistant", true
        );
        return;
    }

    // Leer como Base64
    const reader = new FileReader();
    reader.onload = (event) => {
        activeImagePayload = event.target.result;
        showPreview(activeImagePayload);
        // Scroll al final para que el usuario vea el preview
        messages.scrollTop = messages.scrollHeight;
    };
    reader.onerror = () => {
        addMessage("No se pudo leer el archivo soltado.", "assistant");
    };
    reader.readAsDataURL(file);
});

// ---------- Envío del formulario ----------
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();

    if (!message && !activeImagePayload) return;

    // URL pegada como mensaje
    if (!activeImagePayload && isValidHttpUrl(message)) {
        activeImagePayload = message.trim();
        showPreview(activeImagePayload);
        addMessage(
            "URL detectada. Ahora escríbeme qué elementos debo contar o identificar en esa imagen.",
            "assistant"
        );
        input.value = "";
        input.focus();
        return;
    }

    if (!activeImagePayload) {
        addMessage(
            'Adjunta una imagen (<i class="bi bi-image"></i>), arrástrala a la ventana, usa el botón <i class="bi bi-link-45deg"></i> o pega una URL.',
            "assistant", true
        );
        return;
    }

    if (!message) {
        addMessage("Escribe qué elementos quieres que identifique y cuente.", "assistant");
        return;
    }

    addMessage(`${message}\n\n[Imagen adjunta para análisis]`, "user");

    input.value = "";
    input.disabled = true;
    sendButton.disabled = true;
    imageInput.disabled = true;
    urlButton.disabled = true;

    const loading = addMessage(
        `<div class="d-flex align-items-center gap-2">
            <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
            <span>Analizando imagen con GPT-5.6 (alta resolución)...</span>
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
                case 400: errorMsg += "Petición inválida. Verifica la imagen."; break;
                case 403: errorMsg += "Acceso bloqueado (CORS o autenticación)."; break;
                case 413: errorMsg += "La imagen es demasiado pesada (máx 5 MB)."; break;
                case 429: errorMsg += "Demasiadas peticiones. Espera un momento."; break;
                case 500: errorMsg += `Fallo interno del servidor. ${data.error || "Sin detalles."}`; break;
                case 504: errorMsg += "El análisis agotó el tiempo de espera."; break;
                default:  errorMsg += data.error || "Error desconocido.";
            }
            throw new Error(errorMsg);
        }

        // ---- RETO 4: Render en tarjetas HTML ----
        addMessage(buildResultHtml(data), "assistant", true);
        clearPreview();

    } catch (error) {
        loading.remove();
        addMessage(
            `<div class="text-danger fw-bold">
                <i class="bi bi-exclamation-triangle-fill me-1"></i> ${escapeHtml(error.message)}
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

// ---------- Reinicio ----------
resetButton.addEventListener("click", () => {
    messages.innerHTML = `
        <div class="message assistant">
            <div class="message-label"><i class="bi bi-robot"></i> IA</div>
            <div class="message-content">
                Sube una imagen, arrástrala a la ventana, usa el botón <i class="bi bi-link-45deg"></i>
                para pegar una URL, o pega la URL directamente como mensaje.
            </div>
        </div>
    `;
    input.value = "";
    clearPreview();
    input.focus();
});