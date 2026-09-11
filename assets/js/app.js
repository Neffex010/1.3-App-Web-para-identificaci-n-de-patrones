// Cambiar ruta relativa por el dominio absoluto de Vercel
const API_URL = "https://1-3-app-web-para-identificaci-n-de-sigma.vercel.app/api/vision";

// Referencias del DOM
const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const messages = document.getElementById("messages");
const sendButton = document.getElementById("sendButton");
const resetButton = document.getElementById("resetButton");

// Elementos de la imagen
const imageInput = document.getElementById("imageInput");
const urlButton = document.getElementById("urlButton");
const imagePreviewContainer = document.getElementById("imagePreviewContainer");
const imagePreview = document.getElementById("imagePreview");
const removeImageBtn = document.getElementById("removeImageBtn");

// Payload activo (soporta Base64 local o URL http/https)
let activeImagePayload = null;

/**
 * Agrega un mensaje al contenedor.
 * @param {string} text - El contenido del mensaje.
 * @param {string} type - "user", "assistant", o "loading".
 * @param {boolean} isHtml - Define si el contenido se inyecta como HTML crudo.
 */
function addMessage(text, type, isHtml = false) {
    const container = document.createElement("div");
    container.classList.add("message", type);

    const label = document.createElement("div");
    label.classList.add("message-label");
    label.innerHTML = type === "user" ? '<i class="bi bi-person-fill"></i> Tú' : '<i class="bi bi-robot"></i> IA';

    const content = document.createElement("div");
    content.classList.add("message-content");
    
    if (isHtml) {
        content.innerHTML = text;
    } else if (type === "assistant" && typeof marked !== 'undefined') {
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

// Carga de archivo local (Base64)
imageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            activeImagePayload = event.target.result;
            imagePreview.src = activeImagePayload;
            imagePreviewContainer.classList.remove("d-none");
        };
        reader.readAsDataURL(file);
    }
});

// Carga por URL pública
if (urlButton) {
    urlButton.addEventListener("click", () => {
        const url = prompt("Ingresa la URL pública de la imagen (http/https):");
        if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
            activeImagePayload = url;
            imagePreview.src = activeImagePayload;
            imagePreviewContainer.classList.remove("d-none");
        } else if (url) {
            alert("Formato de URL inválido. Debe comenzar con http:// o https://");
        }
    });
}

// Botón para remover la imagen cargada
removeImageBtn.addEventListener("click", () => {
    activeImagePayload = null;
    imageInput.value = "";
    imagePreviewContainer.classList.add("d-none");
});

// Manejo del envío del formulario
// Manejo del envío del formulario (Reemplaza desde form.addEventListener("submit", async (event) => { ... })
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();

    if (!message) return;

    if (!activeImagePayload) {
        addMessage("Por favor, adjunta una imagen o ingresa una URL antes de enviar la instrucción.", "assistant");
        return;
    }

    addMessage(`${message}\n\n[Imagen adjunta para análisis]`, "user");

    // Bloqueo de UI
    input.value = "";
    input.disabled = true;
    sendButton.disabled = true;
    imageInput.disabled = true;
    if (urlButton) urlButton.disabled = true;

    // DINAMISMO: Spinner de Bootstrap incrustado en el mensaje
    const loadingHtml = `
        <div class="d-flex align-items-center gap-2">
            <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
            <span>Analizando con precisión (gpt-4o alta resolución)...</span>
        </div>
    `;
    const loading = addMessage(loadingHtml, "loading", true);

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: message, image: activeImagePayload })
        });

        const data = await response.json();
        loading.remove();

        // MANEJO DE ERRORES ESTRUCTURADO
        if (!response.ok) {
            let errorMsg = "Error del servidor al procesar la imagen.";
            if (response.status === 400) errorMsg = "Error 400: Petición inválida. Verifica tu imagen.";
            if (response.status === 403) errorMsg = "Error 403: Acceso bloqueado por CORS o permisos.";
            if (response.status === 413) errorMsg = "Error 413: La imagen es demasiado pesada para el servidor (Payload Too Large).";
            if (response.status === 500) errorMsg = `Error 500: Fallo interno de IA. Detalles: ${data.error || "Desconocido"}`;
            if (response.status === 504) errorMsg = "Error 504: El análisis en alta resolución agotó el tiempo de espera del servidor.";
            throw new Error(errorMsg);
        }

        const htmlResponse = `
            <strong>Total de elementos mapeados: ${data.count}</strong><br><br>
            <img src="${data.image}" class="img-fluid rounded mt-2 border shadow-sm" style="max-width: 100%;">
        `;
        
        addMessage(htmlResponse, "assistant", true);
        removeImageBtn.click();
        
    } catch (error) {
        loading.remove();
        // Feedback visual del error
        const errorHtml = `
            <div class="text-danger fw-bold">
                <i class="bi bi-exclamation-triangle-fill me-1"></i> ${error.message}
            </div>
        `;
        addMessage(errorHtml, "assistant", true);
    } finally {
        // Desbloqueo de UI
        input.disabled = false;
        sendButton.disabled = false;
        imageInput.disabled = false;
        if (urlButton) urlButton.disabled = false;
        input.focus();
    }
});
// Reinicio de la interfaz
resetButton.addEventListener("click", () => {
    messages.innerHTML = `
        <div class="message assistant">
            <div class="message-label"><i class="bi bi-robot"></i> IA</div>
            <div class="message-content">
                Sube una imagen o ingresa una URL y dime qué elementos deseas que identifique y cuente.
            </div>
        </div>
    `;
    input.value = "";
    removeImageBtn.click();
    input.focus();
});