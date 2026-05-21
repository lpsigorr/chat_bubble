// ============================================
// SUPABASE CONFIGURATION
// ============================================
// Replace these with your Supabase project credentials
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Initialize Supabase client
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// STATE
// ============================================
let currentUser = null;
let messageSubscription = null;

// ============================================
// DOM ELEMENTS
// ============================================
const loginScreen = document.getElementById('loginScreen');
const chatScreen = document.getElementById('chatScreen');
const usernameInput = document.getElementById('usernameInput');
const joinBtn = document.getElementById('joinBtn');
const logoutBtn = document.getElementById('logoutBtn');
const currentUsername = document.getElementById('currentUsername');
const messagesContainer = document.getElementById('messagesContainer');
const messagesInner = document.getElementById('messagesInner');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const charCount = document.getElementById('charCount');
const onlineCount = document.getElementById('onlineCount');

// ============================================
// AUTHENTICATION
// ============================================
async function joinChat() {
    const username = usernameInput.value.trim() || 'anonymous';
    
    if (username.length > 20) {
        alert('Username too long (max 20 characters)');
        return;
    }

    currentUser = username;
    currentUsername.textContent = username;

    // Switch screens
    loginScreen.classList.remove('active');
    chatScreen.classList.add('active');

    // Load messages and subscribe
    await loadMessages();
    subscribeToMessages();

    // Send join notification
    await sendSystemMessage(`${username} joined the chat`);

    // Focus message input
    messageInput.focus();
}

function logout() {
    if (messageSubscription) {
        supabase.removeChannel(messageSubscription);
    }

    // Send leave notification
    if (currentUser) {
        sendSystemMessage(`${currentUser} left the chat`);
    }

    currentUser = null;
    messagesInner.innerHTML = '';
    messageInput.value = '';

    // Switch screens
    chatScreen.classList.remove('active');
    loginScreen.classList.add('active');
}

// ============================================
// MESSAGES
// ============================================
async function loadMessages() {
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(100);

        if (error) throw error;

        messagesInner.innerHTML = '';
        data.forEach(msg => displayMessage(msg));
        scrollToBottom();
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function subscribeToMessages() {
    messageSubscription = supabase
        .channel('messages')
        .on('postgres_changes', 
            { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'messages' 
            }, 
            (payload) => {
                displayMessage(payload.new);
                scrollToBottom();
            }
        )
        .subscribe();
}

async function sendMessage() {
    const text = messageInput.value.trim();
    
    if (!text || !currentUser) return;

    try {
        const { error } = await supabase
            .from('messages')
            .insert([
                { 
                    username: currentUser,
                    message: text,
                    message_type: 'user'
                }
            ]);

        if (error) throw error;

        messageInput.value = '';
        updateCharCount();
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

async function sendSystemMessage(text) {
    try {
        await supabase
            .from('messages')
            .insert([
                { 
                    username: 'SYSTEM',
                    message: text,
                    message_type: 'system'
                }
            ]);
    } catch (error) {
        console.error('Error sending system message:', error);
    }
}

function displayMessage(msg) {
    const messageDiv = document.createElement('div');
    
    if (msg.message_type === 'system') {
        messageDiv.className = 'system-message';
        messageDiv.textContent = msg.message;
    } else {
        messageDiv.className = 'message';
        if (msg.username === currentUser) {
            messageDiv.classList.add('own');
        }

        const time = new Date(msg.created_at).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-username">${escapeHtml(msg.username)}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-text">${escapeHtml(msg.message)}</div>
        `;
    }

    messagesInner.appendChild(messageDiv);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function updateCharCount() {
    const length = messageInput.value.length;
    charCount.textContent = `${length}/500`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Update online count (simplified version)
function updateOnlineCount() {
    // In a real app, you'd track active connections
    // For now, just show a random number between 1-10
    onlineCount.textContent = Math.floor(Math.random() * 10) + 1;
}

// ============================================
// EVENT LISTENERS
// ============================================
joinBtn.addEventListener('click', joinChat);

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinChat();
    }
});

logoutBtn.addEventListener('click', logout);

sendBtn.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

messageInput.addEventListener('input', updateCharCount);

// ============================================
// INITIALIZATION
// ============================================
updateOnlineCount();
setInterval(updateOnlineCount, 30000); // Update every 30 seconds

// Auto-focus username input on load
usernameInput.focus();