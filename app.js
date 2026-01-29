// ===== Story Lab - App Logic =====

class StoryLab {
    constructor() {
        this.stories = [];
        this.currentStoryId = null;
        this.currentFilter = 'all';
        this.searchQuery = '';
        
        this.init();
    }
    
    init() {
        this.loadStories();
        this.bindEvents();
        this.render();
    }
    
    // ===== Storage =====
    async loadStories() {
        // 1. Load from LocalStorage (User edits)
        const localSaved = localStorage.getItem('storylab_stories');
        let localStories = localSaved ? JSON.parse(localSaved) : [];

        // 2. Try to load from repository (Agent created stories)
        try {
            const response = await fetch('stories.json');
            if (response.ok) {
                const repoStories = await response.json();
                // Merge strategies:
                // If ID exists in local, keep local (user might have edited)
                // If ID is new, add it
                const localIds = new Set(localStories.map(s => s.id));
                const newStories = repoStories.filter(s => !localIds.has(s.id));
                
                if (newStories.length > 0) {
                    localStories = [...newStories, ...localStories];
                    this.saveStories(); // Sync back to local
                    this.showToast(`${newStories.length} novas histórias do Alphonse!`, 'info');
                }
            }
        } catch (e) {
            console.log('No external stories found or offline');
        }

        this.stories = localStories;
        this.render();
    }
    
    saveStories() {
        localStorage.setItem('storylab_stories', JSON.stringify(this.stories));
    }
    
