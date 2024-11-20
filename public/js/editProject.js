document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('editProjectForm');
    const description = document.getElementById('description');
    const wordCount = document.getElementById('wordCount');
    const imageInput = document.getElementById('projectImage');
    const preview = document.getElementById('preview');
    const uploadText = document.querySelector('.upload-text');

    // Update initial word count
    updateWordCount();

    // Handle image input change
    imageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                document.querySelector('.preview-image').src = e.target.result;
            }
            reader.readAsDataURL(file);
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
            alert('Please fill in all position details or remove empty positions');
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
            const response = await fetch(`/projects/${project._id}`, {
                method: 'PUT',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                alert('Project updated successfully!');
                window.location.href = '/projects/your';
            } else {
                alert(data.error || 'Failed to update project');
            }
        } catch (error) {
            console.error('Error updating project:', error);
            alert('Failed to update project');
        }
    });
});

function updateWordCount() {
    const words = description.value.trim().split(/\s+/).filter(Boolean).length;
    wordCount.textContent = words;
    wordCount.style.color = words > 200 ? '#dc3545' : '#666';
    return words <= 200;
}

function getPositionsData() {
    const positionForms = document.querySelectorAll('.position-form');
    return Array.from(positionForms)
        .map(form => ({
            title: form.querySelector('input[name^="positions"]').value.trim(),
            description: form.querySelector('textarea[name^="positions"]').value.trim()
        }))
        .filter(position => position.title && position.description);
}

function validatePositions(positions) {
    if (!positions.length) {
        return false;
    }

    return positions.every(position => 
        position.title && position.title.trim() !== '' &&
        position.description && position.description.trim() !== ''
    );
}

window.addPosition = function() {
    const positionCount = document.querySelectorAll('.position-form').length + 1;
    const template = document.getElementById('positionTemplate');
    const clone = template.content.cloneNode(true);
    
    clone.querySelector('.position-count').textContent = positionCount;
    
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
        position.querySelector('.position-number').textContent = `Position #${index + 1}`;
        position.querySelectorAll('input, textarea').forEach(input => {
            const name = input.name.replace(/\[\d+\]/, `[${index}]`);
            input.name = name;
        });
    });
} 