// ===== Story Lab - App Logic (Turso DB Version) =====

class StoryLab {
    constructor() {
        this.stories = [];
        this.currentStoryId = null;
        this.currentFilter = 'all';
        this.searchQuery = '';
        
        this.init();
    }
    
    async init() {
        this.bindEvents();
        // Garantir que TursoDB existe antes de carregar
        if (window.TursoDB) {
            await this.loadStories();
        } else {
            const checkDB = setInterval(async () => {
                if (window.TursoDB) {
                    clearInterval(checkDB);
                    await this.loadStories();
                }
            }, 100);
        }
    }
    
    // ===== Storage =====
    async loadStories() {
        this.showLoading(true);
        try {
            const result = await TursoDB.query('SELECT * FROM stories ORDER BY updatedAt DESC');
            
            if (!result || !result.rows) {
                this.stories = [];
            } else {
                const columns = result.cols.map(c => c.name);
                this.stories = result.rows.map(row => {
                    const story = {};
                    row.forEach((val, i) => {
                        let value = (val && typeof val === 'object' && 'value' in val) ? val.value : val;
                        // Tratar campos específicos
                        if (columns[i] === 'platforms') {
                            story[columns[i]] = value ? value.split(',') : [];
                        } else if (columns[i] === 'tags') {
                            story[columns[i]] = value ? value.split(',') : [];
                        } else {
                            story[columns[i]] = value;
                        }
                    });
                    return story;
                });
            }
            this.render();
        } catch (e) {
            console.error('Erro ao carregar do Turso:', e);
            const localSaved = localStorage.getItem('storylab_stories');
            this.stories = localSaved ? JSON.parse(localSaved) : [];
            this.render();
        } finally {
            this.showLoading(false);
        }
    }
    
    async createStory() {
        this.showLoading(true);
        try {
            const id = 'story_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            const now = new Date().toISOString();
            
            await TursoDB.command(
                'INSERT INTO stories (id, title, status, platforms, duration, hook, script, cta, notes, tags, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, 'Novo Roteiro', 'draft', '', '', '', '', '', '', '', now, now]
            );
            
            await this.loadStories();
            this.openEditor(id);
        } catch (e) {
            console.error('Erro ao criar no Turso:', e);
        } finally {
            this.showLoading(false);
        }
    }
    
    async updateStory(id, updates) {
        // Como o app usa auto-save no blur, vamos otimizar para atualizar apenas o que mudou ou mandar tudo
        const story = this.getStory(id);
        if (!story) return;

        const merged = { ...story, ...updates, updatedAt: new Date().toISOString() };
        
        try {
            await TursoDB.command(
                'UPDATE stories SET title=?, status=?, platforms=?, duration=?, hook=?, script=?, cta=?, notes=?, tags=?, updatedAt=? WHERE id=?',
                [
                    merged.title, 
                    merged.status, 
                    merged.platforms.join(','), 
                    merged.duration, 
                    merged.hook, 
                    merged.script, 
                    merged.cta, 
                    merged.notes, 
                    merged.tags.join(','), 
                    merged.updatedAt, 
                    id
                ]
            );
            // Atualiza localmente para UI ficar fluída
            const index = this.stories.findIndex(s => s.id === id);
            if (index !== -1) this.stories[index] = merged;
        } catch (e) {
            console.error('Erro ao atualizar no Turso:', e);
        }
    }
    
    async deleteStory(id) {
        if (!confirm('Tem certeza que deseja excluir este roteiro?')) return;
        
        this.showLoading(true);
        try {
            await TursoDB.command('DELETE FROM stories WHERE id = ?', [id]);
            await this.loadStories();
            this.showDashboard();
            this.showToast('Roteiro excluído', 'success');
        } catch (e) {
            console.error('Erro ao deletar do Turso:', e);
        } finally {
            this.showLoading(false);
        }
    }
    
    getStory(id) {
        return this.stories.find(s => s.id === id);
    }

    showLoading(show) {
        const btn = document.getElementById('newStoryBtn');
        if (!btn) return;
        btn.disabled = show;
        btn.innerHTML = show ? 'Carregando...' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>Novo Roteiro';
    }
    
