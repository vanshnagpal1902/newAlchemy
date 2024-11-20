document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('profileForm');
    const description = document.getElementById('description');
    const wordCount = document.getElementById('wordCount');
    const fullNameInput = document.getElementById('fullName');

    // Available options
    window.availableSkills = [
        "JavaScript", "Python", "Java", "React", "Node.js", "Angular", "Vue.js",
        "PHP", "Ruby", "Swift", "Kotlin", "Flutter", "AWS", "Docker", "Kubernetes"
    ];
    
    window.availableInterests = [
        "Creativity", "Cyber Security", "E-commerce", "Education", "Finance",
        "Fitness", "Gaming", "Marketing", "Non Profits", "Real Estate",
        "Travel", "Web3"
    ];

    // Initialize dropdowns with existing selections
    initializeDropdown('skill', window.availableSkills, window.userData.skills || []);
    initializeDropdown('interest', window.availableInterests, window.userData.interests || []);

    // Set existing description and fullName if available
    if (window.userData) {
        if (window.userData.description) {
            description.value = window.userData.description;
        }
        if (window.userData.fullName) {
            fullNameInput.value = window.userData.fullName;
        }
        updateWordCount();
    }

    // Word count handler
    description.addEventListener('input', updateWordCount);

    // Form submission handler
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            fullName: document.getElementById('fullName').value,
            description: document.getElementById('description').value,
            university: document.getElementById('university').value,
            skills: getSelectedItems('skill'),
            interests: getSelectedItems('interest')
        };

        // Validate minimum skills requirement
        if (formData.skills.length < 5) {
            showCoolNotification('Please select at least 5 skills', 'error');
            return;
        }

        try {
            const response = await fetch('/profile/update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();
            
            if (response.ok) {
                window.userData = {
                    ...window.userData,
                    fullName: data.fullName,
                    description: data.description,
                    university: data.university,
                    skills: data.skills,
                    interests: data.interests,
                    profileCompleted: true
                };

                if (window.user) {
                    window.user = {
                        ...window.user,
                        fullName: data.fullName,
                        description: data.description,
                        university: data.university,
                        skills: data.skills,
                        interests: data.interests,
                        profileCompleted: true
                    };
                }
                
                showCoolNotification('Profile updated successfully!', 'success');
                
                // Redirect after a short delay
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1500);
            } else {
                showCoolNotification(data.error || 'Failed to update profile', 'error');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showCoolNotification('Failed to update profile', 'error');
        }
    });

    // Logout handler
    document.getElementById('logoutBtn').addEventListener('click', () => {
        window.location.href = '/auth/logout';
    });

    // Delete account handler
    document.getElementById('deleteAccountBtn').addEventListener('click', handleDeleteAccount);
});

function initializeDropdown(type, allItems, selectedItems) {
    const input = document.getElementById(`${type}Input`);
    const list = document.getElementById(`${type}sList`);
    const selectedContainer = document.getElementById(`selected${type.charAt(0).toUpperCase() + type.slice(1)}s`);
    
    // Clear existing items
    selectedContainer.innerHTML = '';
    
    // Add existing selections
    const uniqueSelectedItems = [...new Set(selectedItems)]; // Remove duplicates
    uniqueSelectedItems.forEach(item => {
        addItemToContainer(type, item, selectedContainer);
    });

    // Show dropdown on input focus
    input.addEventListener('focus', () => {
        updateDropdownList(type, allItems);
        list.style.display = 'block';
    });

    // Handle input for search
    input.addEventListener('input', (e) => {
        updateDropdownList(type, allItems, e.target.value);
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-container')) {
            list.style.display = 'none';
        }
    });
}

function updateDropdownList(type, allItems, searchTerm = '') {
    const list = document.getElementById(`${type}sList`);
    const currentSelections = getSelectedItems(type);
    
    // Filter items: exclude already selected items and match search term
    const availableItems = allItems.filter(item => 
        !currentSelections.includes(item) &&
        item.toLowerCase().includes(searchTerm.toLowerCase())
    );

    list.innerHTML = availableItems.map(item => `
        <div class="dropdown-item" onclick="addItem('${type}', '${item}')">
            ${item}
        </div>
    `).join('');
}

function addItemToContainer(type, item, container) {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = `
        ${item}
        <span class="tag-remove" onclick="removeItem('${type}', '${item}')">×</span>
    `;
    container.appendChild(tag);
}

