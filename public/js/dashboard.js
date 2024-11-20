document.addEventListener('DOMContentLoaded', function() {
    // Load initial projects and count
    loadProjects();
    
    // Add event listeners for search and filters
    document.getElementById('searchInput').addEventListener('input', debounce(loadProjects, 500));
    document.getElementById('categoryFilter').addEventListener('change', loadProjects);
    document.getElementById('teamSizeFilter').addEventListener('change', loadProjects);
    document.getElementById('universityFilter').addEventListener('change', loadProjects);
    
    // Initial load of notification counts
    updateNotificationCounts();
    
    // Update notification counts every 30 seconds
    setInterval(updateNotificationCounts, 30000);

    // Add form submission handler
    document.getElementById('applicationForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const reason = document.getElementById('reason');
        const experience = document.getElementById('experience');
        
        if (!reason || !experience) {
            showCoolNotification('Please fill in all required fields', 'error');
            return;
        }

        // Check word limits
        const reasonValid = updateCharCount(reason, 'reasonCount');
        const experienceValid = updateCharCount(experience, 'experienceCount');
        
        if (!reasonValid || !experienceValid) {
            showCoolNotification('Please respect the word limits for each field', 'error');
            return;
        }

        const projectId = document.getElementById('projectId').value;
        const positionTitle = document.getElementById('positionTitleInput').value;

        try {
            const response = await fetch('/requests/apply', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    projectId,
                    positionTitle,
                    reason: reason.value.trim(),
                    experience: experience.value.trim()
                })
            });

            const data = await response.json();

            if (data.success) {
                // Update UI and handle success
                const buttons = document.querySelectorAll(`button[onclick="handleApply('${projectId}', '${positionTitle}')"]`);
                buttons.forEach(button => {
                    button.textContent = 'Applied';
                    button.disabled = true;
                    button.classList.add('applied');
                    button.removeAttribute('onclick');
                });

                // Update local user data
                if (!user.applications) {
                    user.applications = [];
                }
                user.applications.push({
                    projectId: projectId,
                    positionTitle: positionTitle,
                    appliedAt: new Date()
                });

                closeApplicationModal();
                showCoolNotification('Application submitted successfully! The project admin will review your application.', 'success');
                loadProjects();
            } else {
                showCoolNotification(data.error || 'Failed to submit application', 'error');
            }
        } catch (error) {
            console.error('Error submitting application:', error);
            showCoolNotification('Failed to submit application. Please try again.', 'error');
        }
    });

    // Close modal when clicking outside
    window.onclick = function(event) {
        const modal = document.getElementById('applicationModal');
        if (event.target == modal) {
            closeApplicationModal();
        }
    }
});

// Debounce function to limit API calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function loadProjects() {
    try {
        // Get filter values
        const searchQuery = document.getElementById('searchInput').value.toLowerCase();
        const category = document.getElementById('categoryFilter').value;
        const teamSize = document.getElementById('teamSizeFilter').value;
        const university = document.getElementById('universityFilter').value;

        // First, get the latest user data to ensure we have updated applications
        const userResponse = await fetch('/profile/current');
        const userData = await userResponse.json();
        // Update the global user object with fresh data
        Object.assign(user, userData);

        const response = await fetch('/projects/all');
        const projects = await response.json();

        // Filter projects based on search and filters
        let filteredProjects = projects;

        if (searchQuery) {
            filteredProjects = filteredProjects.filter(project => 
                project.title.toLowerCase().includes(searchQuery)
            );
        }

        if (category) {
            filteredProjects = filteredProjects.filter(project => 
                project.category === category
            );
        }

        if (teamSize) {
            filteredProjects = filteredProjects.filter(project => 
                project.teamSize === teamSize
            );
        }

        if (university) {
            filteredProjects = filteredProjects.filter(project => 
                project.author && project.author.university === university
            );
        }

        // Update project count
        document.getElementById('projectCount').textContent = filteredProjects.length;

        // Render projects with updated user data
        renderProjects(filteredProjects);
    } catch (error) {
        console.error('Error loading projects:', error);
    }
}

