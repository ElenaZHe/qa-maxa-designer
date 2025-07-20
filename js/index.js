import { storage, i18n, notification } from './utils.js';

// DOM elements
const elements = {
    designsContainer: document.getElementById('designsContainer'),
    createDesignBtn: document.getElementById('createDesignBtn'),
    languageBtn: document.querySelector('.language-btn'),
    dropdownContent: document.querySelector('.dropdown-content'),
    welcomeTitle: document.querySelector('.welcome-title'),
    welcomeSubtitle: document.querySelector('.welcome-subtitle'),
    sectionTitle: document.querySelector('.section-title')
};

// State
let designs = [];

// Main initialization
const STORAGE_KEY = 'savedDesigns';

// Заменим функцию init()
function init() {
    i18n.applyTranslations();
    designs = loadDesigns();
    setupCreateDesignButton();
    setupLanguageSwitcher();
    renderDesigns();
    checkForNewDesign();
}

// Настройка кнопки создания дизайна
function setupCreateDesignButton() {
    if (!elements.createDesignBtn) return;

    elements.createDesignBtn.addEventListener('click', function(e) {
        e.preventDefault();
        
        storage.clearDesignData();
        localStorage.removeItem('designState');
        
        const newDesign = {
            id: 'design-' + Date.now(),
            name: `New Design ${Date.now().toString().slice(-4)}`,
            createdAt: new Date().toISOString(),
            pages: [{
                id: 'page-1',
                width: 1000, 
                height: 1000,
                elements: []
            }],
            currentPage: 0,
            thumbnail: null,
            isNew: true
        };

        storage.set('currentDesign', newDesign);
        window.location.href = 'editor.html?new=true';
    });

    storage.clearDesignData();
    localStorage.removeItem('designState');
    localStorage.removeItem('savedDesign');
}



// Language switcher setup
function setupLanguageSwitcher() {
    const languageDropdown = document.querySelector('.language-dropdown');
    if (!languageDropdown) return;

    const languageBtn = languageDropdown.querySelector('.language-btn');
    const dropdownContent = languageDropdown.querySelector('.dropdown-content');
    
    // Инициализация текущего языка
    const updateLanguageButton = () => {
        languageBtn.textContent = i18n.currentLanguage === 'en' ? 'English' : 'Русский';
        dropdownContent.querySelectorAll('.language-option').forEach(option => {
            option.classList.toggle('active', option.dataset.lang === i18n.currentLanguage);
        });
    };

    // Обработчик клика по кнопке языка
    languageBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = dropdownContent.style.display !== 'block';
        dropdownContent.style.display = isHidden ? 'block' : 'none';
    });

    // Обработчик выбора языка
    dropdownContent.querySelectorAll('.language-option').forEach(option => {
        option.addEventListener('click', (e) => {
            e.preventDefault();
            const lang = e.currentTarget.dataset.lang;
            if (lang && lang !== i18n.currentLanguage) {
                i18n.setLanguage(lang);
                location.reload(); // Добавлено обновление страницы
            }
            dropdownContent.style.display = 'none';
        });
    });

    // Закрытие при клике вне дропдауна
    document.addEventListener('click', (e) => {
        if (!languageDropdown.contains(e.target)) {
            dropdownContent.style.display = 'none';
        }
    });

    // Инициализация при загрузке
    updateLanguageButton();
}

// Render designs list
function loadDesigns() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const savedDesigns = saved ? JSON.parse(saved) : []; // Переименовываем локальную переменную
  
  return savedDesigns.map(design => ({
    id: design.id || 'design-' + Date.now(),
    name: design.name || design.title || `Design ${Date.now()}`,
    createdAt: design.createdAt || new Date().toISOString(),
    pages: design.pages || [],
    thumbnail: design.thumbnail || null
  }));
}

function saveDesigns() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(designs));
}

// Обновим renderDesigns()
function renderDesigns() {
  if (!elements.designsContainer) return;
  
  if (designs.length === 0) {
    elements.designsContainer.innerHTML = `
      <p class="no-designs-message">${i18n.t('noDesigns')}</p>
    `;
    return;
  }

  elements.designsContainer.innerHTML = designs.map(design => `
    <div class="design-card" data-id="${design.id}">
      <div class="design-preview-container">
        <div class="design-preview ${!design.thumbnail ? 'no-preview' : ''}">
          ${design.thumbnail ? 
            `<img src="${design.thumbnail}" alt="${design.name}" class="design-thumbnail">` : 
            `<div class="thumbnail-placeholder">
               <svg class="placeholder-icon" viewBox="0 0 24 24">
                 <path fill="currentColor" d="M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,19H5V5H19V19M13.96,12.29L11.21,15.83L9.25,13.47L6.5,17H17.5L13.96,12.29Z" />
               </svg>
               <span>${design.name}</span>
             </div>`
          }
          <button class="edit-btn" data-id="${design.id}">
            ${i18n.t('edit')}
          </button>
        </div>
        <h3 class="design-title">${design.name}</h3>
      </div>
    </div>
  `).join('');

elements.designsContainer.addEventListener('click', function(e) {
    if (e.target.classList.contains('edit-btn')) {
        const designId = e.target.dataset.id;
        openDesign(designId);
    }
});
  
}

function openDesign(designId) {
    const design = designs.find(d => d.id === designId);
    if (design) {
        // Сохраняем ID редактируемого дизайна
        localStorage.setItem('editingDesignId', designId);
        storage.set('currentDesign', design);
        window.location.href = 'editor.html';
    }
}

function checkForNewDesign() {
  const savedDesigns = JSON.parse(localStorage.getItem('savedDesigns')) || [];
  
  // Синхронизируем с текущим состоянием
  designs = savedDesigns;
  saveDesigns();
  renderDesigns();
  
  // Очищаем временные данные
  localStorage.removeItem('designState');
}

document.addEventListener('DOMContentLoaded', () => {
   i18n.applyTranslations();
    init();
});

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
}