function addItem(type, item) {
    const container = document.getElementById(`selected${type.charAt(0).toUpperCase() + type.slice(1)}s`);
    const currentItems = getSelectedItems(type);
    
    // Check if item already exists
    if (!currentItems.includes(item)) {
        addItemToContainer(type, item, container);
        
        // Clear input and update dropdown
        const input = document.getElementById(`${type}Input`);
        input.value = '';
        
        // Update dropdown list
        const allItems = type === 'skill' ? window.availableSkills : window.availableInterests;
        updateDropdownList(type, allItems);
        
        // Hide dropdown
        document.getElementById(`${type}sList`).style.display = 'none';
    }
}

function removeItem(type, item) {
    const container = document.getElementById(`selected${type.charAt(0).toUpperCase() + type.slice(1)}s`);
    const tags = container.getElementsByClassName('tag');
    
    for (let tag of tags) {
        if (tag.textContent.replace('×', '').trim() === item) {
            tag.remove();
            break;
        }
    }
    
    // Update dropdown list after removal
    const allItems = type === 'skill' ? window.availableSkills : window.availableInterests;
    updateDropdownList(type, allItems);
}

function getSelectedItems(type) {
    const container = document.getElementById(`selected${type.charAt(0).toUpperCase() + type.slice(1)}s`);
    const tags = container.getElementsByClassName('tag');
    return Array.from(tags).map(tag => tag.textContent.replace('×', '').trim());
}

async function handleDeleteAccount() {
    if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
        try {
            const response = await fetch('/profile/delete', {
                method: 'DELETE'
            });

            if (response.ok) {
                window.location.href = '/';
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to delete account');
            }
        } catch (error) {
            console.error('Error deleting account:', error);
            alert('Failed to delete account');
        }
    }
}

function updateWordCount() {
    const words = description.value.trim().split(/\s+/).filter(Boolean).length;
    wordCount.textContent = words;
    wordCount.style.color = words > 250 ? '#dc3545' : '#666';
    return words <= 250;
}

// Add this function at the beginning of the file
function showCoolNotification(message, type = 'error') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('coolNotification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'coolNotification';
        notification.className = 'cool-notification';
        notification.innerHTML = `
            <div class="notification-icon">
                <i class="ri-error-warning-line error-icon"></i>
                <i class="ri-checkbox-circle-line success-icon"></i>
            </div>
            <div class="notification-content">
                <p class="notification-message" id="notificationMessage"></p>
            </div>
        `;
        document.body.appendChild(notification);
    }

    // Reset classes and set new content
    notification.className = 'cool-notification';
    notification.classList.add(type);
    document.getElementById('notificationMessage').textContent = message;

    // Show notification
    requestAnimationFrame(() => {
        notification.classList.add('show');
    });

    // Hide notification after delay
    setTimeout(() => {
        notification.style.animation = 'bounceOut 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        setTimeout(() => {
            notification.classList.remove('show');
            notification.style.animation = '';
        }, 500);
    }, 3000);
}

// Add the notification styles
const style = document.createElement('style');
style.textContent = `
    .cool-notification {
        position: fixed;
        top: -100px;
        left: 50%;
        transform: translateX(-50%);
        background: white;
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 4px 30px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 1000;
        transition: all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        min-width: 300px;
        border-left: 4px solid;
    }

    .cool-notification.error {
        background: #fff5f5;
        border-color: #ff4757;
    }

    .cool-notification.success {
        background: #f0fff4;
        border-color: #00203F;
    }

    .cool-notification.show {
        top: 20px;
        animation: bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    }

    .notification-icon {
        font-size: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .error-icon {
        color: #ff4757;
        display: none;
    }

    .success-icon {
        color: #00203F;
        display: none;
    }

    .cool-notification.error .error-icon {
        display: block;
    }

    .cool-notification.success .success-icon {
        display: block;
    }

    .notification-content {
        flex: 1;
    }

    .notification-message {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 500;
        color: #2d3436;
    }

    @keyframes bounceIn {
        0% {
            top: -100px;
            transform: translateX(-50%) scale(0.8);
        }
        50% {
            top: 30px;
            transform: translateX(-50%) scale(1.1);
        }
        100% {
            top: 20px;
            transform: translateX(-50%) scale(1);
        }
    }

    @keyframes bounceOut {
        0% {
            top: 20px;
            transform: translateX(-50%) scale(1);
            opacity: 1;
        }
        100% {
            top: -100px;
            transform: translateX(-50%) scale(0.8);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style); 