function renderProjects(projects) {
    const container = document.getElementById('projectsContainer');
    container.innerHTML = '';

    // Function to truncate text and add read more link
    const truncateText = (text, limit, type = 'project', title = '') => {
        if (!text) return 'No description available';
        
        if (text.length <= limit) {
            return text;
        }
        
        const truncated = text.substring(0, limit).trim();
        // Properly escape the text for HTML attributes
        const escapedTitle = title.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const escapedText = text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        
        return `
            <div class="truncated-text">
                ${truncated}... 
                <span class="read-more-btn" 
                    data-title="${escapedTitle}"
                    data-description="${escapedText}"
                    data-type="${type}"
                    onclick="showFullDescription(this)">
                    Read More
                </span>
            </div>`;
    };

    projects.forEach(project => {
        const isSaved = user.savedProjects && user.savedProjects.some(sp => 
            sp.projectId.toString() === project._id.toString()
        );

        const isAdmin = project.author && user ? project.author._id === user.id : false;
        const timeAgo = getTimeAgo(new Date(project.createdAt));
        
        const card = document.createElement('div');
        card.className = 'project-card';
        
        card.innerHTML = `
            <img src="${project.image || '/images/default-project.jpg'}" alt="${project.title}" class="project-image">
            <div class="project-info">
                <h3 class="project-title">${project.title}</h3>
                <div class="project-description truncated-text">
                    ${truncateText(project.description, 150, 'project', project.title)}
                </div>
                
                <div class="meta-info">
                    <div class="meta-info-item">
                        <strong>Category</strong>
                        <span>${project.category}</span>
                    </div>
                    <div class="meta-info-item">
                        <strong>Team Size</strong>
                        <span>${project.teamSize}</span>
                    </div>
                    <div class="meta-info-item">
                        <strong>Admin</strong>
                        <span>${project.adminName}</span>
                    </div>
                    <div class="meta-info-item">
                        <strong>University</strong>
                        <span>${project.author ? project.author.university || 'Not specified' : 'Not specified'}</span>
                    </div>
                </div>

                <div class="positions-section">
                    <h4 class="positions-heading">
                        <i class="ri-team-line"></i> Open Positions
                    </h4>
                    ${project.positions.map(position => {
                        const hasApplied = user.applications && user.applications.some(app => 
                            app.projectId === project._id && app.positionTitle === position.title
                        );
                        return `
                            <div class="position-item">
                                <div class="position-info">
                                    <strong>${position.title}</strong>
                                    <div class="position-description">
                                        ${truncateText(position.description, 100, 'position', position.title)}
                                    </div>
                                </div>
                                ${!isAdmin ? `
                                    <button onclick="handleApply('${project._id}', '${position.title}')" 
                                            class="btn-apply ${hasApplied ? 'applied' : ''}"
                                            ${hasApplied ? 'disabled' : ''}>
                                        ${hasApplied ? 'Applied' : 'Apply'}
                                    </button>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>

                ${!isAdmin ? `
                    <button onclick="sendProjectMessage('${project.author._id}', '${project.adminName}', '${project.title}', '${project.positions.map(p => p.title).join(", ")}')" 
                            class="message-admin-btn">
                        <i class="ri-message-3-line"></i> Want to know more about the project and open positions?
                    </button>
                ` : ''}

                <div class="project-footer">
                    <span class="timestamp">${timeAgo}</span>
                    <div class="card-actions">
                        ${!isAdmin ? `
                            <button onclick="toggleSaveProject('${project._id}')" 
                                    class="action-btn ${isSaved ? 'saved' : ''}" 
                                    title="${isSaved ? 'Remove from saved' : 'Save project'}">
                                <i class="${isSaved ? 'fa-solid' : 'fa-regular'} fa-bookmark"></i>
                            </button>
                        ` : ''}
                        <button onclick="shareProject('${project._id}', '${project.title}')" 
                                class="action-btn" 
                                title="Share project">
                            <i class="fa-solid fa-share-nodes"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// Update the toggleSaveProject function
async function toggleSaveProject(projectId) {
    try {
        const response = await fetch(`/projects/save/${projectId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        if (data.success) {
            // Update local user data
            if (!user.savedProjects) {
                user.savedProjects = [];
            }
            
            const savedIndex = user.savedProjects.findIndex(sp => 
                sp.projectId.toString() === projectId.toString()
            );

            if (savedIndex === -1 && data.saved) {
                user.savedProjects.push({ projectId });
                showSavePopup(true);
            } else if (savedIndex !== -1 && !data.saved) {
                user.savedProjects.splice(savedIndex, 1);
                showSavePopup(false);
            }

            // Update session storage
            sessionStorage.setItem('user', JSON.stringify(user));

            // Refresh the projects display
            await loadProjects();
        } else {
            throw new Error(data.error || 'Failed to save project');
        }
    } catch (error) {
        console.error('Error toggling save:', error);
        alert(error.message || 'Failed to save project');
    }
}

// Add share functionality
function shareProject(projectId, title) {
    const shareUrl = `${window.location.origin}/projects/${projectId}`;
    const shareMessage = `🚀 *Exciting Project on Alchemy!*\n\n📌 *${title}*\n\n🔗 Check it out here:\n${shareUrl}\n\n#Alchemy #Collaboration #TeamProject`;
    
    // Create and show share modal
    const modal = document.createElement('div');
    modal.className = 'share-modal';
    modal.innerHTML = `
        <div class="share-content">
            <h3><i class="ri-share-forward-line"></i> Share Project</h3>
            <div class="share-buttons">
                <a href="https://wa.me/?text=${encodeURIComponent(shareMessage)}" 
                   target="_blank" class="share-button whatsapp">
                   <i class="ri-whatsapp-line"></i> Share on WhatsApp
                </a>
                <a href="mailto:?subject=${encodeURIComponent(`Check out this project on Alchemy: ${title}`)}&body=${encodeURIComponent(shareMessage)}" 
                   class="share-button email">
                   <i class="ri-mail-line"></i> Share via Email
                </a>
                <button onclick="copyProjectLink('${shareMessage}')" class="share-button copy">
                   <i class="ri-file-copy-line"></i> Copy Link
                </button>
            </div>
            <button onclick="closeShareModal(this)" class="close-modal">
                <i class="ri-close-line"></i>
            </button>
        </div>
    `;
    document.body.appendChild(modal);

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeShareModal(modal);
        }
    });
}

