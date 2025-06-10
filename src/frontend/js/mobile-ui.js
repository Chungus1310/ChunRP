// Mobile-specific UI enhancements for ChunRP

document.addEventListener('DOMContentLoaded', function() {
    // Initialize mobile character selector
    initMobileCharacterSelector();
    
    // Initialize mobile input behaviors
    initMobileInputBehaviors();
});

// Initialize mobile-specific input behaviors
function initMobileInputBehaviors() {
    const messageInput = document.getElementById('message-input');
    const mobileNavFooter = document.getElementById('mobile-nav-footer');
    let isInputFocused = false;

    if (messageInput && mobileNavFooter) {
        // Handle input focus/blur for better mobile experience
        messageInput.addEventListener('focus', () => {
            isInputFocused = true;
            // On small screens, hide the mobile nav to give more space
            if (window.innerWidth <= 480) {
                mobileNavFooter.classList.add('input-focused');
            }
            
            // Auto-resize textarea on focus
            autoResizeTextarea(messageInput);
        });

        messageInput.addEventListener('blur', () => {
            isInputFocused = false;
            // Show mobile nav again
            setTimeout(() => {
                if (!isInputFocused) {
                    mobileNavFooter.classList.remove('input-focused');
                }
            }, 100);
        });

        // Auto-resize textarea as user types
        messageInput.addEventListener('input', () => {
            autoResizeTextarea(messageInput);
        });

        // Handle viewport height changes (mobile keyboard)
        let initialViewportHeight = window.innerHeight;
        window.addEventListener('resize', () => {
            if (window.innerWidth <= 768) {
                const currentHeight = window.innerHeight;
                const heightDiff = initialViewportHeight - currentHeight;
                
                // If keyboard is likely open (significant height reduction)
                if (heightDiff > 150 && isInputFocused) {
                    mobileNavFooter.classList.add('input-focused');
                } else if (heightDiff < 100) {
                    mobileNavFooter.classList.remove('input-focused');
                    initialViewportHeight = currentHeight;
                }
            }
        });
    }
}

// Auto-resize textarea to fit content
function autoResizeTextarea(textarea) {
    if (!textarea) return;
    
    // Reset height to auto to get proper scrollHeight
    textarea.style.height = 'auto';
    
    // Set height based on content, with min/max constraints
    const minHeight = window.innerWidth <= 480 ? 40 : 44;
    const maxHeight = window.innerWidth <= 480 ? 70 : 80;
    
    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = newHeight + 'px';
}

// Create and initialize the mobile character selector overlay
function initMobileCharacterSelector() {
    // Create the modal if it doesn't exist yet
    if (!document.getElementById('mobile-character-selector')) {
        const mobileCharacterSelector = document.createElement('div');
        mobileCharacterSelector.id = 'mobile-character-selector';
        mobileCharacterSelector.className = 'mobile-overlay';
        mobileCharacterSelector.innerHTML = `
            <div class="mobile-overlay-content">
                <div class="mobile-overlay-header">
                    <h2>Select Character</h2>
                    <button class="close-mobile-overlay-btn">
                        <i class="ri-close-line"></i>
                    </button>
                </div>
                <div class="mobile-character-list-container">
                    <div id="mobile-character-list" class="mobile-character-list">
                        <!-- Characters will be loaded here -->
                    </div>
                </div>
                <div class="mobile-overlay-footer">
                    <button id="mobile-new-character-btn" class="btn primary rounded">
                        <i class="ri-user-add-line"></i>
                        <span>New Character</span>
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(mobileCharacterSelector);
        
        // Add event listeners
        const closeBtn = mobileCharacterSelector.querySelector('.close-mobile-overlay-btn');
        closeBtn.addEventListener('click', () => {
            hideMobileCharacterSelector();
        });
        
        const newCharacterBtn = document.getElementById('mobile-new-character-btn');
        newCharacterBtn.addEventListener('click', () => {
            hideMobileCharacterSelector();
            window.showCharacterModal(); // Call the main app's function
        });
    }
}

// Show the mobile character selector with current characters
function showMobileCharacterSelector() {
    const selector = document.getElementById('mobile-character-selector');
    if (selector) {
        // Render characters into mobile list
        renderMobileCharacterList();
        selector.classList.add('visible');
        document.body.classList.add('mobile-overlay-open');
    }
}

// Hide the mobile character selector
function hideMobileCharacterSelector() {
    const selector = document.getElementById('mobile-character-selector');
    if (selector) {
        selector.classList.remove('visible');
        document.body.classList.remove('mobile-overlay-open');
    }
}

// Render characters in the mobile list
function renderMobileCharacterList() {
    const mobileList = document.getElementById('mobile-character-list');
    if (!mobileList) return;
    
    // Get the state directly from the app.js
    const appState = typeof getAppState === 'function' ? getAppState() : null;
    const characters = appState?.characters || [];
    const activeCharacter = appState?.activeCharacter;
    
    mobileList.innerHTML = '';
    
    if (characters.length === 0) {
        mobileList.innerHTML = '<div class="mobile-empty-list">No characters found. Create a new one!</div>';
        return;
    }
      characters.forEach(character => {
        const card = document.createElement('div');
        card.className = `mobile-character-card ${activeCharacter?.name === character.name ? 'active' : ''}`;
        card.dataset.characterName = character.name;
        
        card.innerHTML = `
            <div class="mobile-character-avatar">
                <img src="${character.avatarUrl || 'assets/default-avatar.svg'}" alt="${character.name}">
            </div>
            <div class="mobile-character-info">
                <div class="mobile-character-name">${character.name}</div>
                <div class="mobile-character-description">${character.description || 'No description'}</div>
            </div>
            <i class="ri-arrow-right-s-line"></i>
        `;
        
        // Add error handler for avatar images
        const img = card.querySelector('img');
        img.onerror = () => {
            img.src = 'assets/default-avatar.svg';
        };
        
        card.addEventListener('click', () => {
            // Select the character using the main app's function
            window.selectCharacter(character.name);
            // Hide the mobile selector
            hideMobileCharacterSelector();
        });
        
        mobileList.appendChild(card);
    });
}

// Export functions to be used from main app
window.showMobileCharacterSelector = showMobileCharacterSelector;
window.hideMobileCharacterSelector = hideMobileCharacterSelector;
window.renderMobileCharacterList = renderMobileCharacterList;