    // ===== Filtering =====
    getFilteredStories() {
        let filtered = [...this.stories];
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(s => s.status === this.currentFilter);
        }
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(s => 
                (s.title && s.title.toLowerCase().includes(query)) ||
                (s.hook && s.hook.toLowerCase().includes(query)) ||
                (s.script && s.script.toLowerCase().includes(query)) ||
                (s.tags && s.tags.some(t => t.toLowerCase().includes(query)))
            );
        }
        return filtered;
    }
    
    // ===== Event Binding =====
    bindEvents() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (btn.dataset.view === 'dashboard') this.showDashboard();
            });
        });
        
        document.getElementById('newStoryBtn').addEventListener('click', () => this.createStory());
        
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentFilter = tab.dataset.filter;
                this.renderStoriesGrid();
            });
        });
        
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchQuery = e.target.value;
            this.renderStoriesGrid();
        });
        
        document.getElementById('backToList').addEventListener('click', () => {
            this.saveCurrentStory();
            this.showDashboard();
        });
        
        document.getElementById('saveStoryBtn').addEventListener('click', () => {
            this.saveCurrentStory();
            this.showToast('Roteiro salvo!', 'success');
        });
        
        document.getElementById('deleteStoryBtn').addEventListener('click', () => {
            if (this.currentStoryId) this.deleteStory(this.currentStoryId);
        });
        
        document.getElementById('addTagBtn').addEventListener('click', () => this.addTag());
        document.getElementById('tagInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTag();
        });
        
        ['hookText', 'scriptText', 'ctaText'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', (e) => {
                    this.updateCharCount(id, e.target.value.length);
                });
            }
        });
        
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile').addEventListener('change', (e) => this.importData(e));
        
        document.querySelectorAll('#editorView input, #editorView textarea, #editorView select').forEach(el => {
            el.addEventListener('blur', () => {
                if (this.currentStoryId) this.saveCurrentStory();
            });
        });
    }
    
    showDashboard() {
        this.currentStoryId = null;
        document.getElementById('dashboardView').classList.add('active');
        document.getElementById('editorView').classList.remove('active');
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        const dashBtn = document.querySelector('[data-view="dashboard"]');
        if (dashBtn) dashBtn.classList.add('active');
        this.render();
    }
    
    openEditor(storyId) {
        this.currentStoryId = storyId;
        const story = this.getStory(storyId);
        if (!story) return;
        
        document.getElementById('dashboardView').classList.remove('active');
        document.getElementById('editorView').classList.add('active');
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        
        document.getElementById('storyTitle').value = story.title || '';
        document.getElementById('storyStatus').value = story.status || 'draft';
        document.getElementById('storyDuration').value = story.duration || '';
        document.getElementById('hookText').value = story.hook || '';
        document.getElementById('scriptText').value = story.script || '';
        document.getElementById('ctaText').value = story.cta || '';
        document.getElementById('notesText').value = story.notes || '';
        
        document.querySelectorAll('[name="platform"]').forEach(cb => {
            cb.checked = story.platforms.includes(cb.value);
        });
        
        document.getElementById('createdAt').textContent = this.formatDate(story.createdAt);
        document.getElementById('updatedAt').textContent = this.formatDate(story.updatedAt);
        
        this.renderTags(story.tags || []);
        this.updateCharCount('hookText', (story.hook || '').length);
        this.updateCharCount('scriptText', (story.script || '').length);
        this.updateCharCount('ctaText', (story.cta || '').length);
    }
    
    render() {
        this.renderStats();
        this.renderStoriesGrid();
    }
    
    renderStats() {
        const total = this.stories.length;
        const completed = this.stories.filter(s => s.status === 'completed').length;
        const draft = this.stories.filter(s => s.status === 'draft').length;
        
        if (document.getElementById('totalStories')) document.getElementById('totalStories').textContent = total;
        if (document.getElementById('completedStories')) document.getElementById('completedStories').textContent = completed;
        if (document.getElementById('draftStories')) document.getElementById('draftStories').textContent = draft;
    }
    
    renderStoriesGrid() {
        const grid = document.getElementById('storiesGrid');
        const emptyState = document.getElementById('emptyState');
        const stories = this.getFilteredStories();
        
        if (!grid) return;

        if (stories.length === 0) {
            grid.innerHTML = '';
            if (emptyState) emptyState.classList.add('visible');
            return;
        }
        
        if (emptyState) emptyState.classList.remove('visible');
        
        grid.innerHTML = stories.map(story => `
            <article class="story-card" data-id="${story.id}">
                <div class="story-card-header">
                    <h3 class="story-title">${story.title || 'Sem título'}</h3>
                    <span class="story-status ${story.status}">${this.getStatusLabel(story.status)}</span>
                </div>
                <p class="story-preview">${story.hook || story.script || 'Sem conteúdo ainda...'}</p>
                <div class="story-meta">
                    <div class="story-platforms">
                        ${(story.platforms || []).map(p => `<span class="platform-badge ${p}">${this.getPlatformLabel(p)}</span>`).join('')}
                    </div>
                    <span class="story-date">${this.formatDate(story.updatedAt)}</span>
                </div>
            </article>
        `).join('');
        
        grid.querySelectorAll('.story-card').forEach(card => {
            card.addEventListener('click', () => this.openEditor(card.dataset.id));
        });
    }
    
    renderTags(tags) {
        const container = document.getElementById('tagsContainer');
        if (!container) return;
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
    
    addTag() {
        const input = document.getElementById('tagInput');
        const tag = input.value.trim().toLowerCase();
        if (!tag || !this.currentStoryId) return;
        const story = this.getStory(this.currentStoryId);
        if (story && !story.tags.includes(tag)) {
            story.tags.push(tag);
            this.updateStory(this.currentStoryId, { tags: story.tags });
            this.renderTags(story.tags);
        }
        input.value = '';
    }
    
    removeTag(tag) {
        if (!this.currentStoryId) return;
        const story = this.getStory(this.currentStoryId);
        if (story) {
            const newTags = story.tags.filter(t => t !== tag);
            this.updateStory(this.currentStoryId, { tags: newTags });
            this.renderTags(newTags);
        }
    }
    
    saveCurrentStory() {
        if (!this.currentStoryId) return;
        const platforms = [];
        document.querySelectorAll('[name="platform"]:checked').forEach(cb => platforms.push(cb.value));
        
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
    }
    
    exportData() {
        const data = JSON.stringify(this.stories, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `storylab-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        this.showToast('Dados exportados!', 'success');
    }
    
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (Array.isArray(imported)) {
                    for (const s of imported) {
                        await TursoDB.command(
                            'INSERT OR IGNORE INTO stories (id, title, status, platforms, duration, hook, script, cta, notes, tags, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                            [s.id, s.title, s.status, s.platforms.join(','), s.duration, s.hook, s.script, s.cta, s.notes, s.tags.join(','), s.createdAt, s.updatedAt]
                        );
                    }
                    await this.loadStories();
                    this.showToast(`${imported.length} roteiros importados!`, 'success');
                }
            } catch (err) { this.showToast('Erro ao importar arquivo', 'error'); }
        };
        reader.readAsText(file);
        event.target.value = '';
    }
    
    formatDate(isoString) {
        if (!isoString) return '-';
        const date = new Date(isoString);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    }
    
    getStatusLabel(status) {
        const labels = { draft: 'Rascunho', review: 'Em Revisão', completed: 'Finalizado' };
        return labels[status] || status;
    }
    
    getPlatformLabel(platform) {
        const labels = { youtube: 'YT', tiktok: 'TT', reels: 'IG' };
        return labels[platform] || platform;
    }
    
    updateCharCount(fieldId, count) {
        const fieldMap = { hookText: 'hook', scriptText: 'script', ctaText: 'cta' };
        const limits = { hook: 150, script: 2000, cta: 200 };
        const field = fieldMap[fieldId];
        const counter = document.querySelector(`[data-for="${field}"]`);
        if (counter) counter.textContent = `${count}/${limits[field]}`;
    }
    
    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
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

document.addEventListener('DOMContentLoaded', () => {
    window.storyLab = new StoryLab();
});
