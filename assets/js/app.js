// Ruta relativa nativa para Vercel Serverless
const API_URL = "/api/vision";

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
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();

    if (!message) return;

    if (!activeImagePayload) {
        addMessage("Por favor, adjunta una imagen o ingresa una URL antes de enviar el comando.", "assistant");
        return;
    }

    addMessage(`${message}\n\n[Imagen adjunta para análisis]`, "user");

    input.value = "";
    input.disabled = true;
    sendButton.disabled = true;
    imageInput.disabled = true;
    if (urlButton) urlButton.disabled = true;

    const loading = addMessage("Analizando coordenadas y renderizando imagen...", "loading");

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: message, image: activeImagePayload })
        });

        const data = await response.json();
        loading.remove();

        if (!response.ok) {
            throw new Error(data.error || `Error del servidor: Código ${response.status}`);
        }

        const htmlResponse = `
            <strong>Elementos identificados: ${data.count}</strong><br><br>
            <img src="${data.image}" class="img-fluid rounded mt-2 border shadow-sm" style="max-width: 100%;">
        `;
        
        addMessage(htmlResponse, "assistant", true);
        removeImageBtn.click();
    } catch (error) {
        loading.remove();
        addMessage(`Error: ${error.message}`, "assistant");
    } finally {
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