// Function to copy text to clipboard
async function copyProjectLink(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Message copied to clipboard!');
        closeShareModal(document.querySelector('.share-modal'));
    } catch (err) {
        console.error('Failed to copy:', err);
        showToast('Failed to copy to clipboard');
    }
}

// Function to show toast notification
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'copy-toast';
    toast.innerHTML = `
        <i class="ri-check-line"></i> ${message}
    `;
    document.body.appendChild(toast);

    // Remove toast after animation
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Function to close share modal
function closeShareModal(element) {
    const modal = element.closest('.share-modal');
    if (modal) {
        modal.remove();
    }
}

// Add this function to calculate time ago
function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    let interval = Math.floor(seconds / 31536000);
    if (interval > 1) return interval + ' years ago';
    if (interval === 1) return 'a year ago';
    
    interval = Math.floor(seconds / 2592000);
    if (interval > 1) return interval + ' months ago';
    if (interval === 1) return 'a month ago';
    
    interval = Math.floor(seconds / 86400);
    if (interval > 1) return interval + ' days ago';
    if (interval === 1) return 'yesterday';
    
    interval = Math.floor(seconds / 3600);
    if (interval > 1) return interval + ' hours ago';
    if (interval === 1) return 'an hour ago';
    
    interval = Math.floor(seconds / 60);
    if (interval > 1) return interval + ' minutes ago';
    if (interval === 1) return 'a minute ago';
    
    if (seconds < 10) return 'just now';
    
    return Math.floor(seconds) + ' seconds ago';
}

// Function to update notification counts
async function updateNotificationCounts() {
    try {
        const response = await fetch('/notifications/counts');
        const data = await response.json();
        
        // Update message count
        const messageCount = document.getElementById('messageCount');
        messageCount.textContent = data.messages;
        messageCount.style.display = data.messages > 0 ? 'block' : 'none';
        
        // Update request count
        const requestCount = document.getElementById('requestCount');
        requestCount.textContent = data.requests;
        requestCount.style.display = data.requests > 0 ? 'block' : 'none';
    } catch (error) {
        console.error('Error updating notification counts:', error);
    }
}

function handleApply(projectId, positionTitle) {
    // Check if profile is completed
    if (!user.profileCompleted) {
        showCoolNotification(
            `<div class="notification-content-wrapper">
                <div class="notification-icon">
                    <i class="ri-profile-line"></i>
                </div>
                <div class="notification-text">
                    Please complete your profile before applying for positions.
                </div>
            </div>`, 
            'mint'
        );
        return;
    }

    // Show the modal and set the form values
    const modal = document.getElementById('applicationModal');
    document.getElementById('projectId').value = projectId;
    document.getElementById('positionTitleInput').value = positionTitle;
    modal.style.display = 'flex';
}

function closeApplicationModal() {
    const modal = document.getElementById('applicationModal');
    modal.style.display = 'none';
    // Clear form
    document.getElementById('applicationForm').reset();
}

// Helper functions
function isProjectAdmin(project) {
    return project.author._id === user.id;
}

function hasApplied(project, position) {
    if (!user.applications) return false;
    
    return user.applications.some(app => {
        // Convert projectId to string for comparison if it's an ObjectId
        const appProjectId = typeof app.projectId === 'object' ? 
            app.projectId.toString() : app.projectId;
        const currentProjectId = typeof project._id === 'object' ? 
            project._id.toString() : project._id;
            
        return appProjectId === currentProjectId && 
               app.positionTitle === position.title;
    });
}

