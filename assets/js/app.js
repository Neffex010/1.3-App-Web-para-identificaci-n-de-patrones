const API_URL = "https://1-2-aplicaciones-web-ia-omega.vercel.app/api/chat";

const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const messages = document.getElementById("messages");
const sendButton = document.getElementById("sendButton");
const charCount = document.getElementById("charCount"); 
const resetButton = document.getElementById("resetButton");

// 1. NUEVO: Creamos un arreglo vacío para guardar la memoria del chat
let conversationHistory = [];

function addMessage(text, type) {
    const container = document.createElement("div");
    container.classList.add("message", type);

    const label = document.createElement("div");
    label.classList.add("message-label");
    label.textContent = type === "user" ? "Tú" : "IA";

    const content = document.createElement("div");
    content.classList.add("message-content");
    
    if (type === "assistant" && typeof marked !== 'undefined') {
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

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const message = input.value.trim();

    if (!message) {
        return;
    }

    addMessage(message, "user");

    // 2. NUEVO: Guardamos el mensaje del usuario en el historial
    conversationHistory.push({ role: "user", content: message });

    input.value = "";
    charCount.textContent = "0 / 1000"; 
    input.disabled = true;
    sendButton.disabled = true;

    const loading = addMessage("Pensando...", "loading");

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            // 3. MODIFICADO: Enviamos todo el arreglo 'messages' al backend
            body: JSON.stringify({
                messages: conversationHistory
            })
        });

        const data = await response.json();

        loading.remove();

       if (!response.ok) {
            // Reto 5: Manejo de errores personalizado según el código HTTP
            let mensajeError = "Error del servidor";
            
            if (response.status === 400) {
                mensajeError = "Error 400: El mensaje enviado está vacío o es inválido.";
            } else if (response.status === 403) {
                mensajeError = "Error 403: Acceso denegado (Verifica la API Key o los permisos).";
            } else if (response.status === 413) {
                mensajeError = "Error 413: El mensaje es demasiado largo.";
            } else if (response.status === 500) {
                mensajeError = "Error 500: Fallo interno en el servidor o en la IA.";
            }

            throw new Error(mensajeError);
        }
        addMessage(data.reply, "assistant");
        
        // 4. NUEVO: Guardamos la respuesta de la IA para que la recuerde la próxima vez
        conversationHistory.push({ role: "assistant", content: data.reply });
    }
    catch (error) {
        loading.remove();
        addMessage("Error: " + error.message, "assistant");
        // Si hay un error, borramos el último intento del usuario para no corromper el historial
        conversationHistory.pop();
    }
    finally {
        input.disabled = false;
        sendButton.disabled = false;
        input.focus();
    }
});

input.addEventListener("input", () => {
    const currentLength = input.value.length;
    charCount.textContent = `${currentLength} / 1000`;
});

resetButton.addEventListener("click", () => {
    messages.innerHTML = `
        <div class="message assistant">
            <div class="message-label">IA</div>
            <div class="message-content">
                Hola. Soy tu asistente educativo especializado en Ciberseguridad. ¿En qué puedo ayudarte?
            </div>
        </div>
    `;
    input.value = "";
    charCount.textContent = "0 / 1000";
    input.focus();
    
    // 5. NUEVO: Vaciamos la memoria cuando se inicia una Nueva Conversación
    conversationHistory = [];
});