    // ===== CRUD Operations =====
    createStory() {
        const story = {
            id: this.generateId(),
            title: '',
            status: 'draft',
            platforms: [],
            duration: '',
            hook: '',
            script: '',
            cta: '',
            notes: '',
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        this.stories.unshift(story);
        this.saveStories();
        this.openEditor(story.id);
    }
    
    updateStory(id, updates) {
        const index = this.stories.findIndex(s => s.id === id);
        if (index !== -1) {
            this.stories[index] = {
                ...this.stories[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            this.saveStories();
        }
    }
    
    deleteStory(id) {
        if (confirm('Tem certeza que deseja excluir este roteiro?')) {
            this.stories = this.stories.filter(s => s.id !== id);
            this.saveStories();
            this.showDashboard();
            this.showToast('Roteiro excluído', 'success');
        }
    }
    
    getStory(id) {
        return this.stories.find(s => s.id === id);
    }
    
    // ===== Filtering =====
    getFilteredStories() {
        let filtered = [...this.stories];
        
        // Filter by status
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(s => s.status === this.currentFilter);
        }
        
        // Filter by search
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(s => 
                s.title.toLowerCase().includes(query) ||
                s.hook.toLowerCase().includes(query) ||
                s.script.toLowerCase().includes(query) ||
                s.tags.some(t => t.toLowerCase().includes(query))
            );
        }
        
        return filtered;
    }
    
    // ===== Event Binding =====
    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                if (view === 'dashboard') this.showDashboard();
            });
        });
        
        // New Story Button
        document.getElementById('newStoryBtn').addEventListener('click', () => {
            this.createStory();
        });
        
        // Filter Tabs
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentFilter = tab.dataset.filter;
                this.renderStoriesGrid();
            });
        });
        
        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.renderStoriesGrid();
        });
        
        // Editor Events
        document.getElementById('backToList').addEventListener('click', () => {
            this.saveCurrentStory();
            this.showDashboard();
        });
        
        document.getElementById('saveStoryBtn').addEventListener('click', () => {
            this.saveCurrentStory();
            this.showToast('Roteiro salvo!', 'success');
        });
        
        document.getElementById('deleteStoryBtn').addEventListener('click', () => {
            if (this.currentStoryId) {
                this.deleteStory(this.currentStoryId);
            }
        });
        
        // Tags
        document.getElementById('addTagBtn').addEventListener('click', () => this.addTag());
        document.getElementById('tagInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTag();
        });
        
        // Character counters
        ['hookText', 'scriptText', 'ctaText'].forEach(id => {
            document.getElementById(id).addEventListener('input', (e) => {
                this.updateCharCount(id, e.target.value.length);
            });
        });
        
        // Export/Import
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });
        document.getElementById('importFile').addEventListener('change', (e) => this.importData(e));
        
        // Auto-save on blur
        document.querySelectorAll('#editorView input, #editorView textarea, #editorView select').forEach(el => {
            el.addEventListener('blur', () => {
                if (this.currentStoryId) {
                    this.saveCurrentStory();
                }
            });
        });
    }
    
    // ===== Views =====
    showDashboard() {
        this.currentStoryId = null;
        document.getElementById('dashboardView').classList.add('active');
        document.getElementById('editorView').classList.remove('active');
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-view="dashboard"]').classList.add('active');
        this.render();
    }
    
    openEditor(storyId) {
        this.currentStoryId = storyId;
        const story = this.getStory(storyId);
        
        if (!story) return;
        
        // Switch view
        document.getElementById('dashboardView').classList.remove('active');
        document.getElementById('editorView').classList.add('active');
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('[data-view="editor"]').classList.add('active');
        
        // Populate fields
        document.getElementById('storyTitle').value = story.title;
        document.getElementById('storyStatus').value = story.status;
        document.getElementById('storyDuration').value = story.duration;
        document.getElementById('hookText').value = story.hook;
        document.getElementById('scriptText').value = story.script;
        document.getElementById('ctaText').value = story.cta;
        document.getElementById('notesText').value = story.notes;
        
        // Platforms
        document.querySelectorAll('[name="platform"]').forEach(cb => {
            cb.checked = story.platforms.includes(cb.value);
        });
        
        // Dates
        document.getElementById('createdAt').textContent = this.formatDate(story.createdAt);
        document.getElementById('updatedAt').textContent = this.formatDate(story.updatedAt);
        
        // Tags
        this.renderTags(story.tags);
        
        // Update char counts
        this.updateCharCount('hookText', story.hook.length);
        this.updateCharCount('scriptText', story.script.length);
        this.updateCharCount('ctaText', story.cta.length);
        
        // Focus title if empty
        if (!story.title) {
            document.getElementById('storyTitle').focus();
        }
    }
    
    // ===== Rendering =====
    render() {
        this.renderStats();
        this.renderStoriesGrid();
    }
    
    renderStats() {
        const total = this.stories.length;
        const completed = this.stories.filter(s => s.status === 'completed').length;
        const draft = this.stories.filter(s => s.status === 'draft').length;
        
        document.getElementById('totalStories').textContent = total;
        document.getElementById('completedStories').textContent = completed;
        document.getElementById('draftStories').textContent = draft;
    }
    
    renderStoriesGrid() {
        const grid = document.getElementById('storiesGrid');
        const emptyState = document.getElementById('emptyState');
        const stories = this.getFilteredStories();
        
        if (stories.length === 0) {
            grid.innerHTML = '';
            emptyState.classList.add('visible');
            return;
        }
        
        emptyState.classList.remove('visible');
        
        grid.innerHTML = stories.map(story => `
            <article class="story-card" data-id="${story.id}">
                <div class="story-card-header">
                    <h3 class="story-title">${story.title || 'Sem título'}</h3>
                    <span class="story-status ${story.status}">${this.getStatusLabel(story.status)}</span>
                </div>
                <p class="story-preview">${story.hook || story.script || 'Sem conteúdo ainda...'}</p>
                <div class="story-meta">
                    <div class="story-platforms">
                        ${story.platforms.map(p => `<span class="platform-badge ${p}">${this.getPlatformLabel(p)}</span>`).join('')}
                    </div>
                    <span class="story-date">${this.formatDate(story.updatedAt)}</span>
                </div>
            </article>
        `).join('');
        
        // Bind click events
        grid.querySelectorAll('.story-card').forEach(card => {
            card.addEventListener('click', () => {
                this.openEditor(card.dataset.id);
            });
        });
    }
    
    renderTags(tags) {
        const container = document.getElementById('tagsContainer');
        container.innerHTML = tags.map(tag => `
            <span class="tag">
                ${tag}
                <button class="tag-remove" data-tag="${tag}">&times;</button>
            </span>
        `).join('');
        
        container.querySelectorAll('.tag-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeTag(btn.dataset.tag);
            });
        });
    }
    
    // ===== Tag Management =====
    addTag() {
        const input = document.getElementById('tagInput');
        const tag = input.value.trim().toLowerCase();
        
        if (!tag || !this.currentStoryId) return;
        
        const story = this.getStory(this.currentStoryId);
        if (story && !story.tags.includes(tag)) {
            story.tags.push(tag);
            this.saveStories();
            this.renderTags(story.tags);
        }
        
        input.value = '';
    }
    
    removeTag(tag) {
        if (!this.currentStoryId) return;
        
        const story = this.getStory(this.currentStoryId);
        if (story) {
            story.tags = story.tags.filter(t => t !== tag);
            this.saveStories();
            this.renderTags(story.tags);
        }
    }
    
    // ===== Save Current Story =====
    saveCurrentStory() {
        if (!this.currentStoryId) return;
        
        const platforms = [];
        document.querySelectorAll('[name="platform"]:checked').forEach(cb => {
            platforms.push(cb.value);
        });
        
        this.updateStory(this.currentStoryId, {
            title: document.getElementById('storyTitle').value,
            status: document.getElementById('storyStatus').value,
            duration: document.getElementById('storyDuration').value,
            hook: document.getElementById('hookText').value,
            script: document.getElementById('scriptText').value,
            cta: document.getElementById('ctaText').value,
            notes: document.getElementById('notesText').value,
            platforms
        });
        
        // Update dates display
        const story = this.getStory(this.currentStoryId);
        if (story) {
            document.getElementById('updatedAt').textContent = this.formatDate(story.updatedAt);
        }
    }
    
    // ===== Export/Import =====
    exportData() {
        const data = JSON.stringify(this.stories, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `storylab-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showToast('Dados exportados!', 'success');
    }
    
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (Array.isArray(imported)) {
                    this.stories = [...imported, ...this.stories];
                    this.saveStories();
                    this.render();
                    this.showToast(`${imported.length} roteiros importados!`, 'success');
                }
            } catch (err) {
                this.showToast('Erro ao importar arquivo', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }
    
    // ===== Utilities =====
    generateId() {
        return 'story_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    formatDate(isoString) {
        if (!isoString) return '-';
        const date = new Date(isoString);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    getStatusLabel(status) {
        const labels = {
            draft: 'Rascunho',
            review: 'Em Revisão',
            completed: 'Finalizado'
        };
        return labels[status] || status;
    }
    
    getPlatformLabel(platform) {
        const labels = {
            youtube: 'YT',
            tiktok: 'TT',
            reels: 'IG'
        };
        return labels[platform] || platform;
    }
    
    updateCharCount(fieldId, count) {
        const fieldMap = {
            hookText: 'hook',
            scriptText: 'script',
            ctaText: 'cta'
        };
        const limits = {
            hook: 150,
            script: 2000,
            cta: 200
        };
        
        const field = fieldMap[fieldId];
        const counter = document.querySelector(`[data-for="${field}"]`);
        if (counter) {
            counter.textContent = `${count}/${limits[field]}`;
        }
    }
    
    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icon = type === 'success' 
            ? '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
            : '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
        
        toast.innerHTML = `${icon}<span class="toast-message">${message}</span>`;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.storyLab = new StoryLab();
});
