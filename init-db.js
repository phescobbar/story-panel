async function inicializarBanco() {
    try {
        await TursoDB.command(`
            CREATE TABLE IF NOT EXISTS stories (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT,
                status TEXT DEFAULT 'draft',
                category TEXT,
                createdAt TEXT NOT NULL,
                updatedAt TEXT NOT NULL
            )
        `);
    } catch (e) { console.error('Erro init story-panel:', e); }
}
inicializarBanco();
