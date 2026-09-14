try { document.documentElement.dataset.theme = localStorage.getItem('nativos-theme') === 'dark' ? 'dark' : 'light'; } catch { document.documentElement.dataset.theme = 'light'; }
