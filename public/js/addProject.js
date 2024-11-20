document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('addProjectForm');
    const description = document.getElementById('description');
    const wordCount = document.getElementById('wordCount');
    const imageInput = document.getElementById('projectImage');
    const uploadText = document.querySelector('.upload-text');

    // Handle image input change
    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            uploadText.textContent = file.name;
        }
    });

    // Word count handler
    description.addEventListener('input', updateWordCount);

    // Form submission handler
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Validate positions before submission
        const positions = getPositionsData();
        if (!validatePositions(positions)) {
            showCoolNotification('Please fill in all position details or remove empty positions', 'error');
            return;
        }

        const formData = new FormData();
        formData.append('title', document.getElementById('title').value);
        formData.append('description', document.getElementById('description').value);
        formData.append('category', document.getElementById('category').value);
        formData.append('teamSize', document.getElementById('teamSize').value);

        const projectImage = document.getElementById('projectImage').files[0];
        if (projectImage) {
            formData.append('projectImage', projectImage);
        }

        formData.append('positions', JSON.stringify(positions));

        try {
            const response = await fetch('/projects/add', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                showCoolNotification('Project created successfully! 🚀', 'success');
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 1500);
            } else {
                showCoolNotification(data.error || 'Failed to create project', 'error');
            }
        } catch (error) {
            console.error('Error creating project:', error);
            showCoolNotification('Failed to create project', 'error');
        }
    });
});

let positionCount = 0;

// Add position form
function addPositionForm() {
    positionCount++;
    const positionsContainer = document.getElementById('positionsContainer');

    const positionForm = document.createElement('div');
    positionForm.className = 'position-form';
    positionForm.innerHTML = `
        <div class="position-header">
            <h4>Position #${positionCount}</h4>
            <button type="button" class="btn btn-remove" onclick="removePosition(this)">×</button>
        </div>
        <div class="form-group">
            <label>Role Title</label>
            <input type="text" name="positions[${positionCount}].title" required placeholder="e.g., Frontend Developer">
        </div>
        <div class="form-group">
            <label>Role Description</label>
            <textarea name="positions[${positionCount}].description" rows="3" required placeholder="Describe the role requirements..."></textarea>
        </div>
    `;

    positionsContainer.appendChild(positionForm);
}

// Remove position form
function removePosition(button) {
    const positionForm = button.closest('.position-form');
    positionForm.remove();
}

function updateWordCount() {
    const words = description.value.trim().split(/\s+/).filter(Boolean).length;
    wordCount.textContent = words;
    wordCount.style.color = words > 200 ? '#dc3545' : '#666';
    return words <= 200;
}

function validateForm() {
    let isValid = true;

    // Validate title
    const title = document.getElementById('title').value.trim();
    if (!title) {
        showError('titleError', 'Project title is required');
        isValid = false;
    }

    // Validate description
    if (!description.value.trim()) {
        showError('descriptionError', 'Project description is required');
        isValid = false;
    } else if (!updateWordCount()) {
        showError('descriptionError', 'Description cannot exceed 200 words');
        isValid = false;
    }

    // Validate category
    if (!document.getElementById('category').value) {
        showError('categoryError', 'Please select a category');
        isValid = false;
    }

    // Validate team size
    if (!document.getElementById('teamSize').value) {
        showError('teamSizeError', 'Please select team size');
        isValid = false;
    }

    // Validate image
    const imageFile = document.getElementById('projectImage').files[0];
    if (!imageFile) {
        showError('imageError', 'Project image is required');
        isValid = false;
    }

    return isValid;
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

function clearErrors() {
    const errorElements = document.querySelectorAll('.error-message');
    errorElements.forEach(element => {
        element.textContent = '';
        element.style.display = 'none';
    });
}

// Handle image preview
document.getElementById('projectImage').addEventListener('change', function(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('preview');
    const uploadText = document.querySelector('.upload-text');
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
            uploadText.style.display = 'none';
        }
        reader.readAsDataURL(file);
    }
});

// Make functions globally available
window.addPosition = function() {
    const positionCount = document.querySelectorAll('.position-form').length + 1;
    const template = document.getElementById('positionTemplate');
    const clone = template.content.cloneNode(true);
    
    // Update position number
    clone.querySelector('.position-count').textContent = positionCount;
    
    // Update input names with correct index
    clone.querySelectorAll('input, textarea').forEach(input => {
        const name = input.name.replace('[0]', `[${positionCount - 1}]`);
        input.name = name;
    });
    
    document.getElementById('positionsContainer').appendChild(clone);
};

window.removePosition = function(button) {
    const positionForm = button.closest('.position-form');
    positionForm.remove();
    updatePositionNumbers();
};

function updatePositionNumbers() {
    const positions = document.querySelectorAll('.position-form');
    positions.forEach((position, index) => {
        position.querySelector('.position-count').textContent = index + 1;
        position.querySelectorAll('input, textarea').forEach(input => {
            const name = input.name.replace(/\[\d+\]/, `[${index}]`);
            input.name = name;
        });
    });
}

// Add initial position when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.addPosition();
});

// Add this function to format positions data
function getPositionsData() {
    const positionForms = document.querySelectorAll('.position-form');
    return Array.from(positionForms)
        .map(form => ({
            title: form.querySelector('input[name^="positions"]').value.trim(),
            description: form.querySelector('textarea[name^="positions"]').value.trim()
        }))
        .filter(position => position.title && position.description); // Filter out empty positions
}

// Add this validation function
function validatePositions(positions) {
    if (!positions.length) {
        return false;
    }

    return positions.every(position => 
        position.title && position.title.trim() !== '' &&
        position.description && position.description.trim() !== ''
    );
}

// Add this function at the beginning of the file
function showCoolNotification(message, type = 'error') {
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

    notification.className = 'cool-notification';
    notification.classList.add(type);
    document.getElementById('notificationMessage').textContent = message;

    requestAnimationFrame(() => {
        notification.classList.add('show');
    });

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