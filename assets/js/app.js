// Ruta del nuevo endpoint de visión
const API_URL = "https://1-3-app-web-para-identificaci-n-de-sigma.vercel.app/api/vision";

// Referencias del DOM
const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const messages = document.getElementById("messages");
const sendButton = document.getElementById("sendButton");
const resetButton = document.getElementById("resetButton");

// Elementos de la imagen
const imageInput = document.getElementById("imageInput");
const imagePreviewContainer = document.getElementById("imagePreviewContainer");
const imagePreview = document.getElementById("imagePreview");
const removeImageBtn = document.getElementById("removeImageBtn");

let currentBase64 = null;

/**
 * Agrega un mensaje al contenedor.
 * @param {string} text - El contenido del mensaje.
 * @param {string} type - "user", "assistant", o "loading".
 * @param {boolean} isHtml - Define si el contenido debe inyectarse como HTML crudo (para la imagen de retorno).
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

    // Auto-scroll hacia el final
    messages.scrollTop = messages.scrollHeight;

    return container;
}

// Manejo del evento de selección de imagen
imageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            currentBase64 = event.target.result;
            imagePreview.src = currentBase64;
            imagePreviewContainer.classList.remove("d-none");
        };
        reader.readAsDataURL(file);
    }
});

// Botón para remover la imagen cargada
removeImageBtn.addEventListener("click", () => {
    currentBase64 = null;
    imageInput.value = "";
    imagePreviewContainer.classList.add("d-none");
});

// Manejo del envío del formulario
form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();

    if (!message) return;

    // Validación estricta: se requiere imagen para este endpoint
    if (!currentBase64) {
        addMessage("Por favor, adjunta una imagen utilizando el ícono de imagen antes de enviar el comando.", "assistant");
        return;
    }

    // Reflejar el mensaje del usuario en la interfaz
    addMessage(`${message}\n\n[Imagen adjunta]`, "user");

    input.value = "";
    input.disabled = true;
    sendButton.disabled = true;
    imageInput.disabled = true;

    const loading = addMessage("Analizando coordenadas y renderizando imagen...", "loading");

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: message, image: currentBase64 })
        });

        const data = await response.json();
        loading.remove();

        if (!response.ok) {
            throw new Error(data.error || `Error del servidor: Código ${response.status}`);
        }

        // Estructura HTML para mostrar el conteo y la imagen marcada en Base64
        const htmlResponse = `
            <strong>Elementos identificados: ${data.count}</strong><br><br>
            <img src="${data.image}" class="img-fluid rounded mt-2 border shadow-sm" style="max-width: 100%;">
        `;
        
        // Inyectar forzando el renderizado de HTML
        addMessage(htmlResponse, "assistant", true);
        
        // Limpiar la zona de preview tras un análisis exitoso
        removeImageBtn.click();
    } catch (error) {
        loading.remove();
        addMessage(`Error: ${error.message}`, "assistant");
    } finally {
        // Restaurar estado de inputs
        input.disabled = false;
        sendButton.disabled = false;
        imageInput.disabled = false;
        input.focus();
    }
});

// Reinicio de la interfaz al estado original
resetButton.addEventListener("click", () => {
    messages.innerHTML = `
        <div class="message assistant">
            <div class="message-label"><i class="bi bi-robot"></i> IA</div>
            <div class="message-content">
                Sube una imagen y dime qué elementos deseas que identifique y cuente.
            </div>
        </div>
    `;
    input.value = "";
    removeImageBtn.click();
    input.focus();
});