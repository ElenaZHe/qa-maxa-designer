// Local storage wrapper with enhanced error handling
const storage = {
    get: (key) => {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : null;
        } catch (e) {
            console.error('Error reading from localStorage', e);
            return null;
        }
    },
    
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Error writing to localStorage', e);
            return false;
        }
    },
    
    remove: (key) => {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error('Error removing from localStorage', e);
            return false;
        }
    },
    
    clear: () => {
        try {
            localStorage.clear();
            return true;
        } catch (e) {
            console.error('Error clearing localStorage', e);
            return false;
        }
    },


    clearDesignData: function() {
        this.remove('currentDesign');
        this.remove('savedDesign');
        this.remove('designState');
        return true;
    }
};

// Enhanced language management with fallback
const i18n = {
    currentLanguage: storage.get('language') || 'en',
    
    translations: {
        en: {
            welcomeTitle: "Welcome to MAXA Designer.",
            welcomeSubtitle: "Create your own designs with our editor.",
            createDesign: "Create design",
            latestDesigns: "Latest designs",
            noDesigns: "You have no designs created yet.",
            edit: "Edit",
            rename: "Rename",
            delete: "Delete",
            designSaved: "Design was successfully saved",
            confirmClose: "All unsaved changes will be lost. Are you sure you want to leave?",
            support: "Support",
            language: "Language",
            folders: "Folders",
            backgrounds: "Backgrounds"
        },
        ru: {
            welcomeTitle: "Добро пожаловать в MAXA Designer.",
            welcomeSubtitle: "Создавайте свои дизайны с нашим редактором.",
            createDesign: "Создать дизайн",
            latestDesigns: "Последние дизайны",
            noDesigns: "У вас пока нет созданных дизайнов.",
            edit: "Редактировать",
            rename: "Переименовать",
            delete: "Удалить",
            designSaved: "Дизайн успешно сохранен",
            confirmClose: "Все несохраненные изменения будут потеряны. Вы уверены, что хотите выйти?",
            support: "Поддержка",
            language: "Язык",
            folders: "Папки",
            backgrounds: "Фоны"
        }
    },

    setLanguage: function(lang) {
        if (this.translations[lang]) {
            this.currentLanguage = lang;
            if (storage.set('language', lang)) {
                this.applyTranslations();
                return true;
            }
        } else {
            console.warn(`Language ${lang} not supported`);
        }
        return false;
    },

    t: function(key) {
        return this.translations[this.currentLanguage]?.[key] || 
               this.translations['en'][key] || 
               `[${key}]`;
    },

    applyTranslations: function() {
        // Process all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.t(key);
            
            if (translation) {
                if (element.tagName === 'INPUT' && element.hasAttribute('placeholder')) {
                    element.placeholder = translation;
                } else {
                    // Изменяем только текстовые узлы, сохраняя дочерние элементы
                    const textNodes = Array.from(element.childNodes)
                        .filter(node => node.nodeType === Node.TEXT_NODE);
                    
                    if (textNodes.length > 0) {
                        textNodes[0].textContent = translation;
                    } else {
                        // Если нет текстовых узлов, создаем новый span
                        const span = document.createElement('span');
                        span.textContent = translation;
                        element.appendChild(span);
                    }
                }
            }
        });

        // Special cases for elements without data-i18n
        const specialElements = {
            '.welcome-title': 'welcomeTitle',
            '.welcome-subtitle': 'welcomeSubtitle',
            '.section-title': 'latestDesigns',
            '.support': 'support',
            '.language-btn': 'language',
            '.folders-section': 'folders',
            '.backgrounds-section': 'backgrounds'
        };

        Object.entries(specialElements).forEach(([selector, key]) => {
            const element = document.querySelector(selector);
            if (element) {
                // Для специальных элементов используем обычную замену текста
                element.textContent = this.t(key);
            }
        });

        // Особый случай для кнопки Create Design
        const createDesignBtn = document.getElementById('createDesignBtn');
        if (createDesignBtn) {
            const span = createDesignBtn.querySelector('span[data-i18n="createDesign"]');
            if (span) {
                span.textContent = this.t('createDesign');
            }
        }
    }
};

// Enhanced notification system
const notification = {
    show: (message, type = 'info', duration = 3000) => {
        const notificationEl = document.getElementById('notification');
        if (!notificationEl) return;

        // Clear previous classes
        notificationEl.className = '';
        notificationEl.classList.add('notification', type);
        
        notificationEl.textContent = message;
        notificationEl.classList.add('show');
        
        setTimeout(() => {
            notificationEl.classList.remove('show');
        }, duration);
    },
    
    success: (message, duration) => this.show(message, 'success', duration),
    error: (message, duration) => this.show(message, 'error', duration),
    warning: (message, duration) => this.show(message, 'warning', duration)
};


function clearDesignData() {
    localStorage.removeItem('currentDesign');
    localStorage.removeItem('designState');
}

// Export utils
export { storage, i18n, notification };