// Update the sendProjectMessage function
function sendProjectMessage(adminId, adminName, projectTitle, positions) {
    try {
        // Check if profile is completed
        if (!user.profileCompleted) {
            showCoolNotification(
                `<div class="notification-content-wrapper">
                    <div class="notification-icon">
                        <i class="ri-profile-line"></i>
                    </div>
                    <div class="notification-text">
                        Please complete your profile before messaging.
                    </div>
                </div>`, 
                'success'
            );
            return;
        }

        // Create a pre-written message about the project and positions
        let message = `Hi, I want to know more about your project "${projectTitle}"`;
        
        // Add positions if they exist
        if (positions) {
            message += `. I'm interested in learning about the open positions: ${positions}`;
        }
        
        // Encode the message and username for the URL
        const encodedMessage = encodeURIComponent(message);
        const encodedUsername = encodeURIComponent(adminName);
        
        // Redirect to messages with the pre-written message
        window.location.href = `/messages?userId=${adminId}&username=${encodedUsername}&message=${encodedMessage}`;
    } catch (error) {
        console.error('Error redirecting to messages:', error);
        showCoolNotification('Failed to open message window', 'error');
    }
}

// Add this function to handle request acceptance
async function acceptRequest(requestId) {
    try {
        const response = await fetch(`/requests/${requestId}/accept`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (data.success) {
            // Refresh the projects display to show updated team size
            loadProjects();
            
            // Show success message
            alert('Request accepted successfully!');
        } else {
            alert(data.error || 'Failed to accept request');
        }
    } catch (error) {
        console.error('Error accepting request:', error);
        alert('Failed to accept request');
    }
}

// Update the showFullDescription function to use data attributes
function showFullDescription(element) {
    try {
        const title = element.getAttribute('data-title');
        const description = element.getAttribute('data-description');
        const type = element.getAttribute('data-type');

        console.log('Opening modal for:', { title, description, type });
        
        // Remove any existing modals
        const existingModals = document.querySelectorAll('.description-modal');
        existingModals.forEach(modal => modal.remove());

        // Create new modal
        const modal = document.createElement('div');
        modal.className = 'description-modal';
        
        // Create the modal content
        modal.innerHTML = `
            <div class="description-content">
                <h3>${type === 'position' ? `Position: ${title}` : title}</h3>
                <div class="description-text">${description}</div>
                <button class="close-modal" onclick="closeDescriptionModal(this)">×</button>
            </div>
        `;
        
        document.body.appendChild(modal);

        // Show modal with animation
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);

        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeDescriptionModal(modal);
            }
        });

        // Close modal with Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                const openModal = document.querySelector('.description-modal.show');
                if (openModal) {
                    closeDescriptionModal(openModal);
                }
            }
        });
    } catch (error) {
        console.error('Error showing description:', error);
    }
}

