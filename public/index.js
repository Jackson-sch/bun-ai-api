const messagesContainer = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const servicesContainer = document.getElementById('services-container');
const conversationsContainer = document.getElementById('conversations-container');
const apiStatus = document.getElementById('api-status');
const clearBtn = document.getElementById('clear-chat');
const newChatBtn = document.getElementById('new-chat-btn');
const currentServiceLabel = document.getElementById('current-service');

let chatHistory = [];
let isGenerating = false;
let selectedService = null;
let currentConversationId = null;

// Helper to toggle button state
function updateSendButton() {
    if (sendBtn) {
        sendBtn.disabled = !userInput.value.trim() || isGenerating;
    }
}

// Initialize
async function init() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        
        if (data.status === 'ok') {
            document.querySelector('.status-dot')?.classList.add('online');
            if (apiStatus) apiStatus.textContent = 'Online';
            
            // Inyectar servicios
            if (servicesContainer) {
                servicesContainer.innerHTML = data.services.map(service => `
                    <li class="service-item" data-service="${service}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
                        ${service}
                    </li>
                `).join('');

                document.querySelectorAll('.service-item').forEach(item => {
                    item.addEventListener('click', () => {
                        document.querySelectorAll('.service-item').forEach(i => i.classList.remove('active'));
                        item.classList.add('active');
                        selectedService = item.dataset.service;
                        if (currentServiceLabel) currentServiceLabel.textContent = selectedService;
                        const toggle = document.getElementById('theme-toggle');
                        if (toggle) toggle.checked = false;
                    });
                });
            }
        }
        
        await fetchConversations();
    } catch (error) {
        if (apiStatus) apiStatus.textContent = 'Offline';
        document.querySelector('.status-dot')?.classList.remove('online');
        console.error('API is offline:', error);
    }
}

async function fetchConversations() {
    try {
        const response = await fetch('/api/conversations');
        const conversations = await response.json();
        
        if (conversationsContainer) {
            conversationsContainer.innerHTML = conversations.map(c => `
                <li class="conversation-item ${c.id === currentConversationId ? 'active' : ''}" data-id="${c.id}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    <span>${c.title || 'Untitled Chat'}</span>
                </li>
            `).join('');

            document.querySelectorAll('.conversation-item').forEach(item => {
                item.addEventListener('click', () => loadConversation(item.dataset.id));
            });
        }
    } catch (error) {
        console.error('Error fetching conversations:', error);
    }
}

async function loadConversation(id) {
    if (isGenerating) return;
    currentConversationId = id;
    
    document.querySelectorAll('.conversation-item').forEach(i => {
        i.classList.toggle('active', i.dataset.id === id);
    });

    try {
        const response = await fetch(`/api/conversations/${id}/messages`);
        const messages = await response.json();
        
        messagesContainer.innerHTML = '';
        chatHistory = [];
        
        messages.forEach(msg => {
            addMessage(msg.role, msg.content, msg.service);
            chatHistory.push({ role: msg.role, content: msg.content });
        });
        
        if (currentServiceLabel) currentServiceLabel.textContent = `Conversation History`;
    } catch (error) {
        console.error('Error loading conversation:', error);
    }
}

function startNewChat() {
    currentConversationId = null;
    chatHistory = [];
    messagesContainer.innerHTML = `
        <div class="message system">
            <div class="message-content">Started a new conversation.</div>
        </div>
    `;
    document.querySelectorAll('.conversation-item').forEach(i => i.classList.remove('active'));
    if (currentServiceLabel) currentServiceLabel.textContent = 'All Services (Round Robin)';
}

if (newChatBtn) newChatBtn.addEventListener('click', startNewChat);

// Modal Elements
const customModal = document.getElementById('custom-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalCancel = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');

let modalCallback = null;

function showModal(title, message, callback, isDanger = false) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalCallback = callback;
    
    modalConfirm.className = isDanger ? 'btn-danger' : 'btn-primary';
    customModal.showModal();
    
    // Auto-focus confirm button
    setTimeout(() => modalConfirm.focus(), 100);
}

function hideModal() {
    customModal.close();
    modalCallback = null;
}

if (modalCancel) modalCancel.addEventListener('click', hideModal);
if (modalConfirm) {
    modalConfirm.addEventListener('click', () => {
        if (modalCallback) modalCallback();
        hideModal();
    });
}

async function clearCurrentHistory() {
    const isAll = !currentConversationId;
    const title = isAll ? 'Eliminar Todo el Historial' : 'Eliminar Conversación';
    const message = isAll
        ? '¿Estás seguro de que deseas eliminar TODO el historial de conversaciones? Esta acción no se puede deshacer.'
        : '¿Estás seguro de que deseas eliminar esta conversación permanentemente?';
    
    showModal(title, message, async () => {
        try {
            const url = isAll ? '/api/conversations' : `/api/conversations/${currentConversationId}`;
            const response = await fetch(url, { method: 'DELETE' });
            
            if (response.ok) {
                startNewChat();
                await fetchConversations();
            } else {
                const err = await response.json();
                showModal('Error', 'Error al eliminar: ' + (err.error || 'Unknown error'), null);
            }
        } catch (error) {
            console.error('Error deleting conversation:', error);
            showModal('Error', 'Error de conexión al intentar eliminar.', null);
        }
    }, true);
}

if (clearBtn) clearBtn.addEventListener('click', clearCurrentHistory);

// Input events
userInput?.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = userInput.scrollHeight + 'px';
    updateSendButton();
});

userInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm?.dispatchEvent(new Event('submit'));
    }
});

