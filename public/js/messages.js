let currentChatId = null;

// Listen for new messages
socket.on('new message', (data) => {
    if (data.message.sender === userId || data.message.recipient === userId) {
        if (currentChatId === (data.message.sender === userId ? data.message.recipient : data.message.sender)) {
            appendMessage(data.message);
            scrollToBottom();
            // Mark message as read if we're the recipient
            if (data.message.recipient === userId) {
                markMessagesAsRead(data.message.sender);
            }
        } else {
            // Update chat list to show new message
            updateChatList();
        }
    }
});

// Function to send message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (!content || !currentChatId) return;

    try {
        const response = await fetch('/messages/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipientId: currentChatId,
                content: content
            })
        });

        const data = await response.json();
        if (data.success) {
            input.value = '';
            // Message will be added through socket event
        }
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message');
    }
}

// Function to load chat messages
async function loadChat(userId, username) {
    currentChatId = userId;
    document.getElementById('chatUserName').textContent = username;
    
    document.getElementById('noChatSelected').style.display = 'none';
    document.getElementById('activeChat').style.display = 'flex';

    try {
        const response = await fetch(`/messages/chat/${userId}`);
        const messages = await response.json();
        
        const messagesContainer = document.getElementById('messagesContainer');
        messagesContainer.innerHTML = '';
        
        messages.forEach(message => {
            appendMessage(message);
        });

        scrollToBottom();
        markMessagesAsRead(userId);
        
        // Update active chat in list
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.userId === userId) {
                item.classList.add('active');
            }
        });
    } catch (error) {
        console.error('Error loading chat:', error);
    }
}

// Function to append a message to the chat
function appendMessage(message) {
    const messagesContainer = document.getElementById('messagesContainer');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.sender === userId ? 'sent' : 'received'}`;
    
    const time = new Date(message.createdAt).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    messageDiv.innerHTML = `
        ${message.content}
        <div class="message-time">
            ${time}
            ${message.sender === userId ? 
                `<i class="fas ${message.read ? 'fa-check-double' : 'fa-check'}"></i>` : 
                ''}
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
}

// Function to scroll chat to bottom
function scrollToBottom() {
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Function to update chat list
async function updateChatList() {
    try {
        const response = await fetch('/messages/chats');
        const chats = await response.json();
        
        const chatsList = document.getElementById('chatsList');
        chatsList.innerHTML = '';
        
        chats.forEach(chat => {
            const chatItem = document.createElement('div');
            chatItem.className = `chat-item ${chat.userId === currentChatId ? 'active' : ''}`;
            chatItem.dataset.userId = chat.userId;
            
            if (chat.unreadCount > 0 && chat.userId !== currentChatId) {
                chatItem.innerHTML += '<div class="unread-indicator"></div>';
            }

            chatItem.innerHTML += `
                <div class="chat-user-info">
                    <h4>${chat.username}</h4>
                    <p class="last-message">${chat.lastMessage}</p>
                </div>
                <span class="last-message-time">
                    ${formatTime(new Date(chat.lastMessageDate))}
                </span>
            `;
            
            chatItem.onclick = () => loadChat(chat.userId, chat.username);
            chatsList.appendChild(chatItem);
        });
    } catch (error) {
        console.error('Error updating chat list:', error);
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Load initial chat list
    updateChatList();
    
    // Set up message input
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendMessage');

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    sendButton.addEventListener('click', sendMessage);

    // Load chat if target user is provided
    if (currentChatUser && currentChatUsername) {
        loadChat(currentChatUser, currentChatUsername);
    }

    // Handle search
    const searchInput = document.getElementById('searchChats');
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        document.querySelectorAll('.chat-item').forEach(item => {
            const username = item.querySelector('h4').textContent.toLowerCase();
            item.style.display = username.includes(searchTerm) ? 'flex' : 'none';
        });
    });
});

// Initialize with pre-filled message if provided
if (prefilledMessage) {
    document.getElementById('messageInput').value = decodeURIComponent(prefilledMessage);
}

// Function to mark messages as read
function markMessagesAsRead(chatId) {
    const unreadIndicator = document.querySelector(`.chat-item[data-chat-id="${chatId}"] .unread-indicator`);
    if (unreadIndicator) {
        unreadIndicator.remove();
    }

    // Update on server
    fetch(`/messages/read/${chatId}`, {
        method: 'POST'
    });
}

// Function to format time
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
        return 'Yesterday';
    } else if (days < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
    } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
}

// Update chat list order when new message arrives
socket.on('new message', (data) => {
    const chatItem = document.querySelector(`.chat-item[data-chat-id="${data.chatId}"]`);
    if (chatItem) {
        // Add unread indicator if not current chat
        if (currentChatId !== data.chatId) {
            if (!chatItem.querySelector('.unread-indicator')) {
                const indicator = document.createElement('div');
                indicator.className = 'unread-indicator';
                chatItem.appendChild(indicator);
            }
        }
        
        // Move chat to top
        const chatsList = document.querySelector('.chats');
        chatsList.insertBefore(chatItem, chatsList.firstChild);
        
        // Update last message and time
        chatItem.querySelector('.last-message').textContent = data.message;
        chatItem.querySelector('.last-message-time').textContent = formatTime(new Date());
    }
}); 