// Update the closeDescriptionModal function
function closeDescriptionModal(element) {
    const modal = element.closest('.description-modal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

// Add this function to show the save/unsave popup
function showSavePopup(isSaved) {
    // Remove any existing popups
    const existingPopup = document.querySelector('.save-popup');
    if (existingPopup) {
        existingPopup.remove();
    }

    // Create new popup
    const popup = document.createElement('div');
    popup.className = 'save-popup';
    popup.innerHTML = `
        <div class="save-popup-content">
            <i class="${isSaved ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark'}"></i>
            <p>${isSaved ? 'Project Saved!' : 'Project Removed'}</p>
        </div>
    `;
    document.body.appendChild(popup);

    // Add animation class after a small delay
    setTimeout(() => {
        popup.classList.add('show');
    }, 10);

    // Remove popup after animation
    setTimeout(() => {
        popup.classList.remove('show');
        setTimeout(() => {
            popup.remove();
        }, 300);
    }, 2000);
}

// Update the updateCharCount function to handle undefined values
function updateCharCount(element, counterId) {
    if (!element) return false;
    
    const text = element.value || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const maxWords = parseInt(element.getAttribute('data-max-words')) || 250;
    const counter = document.getElementById(counterId);
    
    if (counter) {
        counter.textContent = `${words}/${maxWords} words`;
        
        // Add warning color when near limit
        if (words >= maxWords * 0.9) {
            counter.classList.add('limit');
        } else {
            counter.classList.remove('limit');
        }
    }

    // Return true if within limit, false if exceeded
    return words <= maxWords;
}

// Add these styles to dashboard.css
const style = document.createElement('style');
style.textContent = `
    .cool-notification {
        position: fixed;
        top: -100px;
        left: 50%;
        transform: translateX(-50%);
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 4px 30px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 1000;
        transition: all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        min-width: 300px;
        backdrop-filter: blur(10px);
    }

    .cool-notification.mint {
        background: #ADEFD1;
        border-left: 4px solid #00203F;
    }

    .notification-content-wrapper {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
    }

    .cool-notification.mint .notification-icon {
        font-size: 24px;
        color: #00203F;
    }

    .cool-notification.mint .notification-text {
        color: #00203F;
        font-size: 0.95rem;
        font-weight: 500;
    }

    .cool-notification.show {
        top: 20px;
        animation: bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
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

// Add these styles for the enhanced notification
const notificationStyles = document.createElement('style');
notificationStyles.textContent = `
    .cool-notification {
        position: fixed;
        top: -100px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, var(--sailor-blue) 0%, #004a7c 100%);
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 4px 30px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 1000;
        transition: all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        min-width: 300px;
        border-left: 4px solid var(--mint);
        backdrop-filter: blur(10px);
    }

    .cool-notification.error {
        background: linear-gradient(135deg, #ff4757 0%, #ff6b81 100%);
        border-left: 4px solid #ff6b81;
    }

    .cool-notification.success {
        background: linear-gradient(135deg, #00203F 0%, #004a7c 100%);
        border-left: 4px solid #ADEFD1;
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
        color: white;
    }

    .notification-content {
        flex: 1;
        color: white;
    }

    .notification-message {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .notification-message i {
        font-size: 1.2rem;
    }

    .notification-message a {
        transition: all 0.3s ease;
    }

    .notification-message a:hover {
        opacity: 0.8;
        transform: translateY(-1px);
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
document.head.appendChild(notificationStyles);

// Update the showCoolNotification function to handle HTML content properly
function showCoolNotification(message, type = 'error') {
    let notification = document.getElementById('coolNotification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'coolNotification';
        notification.className = 'cool-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-message" id="notificationMessage"></div>
            </div>
        `;
        document.body.appendChild(notification);
    }

    // Reset classes and set new content
    notification.className = 'cool-notification';
    notification.classList.add(type);
    document.getElementById('notificationMessage').innerHTML = message;

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

// Add these additional styles for the enhanced notification
const additionalStyles = document.createElement('style');
additionalStyles.textContent = `
    .cool-notification.warning {
        background: linear-gradient(135deg, #f7b731 0%, #f0932b 100%);
        border-left: 4px solid #ffdd59;
        min-width: 350px;
        padding: 0;
    }

    .notification-content-wrapper {
        display: flex;
        align-items: center;
        gap: 20px;
        padding: 20px;
    }

    .notification-icon-large {
        background: rgba(255, 255, 255, 0.2);
        width: 50px;
        height: 50px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .notification-icon-large i {
        font-size: 28px;
        color: white;
    }

    .notification-text {
        flex: 1;
    }

    .notification-text h4 {
        color: white;
        margin: 0 0 5px 0;
        font-size: 1.1rem;
        font-weight: 600;
    }

    .notification-text p {
        color: rgba(255, 255, 255, 0.9);
        margin: 0 0 12px 0;
        font-size: 0.9rem;
        line-height: 1.4;
    }

    .profile-link {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(255, 255, 255, 0.2);
        color: white;
        text-decoration: none;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: 500;
        transition: all 0.3s ease;
    }

    .profile-link:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: translateY(-2px);
    }

    .profile-link i {
        font-size: 1.1rem;
        transition: transform 0.3s ease;
    }

    .profile-link:hover i {
        transform: translateX(3px);
    }

    @keyframes slideIn {
        0% {
            transform: translateX(-50%) translateY(-100%);
            opacity: 0;
        }
        100% {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
    }

    .cool-notification.warning.show {
        animation: slideIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
    }

    @keyframes pulseIcon {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
    }

    .notification-icon-large i {
        animation: pulseIcon 2s ease infinite;
    }
`;
document.head.appendChild(additionalStyles);

// Add the notification function and styles
function showNotification(message, type = 'error') {
    let notification = document.getElementById('coolNotification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'coolNotification';
        notification.className = 'cool-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <p class="notification-message" id="notificationMessage"></p>
            </div>
        `;
        document.body.appendChild(notification);
    }

    // Reset classes and set new content
    notification.className = 'cool-notification';
    notification.classList.add(type);
    document.getElementById('notificationMessage').innerHTML = message;

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