// Handle Chat Submit
chatForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = userInput.value.trim();
    if (!message || isGenerating) return;

    addMessage('user', message);
    userInput.value = '';
    userInput.style.height = 'auto';
    updateSendButton();
    
    await sendMessage(message);
});

async function sendMessage(text) {
    isGenerating = true;
    updateSendButton();
    
    try {
        // Auto-create conversation if no active session
        if (!currentConversationId) {
            const convResponse = await fetch('/api/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: text.slice(0, 30) + (text.length > 30 ? '...' : '') })
            });
            const newConv = await convResponse.json();
            currentConversationId = newConv.id;
            await fetchConversations();
        }

        const assistantMessageId = addMessage('assistant', '');
        const assistantContent = document.getElementById(assistantMessageId)?.querySelector('.message-content');
        
        const body = { 
            messages: [...chatHistory, { role: 'user', content: text }],
            conversationId: currentConversationId
        };
        
        if (selectedService) body.service = selectedService;

        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) throw new Error('Failed to connect to API');

        const serviceName = response.headers.get('X-Service-Name');
        const modelName = response.headers.get('X-Model-Name');
        const requestId = response.headers.get('X-Request-ID');

        const metadataBar = document.getElementById('request-metadata');
        if (metadataBar && requestId && modelName && serviceName) {
            metadataBar.textContent = `service: ${serviceName} | requestId: ${requestId} | model: ${modelName}`;
        }

        if (serviceName) {
            const badge = document.getElementById(assistantMessageId)?.querySelector('.service-badge');
            if (badge) badge.textContent = serviceName;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            fullResponse += chunk;
            if (assistantContent) assistantContent.textContent = fullResponse;
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        chatHistory.push({ role: 'user', content: text });
        chatHistory.push({ role: 'assistant', content: fullResponse });

    } catch (error) {
        console.error('Send Error:', error);
        addMessage('system', `Error: ${error.message}`, null, true);
    } finally {
        isGenerating = false;
        updateSendButton();
    }
}

function addMessage(role, content, service = null, isError = false) {
    const id = 'msg-' + Math.random().toString(36).substr(2, 9);
    const div = document.createElement('div');
    div.className = `message ${role} ${isError ? 'error' : ''}`;
    div.id = id;
    
    let html = '';
    if (role === 'assistant') {
        html += `<div class="service-badge">${service || '...'}</div>`;
    }
    html += `<div class="message-content">${content}</div>`;
    
    div.innerHTML = html;
    messagesContainer?.appendChild(div);
    if (messagesContainer) messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return id;
}

// UI Setup
init();

// Navigation
const showChatBtn = document.getElementById('show-chat');
const showRestBtn = document.getElementById('show-rest');
const messagesList = document.getElementById('messages');
const restConsole = document.getElementById('rest-console');
const inputArea = document.querySelector('.input-area');
const workspaceContainer = document.getElementById('workspace-container');
const toggleLayoutBtn = document.getElementById('toggle-layout');
let isSplitView = false;

function switchLayout() {
    isSplitView = !isSplitView;
    if (isSplitView) {
        workspaceContainer?.classList.add('split-view');
        toggleLayoutBtn?.classList.add('active');
        // En split view, los botones de navegación no tienen sentido para ocultar paneles
        showChatBtn?.classList.add('active');
        showRestBtn?.classList.add('active');
        messagesList?.classList.remove('hidden'); // Ensure chat is visible
        restConsole?.classList.remove('hidden'); // Ensure rest is visible
        inputArea?.classList.remove('hidden'); // Ensure input is visible
    } else {
        workspaceContainer?.classList.remove('split-view');
        toggleLayoutBtn?.classList.remove('active');
        // Restaurar estado de pestañas (asumiendo que chat es default)
        switchView('chat');
    }
}

toggleLayoutBtn?.addEventListener('click', switchLayout);

function switchView(view) {
    if (isSplitView) return; // No cambiar vistas si estamos en split mode

    if (view === 'chat') {
        showChatBtn?.classList.add('active');
        showRestBtn?.classList.remove('active');
        messagesList?.classList.remove('hidden');
        restConsole?.classList.add('hidden');
        inputArea?.classList.remove('hidden');
    } else {
        showRestBtn?.classList.add('active');
        showChatBtn?.classList.remove('active');
        messagesList?.classList.add('hidden');
        restConsole?.classList.remove('hidden');
        inputArea?.classList.add('hidden');
    }
}

showChatBtn?.addEventListener('click', () => switchView('chat'));
showRestBtn?.addEventListener('click', () => switchView('rest'));

// REST Console
const restSend = document.getElementById('rest-send');
const restResponse = document.getElementById('rest-response');
restSend?.addEventListener('click', async () => {
    const method = document.getElementById('rest-method')?.value;
    const url = document.getElementById('rest-url')?.value;
    const bodyContent = document.getElementById('rest-body')?.value;

    restSend.textContent = 'Executing...';
    restSend.disabled = true;

    try {
        const options = { method, headers: {} };
        if (method !== 'GET' && bodyContent?.trim()) {
            options.headers['Content-Type'] = 'application/json';
            options.body = bodyContent;
        }

        const response = await fetch(url, options);
        let data;
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        if (restResponse) {
            restResponse.textContent = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
            restResponse.style.color = response.ok ? '#4ade80' : '#f87171';
        }
    } catch (error) {
        if (restResponse) {
            restResponse.textContent = `Error: ${error.message}`;
            restResponse.style.color = '#f87171';
        }
    } finally {
        restSend.textContent = 'Execute';
        restSend.disabled = false;
    }
});
