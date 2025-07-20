document.addEventListener('DOMContentLoaded', function() {
    // Константы и элементы DOM
    const DOM = {
        saveBtn: document.getElementById('save-btn'),
        closeBtn: document.getElementById('close-btn'),
        designTitle: document.getElementById('design-title'),
        undoBtn: document.getElementById('undo-btn'),
        redoBtn: document.getElementById('redo-btn'),
        downloadBtn: document.getElementById('download-btn'),
        downloadDropdown: document.getElementById('download-dropdown'),
        uploadsBtn: document.getElementById('uploads-btn'),
        textBtn: document.getElementById('text-btn'),
        sidebar: document.getElementById('sidebar'),
        uploadsContent: document.getElementById('uploads-content'),
        textContent: document.getElementById('text-content'),
        imageUpload: document.getElementById('image-upload'),
        uploadBtn: document.getElementById('upload-btn'),
        textInput: document.getElementById('text-input'),
        addTextBtn: document.getElementById('add-text-btn'),
        canvasContainer: document.getElementById('canvas-container'),
        pagesContainer: document.getElementById('pages-container'),
        zoomOutBtn: document.getElementById('zoom-out'),
        zoomInBtn: document.getElementById('zoom-in'),
        zoomLevel: document.getElementById('zoom-level'),
        addPageBtn: document.getElementById('add-page'),
        deletePageBtn: document.getElementById('delete-page'),
        displayToggleBtn: document.getElementById('display-toggle'),
        unsavedModal: document.getElementById('unsaved-modal'),
        confirmLeaveBtn: document.getElementById('confirm-leave'),
        cancelLeaveBtn: document.getElementById('cancel-leave'),
        deleteModal: document.getElementById('delete-modal'),
        confirmDeleteBtn: document.getElementById('confirm-delete'),
        cancelDeleteBtn: document.getElementById('cancel-delete'),
        notification: document.getElementById('notification'),
        saveAnimation: document.getElementById('save-animation'),
        imageSearch: document.getElementById('image-search'),
        importBtn: document.getElementById('import-btn'),
        selectAllBtn: document.getElementById('select-all-btn'),
        deleteSelectedBtn: document.getElementById('delete-selected-btn'),
        uploadsGrid: document.getElementById('uploads-grid')
    };

    // Состояние приложения
    const state = {
        hasUnsavedChanges: false,
        currentZoom: 100,
        isSidebarOpen: false,
        activeSidebar: null,
        designCount: localStorage.getItem('designCount') || 1,
        currentPage: 1,
        pages: [{
            id: 1,
            element: document.querySelector('.design-page'),
            canvas: document.querySelector('.design-canvas')
        }],
        uploadedImages: [],
        selectedElement: null,
        isHorizontalScroll: false,
        basePadding: 40,
        baseInnerPadding: 20,
        minZoomForPadding: 50,
        selectedImages: [],
        selectedElements: [],
        lastClickedElement: null,
        lastClickTime: 0,
        actionHistory: [],
        historyIndex: -1,
        fixedPageMargin: 20,
        clickToSelectPage: false // Будет true при zoom < 60%
    };

    document.getElementById('canvas-container').addEventListener('click', function(e) {
        // Проверяем, что клик был по странице или холсту
        const isPageClick = e.target.classList.contains('design-page');
        const isCanvasClick = e.target.classList.contains('design-canvas');
        
        if (!isPageClick && !isCanvasClick) return;
        
        // Находим элемент страницы
        const pageElement = isPageClick ? e.target : e.target.closest('.design-page');
        if (!pageElement) return;
        
        const pageId = parseInt(pageElement.dataset.pageId);
        
        // Если масштаб больше 60%, просто активируем страницу без прокрутки
        if (state.currentZoom > 60) {
            if (pageId !== state.currentPage) {
                setActivePage(pageId);
            }
            return;
        }
        
        // Для масштаба 60% и ниже - активируем страницу и прокручиваем к ней
        if (pageId !== state.currentPage) {
            setActivePage(pageId);
            pageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });


    // Инициализация
    function init() {
        createContextMenu();
        setupEventListeners();
        setupPageScrolling();
        setupCanvasClickHandler();

        const editingDesignId = localStorage.getItem('editingDesignId');
        if (editingDesignId) {
            const designLoaded = loadDesignState();
            if (designLoaded) {
                state.isEditing = true;
                state.editingDesignId = editingDesignId;
            }
        }

        const designLoaded = loadDesignState();
        if (!designLoaded) {
            state.pages = [{
                id: 1,
                element: document.querySelector('.design-page'),
                canvas: document.querySelector('.design-canvas')
            }];
            state.currentPage = 1;
        }

        updateActivePageIndicator();
        
        // Добавляем небольшую задержку для корректного расчета размеров
        setTimeout(() => {
            centerCurrentPage(true);
        }, 100);
        
        loadUploadedImagesFromStorage();
    }

    // Настройка обработчиков событий
    function setupEventListeners() {
        // Кнопки управления
        DOM.saveBtn.addEventListener('click', function() {
            saveDesign();
        });
        DOM.closeBtn.addEventListener('click', handleClose);
        DOM.downloadBtn.addEventListener('click', toggleDownloadDropdown);
        DOM.undoBtn.addEventListener('click', undoAction);
        DOM.redoBtn.addEventListener('click', redoAction);
        DOM.designTitle.addEventListener('input', () => state.hasUnsavedChanges = true);

        // Боковая панель
        DOM.uploadsBtn.addEventListener('click', () => toggleSidebar('uploads'));
        DOM.textBtn.addEventListener('click', () => toggleSidebar('text'));
        DOM.importBtn.addEventListener('click', () => DOM.imageUpload.click());
        DOM.imageUpload.addEventListener('change', handleImageUpload);
        DOM.selectAllBtn.addEventListener('click', toggleSelectAllImages);
        DOM.deleteSelectedBtn.addEventListener('click', deleteSelectedImages);
        DOM.imageSearch.addEventListener('input', filterUploadedImages);
        DOM.addTextBtn.addEventListener('click', addTextToCanvas);

        // Управление холстом
        DOM.zoomOutBtn.addEventListener('click', () => adjustZoom(-10));
        DOM.zoomInBtn.addEventListener('click', () => adjustZoom(10));
        DOM.addPageBtn.addEventListener('click', addNewPage);
        DOM.deletePageBtn.addEventListener('click', showDeleteModal);
        DOM.displayToggleBtn.addEventListener('click', toggleDisplay);

        // Модальные окна
        DOM.confirmLeaveBtn.addEventListener('click', confirmLeave);
        DOM.cancelLeaveBtn.addEventListener('click', cancelLeave);
        DOM.confirmDeleteBtn.addEventListener('click', confirmDelete);
        DOM.cancelDeleteBtn.addEventListener('click', cancelDelete);

        // Выпадающие меню
        document.addEventListener('click', handleOutsideClick);
        document.querySelectorAll('.dropdown-item[data-format]').forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                downloadDesign(this.getAttribute('data-format'));
            });
        });

        // Глобальные события
        document.addEventListener('click', handleGlobalClick);
        window.addEventListener('beforeunload', handleBeforeUnload);
    }

    // Работа с изображениями
    function handleImageUpload() {
        const files = DOM.imageUpload.files;
        if (!files || files.length === 0) return;

        Array.from(files).forEach((file, i) => {
            const reader = new FileReader();
            reader.onload = e => processUploadedImage(e.target.result, file);
            reader.readAsDataURL(file);
        });
        
        DOM.imageUpload.value = '';
    }

    function processUploadedImage(src, file) {
        const img = new Image();
        img.onload = () => {
            const imageData = {
                id: Date.now(),
                name: file.name,
                src,
                width: img.width,
                height: img.height,
                element: null
            };
            
            state.uploadedImages.push(imageData);
            renderUploadedImage(imageData);
            addImageToCanvas(src, img.width, img.height, true);
            
            // Сохраняем изображения в localStorage
            saveUploadedImagesToStorage();
        };
        img.src = src;
    }

    function renderUploadedImage(imageData) {
        const imageContainer = document.createElement('div');
        imageContainer.className = 'uploaded-image';
        imageContainer.dataset.imageId = imageData.id;
        
        const img = document.createElement('img');
        img.src = imageData.src;
        img.alt = imageData.name;
        
        // Calculate thumbnail size maintaining aspect ratio
        const thumbSize = 120;
        const aspectRatio = imageData.width / imageData.height;
        const thumbWidth = aspectRatio > 1 ? thumbSize : thumbSize * aspectRatio;
        const thumbHeight = aspectRatio > 1 ? thumbSize / aspectRatio : thumbSize;
        
        img.style.width = `${thumbWidth}px`;
        img.style.height = `${thumbHeight}px`;
        img.style.objectFit = 'contain';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checkbox';
        
        imageContainer.append(img, checkbox);
        
        // Обработчик клика на чекбокс
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleImageSelection(imageData.id);
        });
        
        // Обработчик клика на изображение (добавляем на холст)
        img.addEventListener('click', (e) => {
            if (e.target !== checkbox) {
                addImageToCanvas(imageData.src, imageData.width, imageData.height);
            }
        });
        
        DOM.uploadsGrid.appendChild(imageContainer);
        imageData.element = imageContainer;
    }

    function toggleImageSelection(imageId) {
        const index = state.selectedImages.indexOf(imageId);
        if (index === -1) {
            state.selectedImages.push(imageId);
        } else {
            state.selectedImages.splice(index, 1);
        }
        
        const imageElement = DOM.uploadsGrid.querySelector(`[data-image-id="${imageId}"]`);
        if (imageElement) {
            imageElement.classList.toggle('selected', index === -1);
            // Находим чекбокс внутри элемента и обновляем его состояние
            const checkbox = imageElement.querySelector('.checkbox');
            if (checkbox) {
                checkbox.checked = index === -1;
            }
        }
        
        updateSelectionButtons();
    }

    function toggleSelectAllImages() {
        const allSelected = state.selectedImages.length === state.uploadedImages.length;
        state.selectedImages = allSelected ? [] : state.uploadedImages.map(img => img.id);
        
        DOM.uploadsGrid.querySelectorAll('.uploaded-image').forEach(el => {
            const imageId = el.dataset.imageId;
            const isSelected = !allSelected;
            
            el.classList.toggle('selected', isSelected);
            
            // Находим чекбокс внутри элемента и обновляем его состояние
            const checkbox = el.querySelector('.checkbox');
            if (checkbox) {
                checkbox.checked = isSelected;
            }
        });
        
        updateSelectionButtons();
    }

    function deleteSelectedImages() {
        if (state.selectedImages.length === 0) return;
        
        state.selectedImages.forEach(id => {
            const index = state.uploadedImages.findIndex(img => img.id === id);
            if (index !== -1) {
                const imageData = state.uploadedImages[index];
                imageData.element?.remove();
                state.uploadedImages.splice(index, 1);
            }
        });
        
        state.selectedImages = [];
        updateSelectionButtons();
        
        // Сохраняем изменения в localStorage
        saveUploadedImagesToStorage();
    }

    function filterUploadedImages() {
        const searchTerm = DOM.imageSearch.value.toLowerCase();
        
        state.uploadedImages.forEach(imageData => {
            const shouldShow = imageData.name.toLowerCase().includes(searchTerm);
            if (imageData.element) {
                imageData.element.style.display = shouldShow ? 'flex' : 'none';
            }
        });
    }

    function updateSelectionButtons() {
        const hasSelection = state.selectedImages.length > 0;
        DOM.deleteSelectedBtn.disabled = !hasSelection;
        DOM.selectAllBtn.textContent = state.selectedImages.length === state.uploadedImages.length ? 
            'Deselect All' : 'Select All';
    }

    // Добавление элементов на холст
    function addImageToCanvas(imageSrc, imgWidth, imgHeight, isInitialAdd = false) {
        const currentPage = getCurrentPage();
        if (!currentPage) return;

        // Проверяем, что текущая страница активна (добавьте эту проверку)
        if (!currentPage.element.classList.contains('active')) {
            showNotification("Please activate the page first before adding elements");
            return;
        }

        // Остальной код функции остается без изменений
        const imgContainer = createImageElement(imageSrc, imgWidth, imgHeight);
        setupElementInteractions(imgContainer, 'image');
        
        currentPage.canvas.appendChild(imgContainer);
        
        if (!isInitialAdd) {
            addToHistory('add-image', { element: imgContainer, pageId: state.currentPage });
            state.hasUnsavedChanges = true;
        }
    }

    function createImageElement(imageSrc, imgWidth, imgHeight) {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'image-container draggable resizable';
        
        const img = document.createElement('img');
        img.src = imageSrc;
        img.className = 'canvas-image';
        
        // Рассчитываем масштаб, чтобы изображение вписывалось в канвас 1000x1000
        const maxWidth = 900; // 90% от 1000px
        const maxHeight = 900;
        
        const widthRatio = maxWidth / imgWidth;
        const heightRatio = maxHeight / imgHeight;
        const scaleFactor = Math.min(widthRatio, heightRatio, 1);
        
        const displayWidth = imgWidth * scaleFactor;
        const displayHeight = imgHeight * scaleFactor;
        
        img.style.width = `${displayWidth}px`;
        img.style.height = `${displayHeight}px`;
        imgContainer.style.width = `${displayWidth}px`;
        imgContainer.style.height = `${displayHeight}px`;
        
        const menuIcon = createMenuIcon();
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        
        // Позиционируем изображение по центру канваса 1000x1000
        imgContainer.style.left = `${(1000 - displayWidth) / 2}px`;
        imgContainer.style.top = `${(1000 - displayHeight) / 2}px`;
        
        imgContainer.append(img, menuIcon, resizeHandle);
        return imgContainer;
    }

    function createMenuIcon() {
        const menuIcon = document.createElement('div');
        menuIcon.className = 'element-menu-icon';
        menuIcon.innerHTML = '⋯';
        menuIcon.style.display = 'none';
        menuIcon.contentEditable = 'false';
        
        menuIcon.addEventListener('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();
        });
        
        menuIcon.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const element = this.parentElement;
            const rect = element.getBoundingClientRect();
            
            const existingMenu = document.querySelector('.element-context-menu');
            if (existingMenu && existingMenu.dataset.targetElement === element.dataset.elementId) {
                existingMenu.remove();
                return;
            }
            
            showContextMenu(rect.right, rect.top, element);
        });
        
        return menuIcon;
    }


    function addTextToCanvas() {
        const currentPage = getCurrentPage();
        if (!currentPage) return;
        
        // Проверяем, что текущая страница активна
        if (!currentPage.element.classList.contains('active')) {
            showNotification("Please activate the page first before adding elements");
            return;
        }
        
        // Остальной код функции остается без изменений
        const text = DOM.textInput.value.trim();
        if (!text) {
            alert('Пожалуйста, сначала введите текст');
            return;
        }
        
        const textElement = createTextElement(text);
        setupElementInteractions(textElement, 'text');
        
        currentPage.canvas.appendChild(textElement);
        
        // Центрируем текстовый элемент на холсте
        const canvasRect = currentPage.canvas.getBoundingClientRect();
        const elementRect = textElement.getBoundingClientRect();
        textElement.style.left = `${(canvasRect.width - elementRect.width) / 2}px`;
        textElement.style.top = `${(canvasRect.height - elementRect.height) / 2}px`;
        
        addToHistory('add-text', { element: textElement, pageId: state.currentPage });
        state.hasUnsavedChanges = true;
        
        // Очищаем текстовое поле после добавления текста
        DOM.textInput.value = '';
    }

    function createTextElement(text = '') {
        const textElement = document.createElement('div');
        textElement.className = 'text-element draggable resizable';
        
        const textContent = document.createElement('textarea');
        textContent.className = 'text-content';
        textContent.value = text || 'Новый текст';
        
        // Устанавливаем начальные стили
        Object.assign(textElement.style, {
            position: 'absolute',
            width: '200px',
            height: 'auto',
            minWidth: '100px',
            minHeight: '40px'
        });
        
        const menuIcon = createMenuIcon();
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        
        textElement.append(textContent, menuIcon, resizeHandle);
        
        // Автоматическое изменение размера при вводе текста
        textContent.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
            
            // Также обновляем размер родительского элемента
            textElement.style.height = this.scrollHeight + 'px';
        });
        
        // Инициализируем правильную высоту
        setTimeout(() => {
            textContent.style.height = 'auto';
            textContent.style.height = (textContent.scrollHeight) + 'px';
            textElement.style.height = textContent.scrollHeight + 'px';
        }, 0);
        
        return textElement;
    }

    // Взаимодействие с элементами
    function setupElementInteractions(element, type) {
        // Удаляем старые обработчики, если они есть
        const oldMenuIcon = element.querySelector('.element-menu-icon');
        if (oldMenuIcon) {
            oldMenuIcon.remove();
        }
        
        const oldResizeHandle = element.querySelector('.resize-handle');
        if (oldResizeHandle) {
            oldResizeHandle.remove();
        }
        
        // Создаем новые элементы управления
        const menuIcon = createMenuIcon();
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        
        element.append(menuIcon, resizeHandle);
        
        // Обработчики для текстовых элементов
        if (type === 'text') {
            const textContent = element.querySelector('.text-content');
            
            textContent.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
                element.style.height = this.scrollHeight + 'px';
                state.hasUnsavedChanges = true;
            });
            
            textContent.addEventListener('focus', function() {
                element.classList.add('selected');
                state.selectedElement = element;
            });
            
            textContent.addEventListener('blur', function() {
                state.hasUnsavedChanges = true;
            });
        }
        
        // Общий обработчик клика для всех элементов
        element.addEventListener('click', function(e) {
            // Проверяем, что страница активна
            const pageElement = this.closest('.design-page');
            if (!pageElement || !pageElement.classList.contains('active')) {
                return; // Игнорируем клики на неактивных страницах
            }
            
            // Игнорируем клики на элементах управления
            if (e.target.classList.contains('resize-handle') || 
                e.target.classList.contains('element-menu-icon')) {
                return;
            }
            
            e.stopPropagation();
            
            const now = Date.now();
            if (state.lastClickedElement === element && now - state.lastClickTime < 300) {
                if (type === 'text') {
                    element.querySelector('.text-content').focus();
                }
                return;
            }
            
            // Показываем иконку меню только для текущего элемента
            document.querySelectorAll('.element-menu-icon').forEach(icon => {
                icon.style.display = 'none';
            });
            
            menuIcon.style.display = 'block';
            
            // Обработка выбора элементов
            if (e.ctrlKey || e.metaKey) {
                // Множественный выбор с Ctrl/Cmd
                this.classList.toggle('selected');
                if (this.classList.contains('selected')) {
                    state.selectedElements.push(this);
                } else {
                    const index = state.selectedElements.indexOf(this);
                    if (index !== -1) state.selectedElements.splice(index, 1);
                }
            } else {
                // Одиночный выбор
                deselectAllElements();
                this.classList.add('selected');
                state.selectedElements = [this];
            }
            
            state.lastClickedElement = this;
            state.lastClickTime = now;
            state.selectedElement = this;
        });
        
        // Настройка перетаскивания и изменения размера
        if (element.classList.contains('resizable')) {
            if (type === 'text') {
                makeResizable(element, { 
                    preserveAspectRatio: false,
                    minWidth: 50,
                    minHeight: 20
                });
            } else {
                makeResizable(element, {
                    preserveAspectRatio: true,
                    minWidth: 20,
                    minHeight: 20
                });
            }
        }
        
        if (element.classList.contains('draggable')) {
            makeDraggable(element);
        }
        
        // Устанавливаем уникальный ID элемента, если его нет
        if (!element.dataset.elementId) {
            element.dataset.elementId = 'el-' + Date.now();
        }
        
        // Для текстовых элементов добавляем дополнительные обработчики
        if (type === 'text') {
            setupTextElementListeners(element);
        }
    }

// Обновим функцию deselectAllElements
    function deselectAllElements() {
        document.querySelectorAll('.image-container, .text-element').forEach(el => {
            el.classList.remove('selected');
            const icon = el.querySelector('.element-menu-icon');
            if (icon) icon.style.display = 'none';
        });
        state.selectedElements = [];
        state.selectedElement = null;
    }


    // Контекстное меню
    function createContextMenu() {
        state.contextMenu = document.createElement('div');
        state.contextMenu.className = 'image-context-menu';
        state.contextMenu.style.display = 'none';
        document.body.appendChild(state.contextMenu);
    }

    function showContextMenu(x, y, targetElement) {
        // Закрываем старое меню, если оно есть
        const existingMenu = document.querySelector('.element-context-menu');
        if (existingMenu) {
            // Если кликнули по тому же элементу - просто закрываем меню
            if (existingMenu.dataset.targetElement === targetElement.dataset.elementId) {
                existingMenu.remove();
                return;
            }
            existingMenu.remove();
        }

        const contextMenu = document.createElement('div');
        contextMenu.className = 'element-context-menu';
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        contextMenu.dataset.targetElement = targetElement.dataset.elementId;
        
        const menuItems = [
            { text: 'Duplicate', action: () => duplicateElement(targetElement) },
            { text: 'Delete', action: () => deleteElement(targetElement) },
            { text: 'Bring to Front', action: () => bringToFront(targetElement) },
            { text: 'Send to Back', action: () => sendToBack(targetElement) }
        ];
        
        menuItems.forEach(item => {
            const option = document.createElement('div');
            option.className = 'context-menu-item';
            option.textContent = item.text;
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                item.action();
                contextMenu.remove();
                document.removeEventListener('click', closeMenu);
            });
            contextMenu.appendChild(option);
        });
        
        document.body.appendChild(contextMenu);
        
        // Функция для закрытия меню
        const closeMenu = (e) => {
            // Проверяем, был ли клик вне меню и не по самому элементу
            if (!contextMenu.contains(e.target) && !e.target.closest('.element-menu-icon')) {
                contextMenu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        
        // Добавляем обработчик с небольшой задержкой, чтобы не сработал сразу
        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 10);
    }

    function duplicateElement(element) {
        const clone = element.cloneNode(true);
        const currentPage = getCurrentPage();
        
        // Смещаем копию относительно оригинала
        clone.style.left = `${parseInt(element.style.left) + 20}px`;
        clone.style.top = `${parseInt(element.style.top) + 20}px`;
        
        // Полностью переустанавливаем обработчики для клона
        const type = element.classList.contains('text-element') ? 'text' : 'image';
        setupElementInteractions(clone, type);
        
        // Убедимся, что у клона есть уникальный ID
        if (!clone.dataset.elementId) {
            clone.dataset.elementId = 'el-' + Date.now();
        }
        
        currentPage.canvas.appendChild(clone);
        
        addToHistory('add-element', { element: clone, pageId: state.currentPage });
        state.hasUnsavedChanges = true;
    }

    function deleteElement(element) {
        const currentPage = getCurrentPage();
        if (currentPage && currentPage.canvas.contains(element)) {
            addToHistory('delete-element', { element, pageId: state.currentPage });
            element.remove();
            state.selectedElement = null;
            state.hasUnsavedChanges = true;
        }
    }

    function bringToFront(element) {
        const currentPage = getCurrentPage();
        if (!currentPage) return;
        
        // Сохраняем текущего соседа перед перемещением
        const oldNextSibling = element.nextSibling;
        
        // Просто перемещаем элемент в конец списка дочерних элементов
        currentPage.canvas.appendChild(element);
        
        addToHistory('bring-to-front', {
            element,
            oldNextSibling, // Сохраняем для возможности отмены
            pageId: state.currentPage
        });
        
        state.hasUnsavedChanges = true;
    }

    function sendToBack(element) {
        const currentPage = getCurrentPage();
        if (!currentPage) return;
        
        // Сохраняем текущего соседа перед перемещением
        const oldNextSibling = element.nextSibling;
        
        // Перемещаем элемент в начало списка дочерних элементов
        if (currentPage.canvas.firstChild) {
            currentPage.canvas.insertBefore(element, currentPage.canvas.firstChild);
        } else {
            currentPage.canvas.appendChild(element);
        }
        
        addToHistory('send-to-back', {
            element,
            oldNextSibling, // Сохраняем для возможности отмены
            pageId: state.currentPage
        });
        
        state.hasUnsavedChanges = true;
    }

    // Перетаскивание и изменение размера
    function makeDraggable(element) {
        element.onmousedown = function(e) {
            if (e.target.classList.contains('resize-handle') || 
                e.target.classList.contains('element-menu-icon')) {
                return;
            }
            
            e.preventDefault();
            
            deselectAllElements();
            element.classList.add('selected');
            state.selectedElement = element;
            
            const startX = e.clientX;
            const startY = e.clientY;
            const startLeft = parseInt(element.style.left) || 0;
            const startTop = parseInt(element.style.top) || 0;
            const canvas = element.parentElement;
            
            function moveElement(e) {
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                
                // Рассчитываем новые координаты с учетом границ холста
                let newLeft = startLeft + dx;
                let newTop = startTop + dy;
                
                // Ограничиваем перемещение границами холста
                newLeft = Math.max(0, Math.min(newLeft, canvas.offsetWidth - element.offsetWidth));
                newTop = Math.max(0, Math.min(newTop, canvas.offsetHeight - element.offsetHeight));
                
                element.style.left = newLeft + 'px';
                element.style.top = newTop + 'px';
                
                state.hasUnsavedChanges = true;
            }
            
            function stopDrag() {
                document.removeEventListener('mousemove', moveElement);
                document.removeEventListener('mouseup', stopDrag);
                
                // Записываем перемещение в историю только если позиция изменилась
                if (parseInt(element.style.left) !== startLeft || parseInt(element.style.top) !== startTop) {
                    addToHistory('move-element', {
                        element,
                        oldLeft: startLeft + 'px',
                        oldTop: startTop + 'px',
                        pageId: state.currentPage
                    });
                }
            }
            
            document.addEventListener('mousemove', moveElement);
            document.addEventListener('mouseup', stopDrag);
        };
    }

    function makeResizable(element) {
        const target = element.querySelector('img') || element.querySelector('.text-content') || element;
        const isImage = !!element.querySelector('img');
        const isText = !!element.querySelector('.text-content');
        
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        element.appendChild(resizeHandle);

        resizeHandle.addEventListener('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = parseInt(getComputedStyle(target).width);
            const startHeight = parseInt(getComputedStyle(target).height);
            const canvas = element.parentElement;
            const canvasRect = canvas.getBoundingClientRect();
            
            // Для изображений
            if (isImage) {
                const aspectRatio = startWidth / startHeight;
                const startContainerWidth = parseInt(getComputedStyle(element).width);
                const startContainerHeight = parseInt(getComputedStyle(element).height);
                
                function resizeImage(e) {
                    let newWidth = startWidth + (e.clientX - startX);
                    let newHeight = startHeight + (e.clientY - startY);
                    
                    if (e.shiftKey) {
                        newHeight = newWidth / aspectRatio;
                    }
                    
                    // Ограничиваем минимальный и максимальный размер
                    const minSize = 20;
                    const maxWidth = canvasRect.width - (parseInt(element.style.left) || 0);
                    const maxHeight = canvasRect.height - (parseInt(element.style.top) || 0);
                    
                    newWidth = Math.max(minSize, Math.min(newWidth, maxWidth));
                    newHeight = Math.max(minSize, Math.min(newHeight, maxHeight));
                    
                    // Обновляем размеры
                    target.style.width = newWidth + 'px';
                    target.style.height = newHeight + 'px';
                    element.style.width = newWidth + 'px';
                    element.style.height = newHeight + 'px';
                    
                    state.hasUnsavedChanges = true;
                }
                
                function stopResize() {
                    document.removeEventListener('mousemove', resizeImage);
                    document.removeEventListener('mouseup', stopResize);
                    
                    // Записываем изменение размера в историю
                    const newWidth = parseInt(target.style.width);
                    const newHeight = parseInt(target.style.height);
                    if (newWidth !== startWidth || newHeight !== startHeight) {
                        addToHistory('resize-element', {
                            element,
                            target: target,
                            oldWidth: startWidth + 'px',
                            oldHeight: startHeight + 'px',
                            oldContainerWidth: startContainerWidth + 'px',
                            oldContainerHeight: startContainerHeight + 'px',
                            pageId: state.currentPage
                        });
                    }
                }
                
                document.addEventListener('mousemove', resizeImage);
                document.addEventListener('mouseup', stopResize);
            }
            // Для текстовых блоков (остается без изменений)
            else if (isText) {
                function resizeText(e) {
                    let newWidth = startWidth + (e.clientX - startX);
                    let newHeight = startHeight + (e.clientY - startY);
                    
                    // Ограничения по размеру
                    const minWidth = 50;
                    const minHeight = 20;
                    const maxWidth = canvas.offsetWidth - (parseInt(element.style.left) || 0);
                    const maxHeight = canvas.offsetHeight - (parseInt(element.style.top) || 0);
                    
                    newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
                    newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));
                    
                    // Устанавливаем новые размеры
                    element.style.width = newWidth + 'px';
                    
                    // Для текстовых элементов не изменяем высоту при ресайзе, 
                    // так как она должна определяться содержимым
                    const textContent = element.querySelector('.text-content');
                    if (textContent) {
                        textContent.style.width = '100%';
                        // Пересчитываем высоту после изменения ширины
                        textContent.style.height = 'auto';
                        textContent.style.height = textContent.scrollHeight + 'px';
                        element.style.height = textContent.scrollHeight + 'px';
                    }
                    
                    state.hasUnsavedChanges = true;
                }
                
                function stopResize() {
                    document.removeEventListener('mousemove', resizeText);
                    document.removeEventListener('mouseup', stopResize);
                    
                    // Записываем изменение размера в историю
                    const newWidth = parseInt(element.style.width);
                    const newHeight = parseInt(element.style.height);
                    if (newWidth !== startWidth || newHeight !== startHeight) {
                        addToHistory('resize-element', {
                            element,
                            oldWidth: startWidth + 'px',
                            oldHeight: startHeight + 'px',
                            pageId: state.currentPage
                        });
                    }
                }
                
                document.addEventListener('mousemove', resizeText);
                document.addEventListener('mouseup', stopResize);
            } 
        });
    }

    // Управление страницами
    function addNewPage() {
        const newPageId = state.pages.length > 0 ? Math.max(...state.pages.map(p => p.id)) + 1 : 1;
        
        const pageElement = document.createElement('div');
        pageElement.className = 'design-page';
        pageElement.dataset.pageId = newPageId;
        
        const canvasElement = document.createElement('div');
        canvasElement.className = 'design-canvas';
        canvasElement.style.width = '1000px';
        canvasElement.style.height = '1000px';
        pageElement.appendChild(canvasElement);
        DOM.pagesContainer.appendChild(pageElement);
        
        const newPage = { id: newPageId, element: pageElement, canvas: canvasElement };
        state.pages.push(newPage);
        state.currentPage = newPageId;
        
        updateActivePageIndicator();
        setTimeout(() => centerCurrentPage(true), 50);
        
        addToHistory('add-page', { pageId: newPageId });
        state.hasUnsavedChanges = true;
    }

    function updateActivePageIndicator() {
        state.pages.forEach(page => {
            const isActive = page.id === state.currentPage;
            page.element.classList.toggle('active', isActive);
            page.element.classList.toggle('inactive', !isActive);
            
            // Set pointer cursor only at lower zoom levels
            page.element.style.cursor = state.currentZoom <= 60 ? 'pointer' : 'default';
        });
    }

    function getCurrentPage() {
        return state.pages.find(p => p.id === state.currentPage);
    }

    function handleCanvasClick(e) {
        const clickedElement = e.target;
        
        // Check if we clicked on a page or canvas background
        const isPageClick = clickedElement.classList.contains('design-page');
        const isCanvasClick = clickedElement.classList.contains('design-canvas');
        
        if (!isPageClick && !isCanvasClick) return;
        
        // Find the page element
        const pageElement = isPageClick ? clickedElement : clickedElement.closest('.design-page');
        if (!pageElement) return;
        
        const pageId = parseInt(pageElement.dataset.pageId);
        if (pageId === state.currentPage) return;
        
        // Update active page
        setActivePage(pageId);
    }

    function setActivePage(pageId) {
        // Check if page exists
        const pageExists = state.pages.some(p => p.id === pageId);
        if (!pageExists) return;
        
        // Update classes for all pages
        document.querySelectorAll('.design-page').forEach(page => {
            const isActive = parseInt(page.dataset.pageId) === pageId;
            page.classList.toggle('active', isActive);
            page.classList.toggle('inactive', !isActive);
        });
        
        // Update state
        state.currentPage = pageId;
        
        // Update page indicator
        updateActivePageIndicator();
        
        // Center the page (handled by the click handler)
    }

    // Zoom и прокрутка
    function adjustZoom(amount) {
        const oldZoom = state.currentZoom;
        state.currentZoom = Math.max(10, Math.min(200, state.currentZoom + amount));
        
        DOM.zoomLevel.textContent = `${state.currentZoom}%`;
        DOM.pagesContainer.style.transform = `scale(${state.currentZoom / 100})`;
        
        // Update cursor style based on zoom level
        updateActivePageIndicator();
        
        // Center the current page after zoom
        setTimeout(() => {
            centerCurrentPage(true);
        }, 10);
    }

    function centerCurrentPage(smooth = false) {
        const container = DOM.canvasContainer;
        const currentPage = getCurrentPage();
        
        if (!currentPage || !container) return;
        
        // Calculate scaled dimensions
        const scaledWidth = 1000 * (state.currentZoom / 100);
        const scaledHeight = 1000 * (state.currentZoom / 100);
        
        // Calculate scroll positions
        const scrollLeft = currentPage.element.offsetLeft - (container.offsetWidth - scaledWidth) / 2;
        const scrollTop = currentPage.element.offsetTop - (container.offsetHeight - scaledHeight) / 2;
        
        // Apply scrolling
        container.scrollTo({
            left: scrollLeft,
            top: scrollTop,
            behavior: smooth ? 'smooth' : 'auto'
        });
    }


    function updateZoomControlsPosition() {
        const zoomControls = document.querySelector('.zoom-controls');
        if (!zoomControls) return;
        
        zoomControls.style.left = state.isSidebarOpen ? '424px' : '104px';
    }

    function setupPageScrolling() {
        let isScrolling = false;
        let scrollTimeout;
        
        DOM.canvasContainer.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            isScrolling = true;
            
            scrollTimeout = setTimeout(() => {
                updateActivePageOnScroll();
                isScrolling = false;
            }, 100);
        });
        
        // Удаляем старый обработчик клика на pagesContainer
        DOM.pagesContainer.removeEventListener('click', handlePagesContainerClick);
        
        // Добавляем новый обработчик
        DOM.pagesContainer.addEventListener('click', handlePagesContainerClick);
    }

    function handlePagesContainerClick(e) {
        const pageElement = e.target.closest('.design-page');
        if (!pageElement) return;

        const pageId = parseInt(pageElement.dataset.pageId);
        
        // Always activate the clicked page, regardless of zoom level
        if (pageId !== state.currentPage) {
            setActivePage(pageId);
        }
        
        // Always center the page when clicked, with smooth scrolling only at lower zoom levels
        centerCurrentPage(state.currentZoom <= 60);
    }

    function updateActivePageOnScroll() {
        const container = DOM.canvasContainer;
        const containerRect = container.getBoundingClientRect();
        
        // Определяем центр видимой области контейнера
        const containerCenter = {
            x: containerRect.left + containerRect.width / 2,
            y: containerRect.top + containerRect.height / 2
        };
        
        let closestPage = null;
        let minDistance = Infinity;
        
        state.pages.forEach(page => {
            const pageRect = page.element.getBoundingClientRect();
            
            // Определяем центр страницы
            const pageCenter = {
                x: pageRect.left + pageRect.width / 2,
                y: pageRect.top + pageRect.height / 2
            };
            
            // Рассчитываем расстояние от центра страницы до центра видимой области
            const distance = Math.sqrt(
                Math.pow(pageCenter.x - containerCenter.x, 2) + 
                Math.pow(pageCenter.y - containerCenter.y, 2)
            );
            
            if (distance < minDistance) {
                minDistance = distance;
                closestPage = page;
            }
        });
        
        if (closestPage && closestPage.id !== state.currentPage) {
            state.currentPage = closestPage.id;
            updateActivePageIndicator();
        }
    }

    // Режимы отображения
    function toggleDisplay() {
        state.isHorizontalScroll = !state.isHorizontalScroll;
        
        if (state.isHorizontalScroll) {
            DOM.pagesContainer.classList.add('horizontal-scroll');
            DOM.canvasContainer.style.overflowX = 'auto';
            DOM.canvasContainer.style.overflowY = 'hidden';
            
            state.pages.forEach(page => {
                page.element.style.marginRight = `${state.fixedPageMargin}px`;
                page.element.style.marginBottom = '0';
            });
        } else {
            DOM.pagesContainer.classList.remove('horizontal-scroll');
            DOM.canvasContainer.style.overflowX = 'hidden';
            DOM.canvasContainer.style.overflowY = 'auto';
            
            state.pages.forEach(page => {
                page.element.style.marginRight = '0';
                page.element.style.marginBottom = `${state.fixedPageMargin}px`;
            });
        }
        
        updateZoomControlsPosition();
        centerCurrentPage(true);
    }

    // История действий
    function addToHistory(action, data) {
        // Удаляем все действия после текущего индекса (если мы находимся не в конце истории)
        if (state.historyIndex < state.actionHistory.length - 1) {
            state.actionHistory = state.actionHistory.slice(0, state.historyIndex + 1);
        }

        // Для разных типов действий сохраняем разные данные
        switch (action) {
            case 'resize-element':
                // Для изображений сохраняем размеры и контейнера, и самого изображения
                if (data.target && data.target.tagName === 'IMG') {
                    data.newSize = {
                        width: data.target.style.width,
                        height: data.target.style.height
                    };
                    data.newContainerSize = {
                        width: data.element.style.width,
                        height: data.element.style.height
                    };
                } else {
                    // Для текстовых элементов просто сохраняем размеры элемента
                    data.newSize = {
                        width: data.element.style.width,
                        height: data.element.style.height
                    };
                }
                break;
                
            case 'add-element':
            case 'delete-element':
                data.elementData = {
                    type: data.element.classList.contains('text-element') ? 'text' : 'image',
                    html: data.element.outerHTML,
                    left: data.element.style.left,
                    top: data.element.style.top,
                    width: data.element.style.width,
                    height: data.element.style.height,
                    zIndex: data.element.style.zIndex
                };
                break;

            case 'move-element':
                data.oldPosition = {
                    left: data.oldLeft,
                    top: data.oldTop
                };
                data.newPosition = {
                    left: data.element.style.left,
                    top: data.element.style.top
                };
                break;

            case 'resize-element':
                data.oldSize = {
                    width: data.oldWidth,
                    height: data.oldHeight
                };
                data.newSize = {
                    width: data.element.style.width,
                    height: data.element.style.height
                };
                break;

            case 'edit-text':
                data.oldText = data.oldContent;
                data.newText = data.element.querySelector('.text-content').value;
                break;

            case 'z-index-change':
                data.oldZIndex = data.oldZIndex;
                data.newZIndex = data.element.style.zIndex;
                break;

            case 'bring-to-front':
                data.oldNextSibling = data.element.nextSibling;
                break;

            case 'send-to-back':
                data.oldNextSibling = data.element.nextSibling;
                break;
        }

        // Добавляем действие в историю
        state.actionHistory.push({ action, data });
        state.historyIndex = state.actionHistory.length - 1;
        updateUndoRedoButtons();
        state.hasUnsavedChanges = true;
    }

    function undoAction() {
        if (state.historyIndex < 0) return;

        const { action, data } = state.actionHistory[state.historyIndex];
        const page = state.pages.find(p => p.id === (data.pageId || state.currentPage));

        if (!page) {
            state.historyIndex--;
            updateUndoRedoButtons();
            return;
        }

        switch (action) {
            case 'resize-element':
                // Отмена изменения размера - возвращаем старые размеры
                if (data.element) {
                    // Для изображений восстанавливаем размеры и контейнера, и самого изображения
                    if (data.target && data.target.tagName === 'IMG') {
                        data.target.style.width = data.oldWidth;
                        data.target.style.height = data.oldHeight;
                        data.element.style.width = data.oldContainerWidth;
                        data.element.style.height = data.oldContainerHeight;
                    } 
                    // Для текстовых элементов
                    else {
                        data.element.style.width = data.oldWidth;
                        data.element.style.height = data.oldHeight;
                        
                        const textContent = data.element.querySelector('.text-content');
                        if (textContent) {
                            textContent.style.height = 'auto';
                            textContent.style.height = textContent.scrollHeight + 'px';
                        }
                    }
                }
                break;

            case 'add-element':
                // Отмена добавления - удаляем элемент
                if (data.element && page.canvas.contains(data.element)) {
                    data.element.remove();
                } else if (data.elementData) {
                    // Если элемента уже нет, пытаемся найти его по ID
                    const element = page.canvas.querySelector(`[data-element-id="${data.elementData.id}"]`);
                    if (element) element.remove();
                }
                break;

            case 'delete-element':
                // Отмена удаления - восстанавливаем элемент
                const restoredElement = createElementFromData(data.elementData);
                if (restoredElement) {
                    restoredElement.style.left = data.elementData.left;
                    restoredElement.style.top = data.elementData.top;
                    restoredElement.style.width = data.elementData.width;
                    restoredElement.style.height = data.elementData.height;
                    restoredElement.style.zIndex = data.elementData.zIndex;
                    page.canvas.appendChild(restoredElement);
                    setupElementInteractions(restoredElement, data.elementData.type);
                }
                break;

            case 'move-element':
                // Отмена перемещения - возвращаем на старое место
                if (data.element) {
                    data.element.style.left = data.oldPosition.left;
                    data.element.style.top = data.oldPosition.top;
                }
                break;

            case 'resize-element':
                // Отмена изменения размера - возвращаем старые размеры
                if (data.element) {
                    data.element.style.width = data.oldSize.width;
                    data.element.style.height = data.oldSize.height;
                    
                    // Для текстовых элементов обновляем textarea
                    if (data.element.classList.contains('text-element')) {
                        const textContent = data.element.querySelector('.text-content');
                        if (textContent) {
                            textContent.style.height = 'auto';
                            textContent.style.height = textContent.scrollHeight + 'px';
                        }
                    }
                }
                break;

            case 'edit-text':
                // Отмена редактирования текста - возвращаем старый текст
                if (data.element) {
                    const textContent = data.element.querySelector('.text-content');
                    if (textContent) {
                        textContent.value = data.oldText;
                        textContent.style.height = 'auto';
                        textContent.style.height = textContent.scrollHeight + 'px';
                    }
                }
                break;

            case 'z-index-change':
                if (data.element) {
                    data.element.style.zIndex = data.oldZIndex;
                }
                break;

            case 'add-page':
                // Отмена добавления страницы - удаляем страницу
                const pageToRemove = state.pages.find(p => p.id === data.pageId);
                if (pageToRemove) {
                    pageToRemove.element.remove();
                    state.pages = state.pages.filter(p => p.id !== data.pageId);
                    state.currentPage = state.pages[state.pages.length - 1]?.id || 1;
                    updateActivePageIndicator();
                }
                break;

            case 'delete-page':
                // Отмена удаления страницы - восстанавливаем страницу
                const newPageElement = document.createElement('div');
                newPageElement.className = 'design-page';
                newPageElement.dataset.pageId = data.pageId;

                const newCanvasElement = document.createElement('div');
                newCanvasElement.className = 'design-canvas';
                newPageElement.appendChild(newCanvasElement);

                DOM.pagesContainer.appendChild(newPageElement);
                newPageElement.style.transform = `scale(${state.currentZoom / 100})`;

                const newPage = { 
                    id: data.pageId, 
                    element: newPageElement, 
                    canvas: newCanvasElement 
                };
                state.pages.push(newPage);
                state.currentPage = data.pageId;

                // Восстанавливаем элементы
                data.elements?.forEach(elData => {
                    const element = createElementFromData(elData);
                    if (element) {
                        element.style.left = elData.left;
                        element.style.top = elData.top;
                        element.style.width = elData.width;
                        element.style.height = elData.height;
                        element.style.zIndex = elData.zIndex;
                        newCanvasElement.appendChild(element);
                        setupElementInteractions(element, elData.type);
                    }
                });

                updateActivePageIndicator();
                break;

            case 'bring-to-front':
                // Отмена "Bring to Front" - возвращаем элемент на старое место
                if (data.element && data.oldNextSibling) {
                    data.element.parentNode.insertBefore(data.element, data.oldNextSibling);
                } else if (data.element) {
                    data.element.parentNode.appendChild(data.element);
                }
                break;

            case 'send-to-back':
                // Отмена "Send to Back" - возвращаем элемент на старое место
                if (data.element && data.oldNextSibling) {
                    data.element.parentNode.insertBefore(data.element, data.oldNextSibling);
                } else if (data.element) {
                    data.element.parentNode.appendChild(data.element);
                }
                break;
        }

        state.historyIndex--;
        updateUndoRedoButtons();
        state.hasUnsavedChanges = true;
    }

    function redoAction() {
        if (state.historyIndex >= state.actionHistory.length - 1) return;

        state.historyIndex++;
        const { action, data } = state.actionHistory[state.historyIndex];
        const page = state.pages.find(p => p.id === (data.pageId || state.currentPage));

        if (!page) {
            updateUndoRedoButtons();
            return;
        }

        switch (action) {
            case 'resize-element':
                // Повтор изменения размера
                if (data.element) {
                    // Для изображений
                    if (data.target && data.target.tagName === 'IMG') {
                        data.target.style.width = data.newSize.width;
                        data.target.style.height = data.newSize.height;
                        data.element.style.width = data.newContainerSize.width;
                        data.element.style.height = data.newContainerSize.height;
                    } 
                    // Для текстовых элементов
                    else {
                        data.element.style.width = data.newSize.width;
                        data.element.style.height = data.newSize.height;
                        
                        const textContent = data.element.querySelector('.text-content');
                        if (textContent) {
                            textContent.style.height = 'auto';
                            textContent.style.height = textContent.scrollHeight + 'px';
                        }
                    }
                }
                break;

            case 'add-element':
                // Повтор добавления элемента
                const element = createElementFromData(data.elementData);
                if (element) {
                    element.style.left = data.elementData.left;
                    element.style.top = data.elementData.top;
                    element.style.width = data.elementData.width;
                    element.style.height = data.elementData.height;
                    element.style.zIndex = data.elementData.zIndex;
                    page.canvas.appendChild(element);
                    setupElementInteractions(element, data.elementData.type);
                }
                break;

            case 'delete-element':
                // Повтор удаления элемента
                if (data.element) {
                    data.element.remove();
                } else {
                    // Если ссылки на элемент нет, пытаемся найти его по ID
                    const element = page.canvas.querySelector(`[data-element-id="${data.elementData.id}"]`);
                    if (element) element.remove();
                }
                break;

            case 'move-element':
                // Повтор перемещения элемента
                if (data.element) {
                    data.element.style.left = data.newPosition.left;
                    data.element.style.top = data.newPosition.top;
                }
                break;

            case 'resize-element':
                // Повтор изменения размера
                if (data.element) {
                    data.element.style.width = data.newSize.width;
                    data.element.style.height = data.newSize.height;
                    
                    // Для текстовых элементов обновляем textarea
                    if (data.element.classList.contains('text-element')) {
                        const textContent = data.element.querySelector('.text-content');
                        if (textContent) {
                            textContent.style.height = 'auto';
                            textContent.style.height = textContent.scrollHeight + 'px';
                        }
                    }
                }
                break;

            case 'edit-text':
                // Повтор редактирования текста
                if (data.element) {
                    const textContent = data.element.querySelector('.text-content');
                    if (textContent) {
                        textContent.value = data.newText;
                        textContent.style.height = 'auto';
                        textContent.style.height = textContent.scrollHeight + 'px';
                    }
                }
                break;

            case 'z-index-change':
                if (data.element) {
                    data.element.style.zIndex = data.newZIndex;
                }
                break;

            case 'add-page':
                // Повтор добавления страницы
                addNewPage();
                break;

            case 'delete-page':
                // Повтор удаления страницы
                confirmDelete();
                break;

            case 'bring-to-front':
                bringToFront(data.element);
                break;

            case 'send-to-back':
                sendToBack(data.element);
                break;
        }

        updateUndoRedoButtons();
        state.hasUnsavedChanges = true;
    }

// Вспомогательная функция для создания элемента из сохраненных данных
    function createElementFromData(elementData) {
        if (!elementData) return null;
        
        const temp = document.createElement('div');
        temp.innerHTML = elementData.html;
        const element = temp.firstChild;
        
        // Полностью переустанавливаем обработчики
        const type = elementData.type === 'text' ? 'text' : 'image';
        setupElementInteractions(element, type);
        
        // Убедимся, что у элемента есть уникальный ID
        if (!element.dataset.elementId) {
            element.dataset.elementId = 'el-' + Date.now();
        }
        
        return element;
    }

    function updateUndoRedoButtons() {
        DOM.undoBtn.disabled = state.historyIndex < 0;
        DOM.redoBtn.disabled = state.historyIndex >= state.actionHistory.length - 1;
    }

    // Управление боковой панелью
    function toggleSidebar(type) {
        if (state.isSidebarOpen && state.activeSidebar === type) {
            closeSidebar();
        } else {
            openSidebar(type);
        }
    }

    function openSidebar(type) {
        DOM.sidebar.style.width = '340px';
        state.isSidebarOpen = true;
        state.activeSidebar = type;
        
        DOM.uploadsContent.style.display = type === 'uploads' ? 'flex' : 'none';
        DOM.textContent.style.display = type === 'text' ? 'flex' : 'none';
    }

    function closeSidebar() {
        DOM.sidebar.style.width = '0';
        state.isSidebarOpen = false;
        state.activeSidebar = null;
    }

    // Обработчики глобальных кликов
    function handleGlobalClick(e) {
        // Закрываем контекстное меню при клике вне его
        const contextMenu = document.querySelector('.image-context-menu');
            if (contextMenu && !contextMenu.contains(e.target)) {
                contextMenu.remove();
            }
        
        // Закрываем боковую панель при клике вне ее
        if (state.isSidebarOpen && 
            !DOM.sidebar.contains(e.target) && 
            !DOM.uploadsBtn.contains(e.target) && 
            !DOM.textBtn.contains(e.target)) {
            closeSidebar();
        }
        
        // Снимаем выделение с элементов при клике на холст
        if (e.target.classList.contains('design-canvas') && state.selectedElement) {
            deselectAllElements();
            state.selectedElement = null;
        }
    }

    function handleOutsideClick(e) {
        if (!DOM.downloadBtn.contains(e.target) && 
            !DOM.downloadDropdown.contains(e.target)) {
            DOM.downloadDropdown.style.display = 'none';
        }
        
        const languageDropdown = document.querySelector('.language-dropdown');
        if (languageDropdown && 
            !languageDropdown.querySelector('.language-btn').contains(e.target) && 
            !languageDropdown.querySelector('.dropdown-content').contains(e.target)) {
            languageDropdown.querySelector('.dropdown-content').style.display = 'none';
        }
    }

    // Обработчики холста
    function setupCanvasClickHandler() {
        document.querySelector('.design-canvas').addEventListener('click', (e) => {
            if (e.target === document.querySelector('.design-canvas')) {
                deselectAllElements();
                state.selectedElement = null;
            }
        });
    }

    // Управление модальными окнами
    function showDeleteModal() {
        if (state.pages.length <= 1) {
            alert("You can't delete the last page");
            return;
        }
        DOM.deleteModal.style.display = 'flex';
    }

    function confirmDelete() {
        const pageToDelete = getCurrentPage();
        if (!pageToDelete || state.pages.length <= 1) {
            DOM.deleteModal.style.display = 'none';
            return;
        }
        
        // Сохраняем элементы для отмены
        const elementsToSave = Array.from(pageToDelete.canvas.children).map(el => {
            if (el.querySelector('img')) {
                return {
                    type: 'image',
                    src: el.querySelector('img').src,
                    left: el.style.left,
                    top: el.style.top
                };
            }
            return null;
        }).filter(Boolean);
        
        // Определяем новую текущую страницу
        const deleteIndex = state.pages.findIndex(p => p.id === state.currentPage);
        const newCurrentPageId = deleteIndex === state.pages.length - 1 ? 
            state.pages[deleteIndex - 1].id : state.pages[deleteIndex + 1].id;
        
        // Удаляем страницу
        pageToDelete.element.remove();
        state.pages = state.pages.filter(p => p.id !== state.currentPage);
        state.currentPage = newCurrentPageId;
        
        updateActivePageIndicator();
        centerCurrentPage(true);
        
        addToHistory('delete-page', {
            pageId: state.currentPage,
            elements: elementsToSave
        });
        state.hasUnsavedChanges = true;
        
        DOM.deleteModal.style.display = 'none';
    }

    function cancelDelete() {
        DOM.deleteModal.style.display = 'none';
    }

    function handleClose() {
    if (state.hasUnsavedChanges) {
        DOM.unsavedModal.style.display = 'flex';
    } else {
        // Очищаем данные перед закрытием
        localStorage.removeItem('editingDesignId');
        saveUploadedImagesToStorage();
        window.location.href = 'index.html';
    }
    }

    let isExplicitNavigation = false;

    function confirmLeave() {
        // Сохраняем дизайн перед переходом
        saveDesign(function() {
            isExplicitNavigation = true;
            state.hasUnsavedChanges = false;
            saveUploadedImagesToStorage();
            DOM.unsavedModal.style.display = 'none';
            window.location.href = 'index.html';
        });
    }

// Обновляем обработчик beforeunload
window.addEventListener('beforeunload', function(e) {
    if (state.hasUnsavedChanges && !isExplicitNavigation) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        return e.returnValue;
    }
});

    function cancelLeave() {
        DOM.unsavedModal.style.display = 'none';
    }

    // Другие функции в редакторе
    async function saveDesign(callback) {
    try {
        DOM.saveAnimation.classList.add('active');
        
        const designState = await saveDesignState();
        const savedDesigns = JSON.parse(localStorage.getItem('savedDesigns') || []);
        
        // Если это редактирование существующего дизайна
        if (state.isEditing && state.editingDesignId) {
        const index = savedDesigns.findIndex(d => d.id === state.editingDesignId);
        if (index !== -1) {
            // Обновляем существующий дизайн
            savedDesigns[index] = designState;
            designState.id = state.editingDesignId; // Сохраняем оригинальный ID
        }
        } else {
        // Создаем новый дизайн
        designState.id = 'design-' + Date.now();
        designState.createdAt = new Date().toISOString();
        savedDesigns.unshift(designState);
        }
        
        localStorage.setItem('savedDesigns', JSON.stringify(savedDesigns));
        
        // Очищаем временные данные
        localStorage.removeItem('editingDesignId');
        state.isEditing = false;
        
        setTimeout(() => {
        DOM.saveAnimation.classList.remove('active');
        showNotification();
        state.hasUnsavedChanges = false;
        if (typeof callback === 'function') callback();
        }, 2000);
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        DOM.saveAnimation.classList.remove('active');
    }
    }

    async function saveDesignState() {
    // Генерируем миниатюру для первой страницы
    const thumbnail = await generateThumbnail(state.pages[0]);
    
    const designState = {
        name: DOM.designTitle.value,
        title: DOM.designTitle.value,
        pages: state.pages.map(page => {
        return {
            id: page.id,
            elements: Array.from(page.canvas.children).map(element => {
            return {
                type: element.classList.contains('text-element') ? 'text' : 'image',
                html: element.outerHTML,
                left: element.style.left,
                top: element.style.top,
                width: element.style.width,
                height: element.style.height
            };
            })
        };
        }),
        currentPage: state.currentPage,
        currentZoom: state.currentZoom,
        isHorizontalScroll: state.isHorizontalScroll,
        uploadedImages: state.uploadedImages.map(img => ({
        id: img.id,
        name: img.name,
        src: img.src,
        width: img.width,
        height: img.height
        })),
        thumbnail: thumbnail // Добавляем сгенерированную миниатюру
    };
    
    localStorage.setItem('designState', JSON.stringify(designState));
    return designState;
    }

    function loadDesignState() {
        const savedState = localStorage.getItem('designState');
        if (!savedState) return false;
        
        try {
            const designState = JSON.parse(savedState);
            
            // Восстанавливаем основные параметры
            DOM.designTitle.value = designState.title;
            state.currentZoom = designState.currentZoom || 100;
            state.isHorizontalScroll = designState.isHorizontalScroll || false;
            DOM.zoomLevel.textContent = `${state.currentZoom}%`;
            
            // Очищаем текущие страницы
            DOM.pagesContainer.innerHTML = '';
            state.pages = [];
            
            // Восстанавливаем страницы
            designState.pages.forEach(pageData => {
                const pageElement = document.createElement('div');
                pageElement.className = 'design-page';
                pageElement.dataset.pageId = pageData.id;
                
                const canvasElement = document.createElement('div');
                canvasElement.className = 'design-canvas';
                pageElement.appendChild(canvasElement);
                DOM.pagesContainer.appendChild(pageElement);
                
                // Не применяем масштаб здесь, так как он будет применен к pages-container
                
                // Восстанавливаем элементы
                pageData.elements.forEach(elementData => {
                    const element = createElementFromData(elementData);
                    if (element) {
                        element.style.left = elementData.left;
                        element.style.top = elementData.top;
                        element.style.width = elementData.width;
                        element.style.height = elementData.height;
                        canvasElement.appendChild(element);
                        
                        const type = elementData.type === 'text' ? 'text' : 'image';
                        setupElementInteractions(element, type);
                    }
                });
                
                state.pages.push({
                    id: pageData.id,
                    element: pageElement,
                    canvas: canvasElement
                });
            });
            
            // Применяем масштаб к pages-container
            DOM.pagesContainer.style.transform = `scale(${state.currentZoom / 100})`;
            
            // Всегда устанавливаем текущей первую страницу при загрузке
            state.currentPage = 1;
            updateActivePageIndicator();
            
            // Восстанавливаем режим отображения
            if (state.isHorizontalScroll) {
                DOM.pagesContainer.classList.add('horizontal-scroll');
                DOM.canvasContainer.style.overflowX = 'auto';
                DOM.canvasContainer.style.overflowY = 'hidden';
            }
            
            // Восстанавливаем загруженные изображения
            if (designState.uploadedImages) {
                state.uploadedImages = designState.uploadedImages;
                renderUploadedImages();
            }
            
            // Центрируем первую страницу после загрузки
            setTimeout(() => centerCurrentPage(true), 100);
            
            return true;
        } catch (e) {
            console.error('Failed to load design state:', e);
            return false;
        }
    }

    function renderUploadedImages() {
        DOM.uploadsGrid.innerHTML = '';
        state.uploadedImages.forEach(imageData => {
            renderUploadedImage(imageData);
        });
    }



    function showNotification() {
        DOM.notification.style.display = 'block';
        setTimeout(() => {
            DOM.notification.style.display = 'none';
        }, 3000);
    }

    function toggleDownloadDropdown() {
        DOM.downloadDropdown.style.display = 
            DOM.downloadDropdown.style.display === 'flex' ? 'none' : 'flex';
    }


    // скачивание дизайна

    async function downloadDesign(format) {
        try {
            DOM.saveAnimation.classList.add('active');
            
            if (state.pages.length === 1) {
                await downloadSinglePage(state.pages[0], format);
            } else {
                await downloadMultiplePages(format);
            }
        } catch (error) {
            console.error('Download error:', error);
            alert(`Ошибка при скачивании: ${error.message}`);
        } finally {
            DOM.downloadDropdown.style.display = 'none';
            DOM.saveAnimation.classList.remove('active');
        }
    }

    async function processDownload(format) {
        // Для одностраничного дизайна
        if (state.pages.length === 1) {
            await downloadSinglePage(state.pages[0], format);
        } 
        // Для многостраничного дизайна
        else {
            if (format === 'pdf') {
                await downloadAllPagesAsPdf();
            } else {
                // Для PNG/JPG создаем zip-архив со всеми страницами
                await downloadAllPagesAsImages(format);
            }
        }
    }



    async function downloadSinglePage(page, format) {
        if (format === 'pdf') {
            await downloadAsPdf([page]);
        } else {
            const canvas = await renderPageToCanvas(page);
            const type = format === 'png' ? 'image/png' : 'image/jpeg';
            downloadCanvas(canvas, `${DOM.designTitle.value}.${format}`, type);
        }
    }

    async function downloadMultiplePages(format) {
        if (format === 'pdf') {
            await downloadAsPdf(state.pages);
        } else {
            const zip = new JSZip();
            
            for (let i = 0; i < state.pages.length; i++) {
                const canvas = await renderPageToCanvas(state.pages[i]);
                const blob = await canvasToBlob(canvas, `image/${format}`);
                zip.file(`page_${i + 1}.${format}`, blob);
            }
            
            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `${DOM.designTitle.value}.zip`);
        }
    }

    async function renderPageToCanvas(page) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Фиксированный размер 1000x1000
        canvas.width = 1000;
        canvas.height = 1000;
        
        // Заливаем белым фоном
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Рисуем все элементы страницы
        const elements = Array.from(page.canvas.children)
            .sort((a, b) => {
                const aZ = parseInt(a.style.zIndex) || 0;
                const bZ = parseInt(b.style.zIndex) || 0;
                return aZ - bZ;
            });
        
        for (const element of elements) {
            if (element.classList.contains('image-container')) {
                await drawImageElement(element, ctx);
            } else if (element.classList.contains('text-element')) {
                await drawTextElement(element, ctx);
            }
        }
        
        return canvas;
    }

    async function drawImageElement(element, ctx) {
        const img = element.querySelector('img');
        if (!img) return;
        
        const x = parseInt(element.style.left) || 0;
        const y = parseInt(element.style.top) || 0;
        const width = parseInt(element.style.width) || img.naturalWidth;
        const height = parseInt(element.style.height) || img.naturalHeight;
        
        try {
            ctx.drawImage(img, x, y, width, height);
        } catch (error) {
            console.error('Error drawing image:', error);
            // Запасной вариант для изображений с CORS
            ctx.fillStyle = '#dddddd';
            ctx.fillRect(x, y, width, height);
            ctx.strokeStyle = '#999999';
            ctx.strokeRect(x, y, width, height);
            ctx.fillStyle = '#666666';
            ctx.font = '12px Arial';
            ctx.fillText('Image not available', x + 10, y + 20);
        }
    }

    async function drawTextElement(element, ctx) {
        const textarea = element.querySelector('textarea');
        if (!textarea) return;
        
        const x = parseInt(element.style.left) || 0;
        const y = parseInt(element.style.top) || 0;
        const width = parseInt(element.style.width) || 200;
        const height = parseInt(element.style.height) || textarea.scrollHeight;
        
        const style = window.getComputedStyle(textarea);
        
        // Устанавливаем стили текста
        ctx.font = style.font;
        ctx.fillStyle = style.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        
        // Разбиваем текст на строки с учетом переносов
        const lines = [];
        const words = textarea.value.split(' ');
        let currentLine = words[0] || '';
        
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const testLine = currentLine + ' ' + word;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width < width) {
                currentLine = testLine;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        
        // Не рисуем фон текстового блока (оставляем прозрачным)
        // ctx.fillStyle = '#ffffff'; // Убрали заливку белым цветом
        // ctx.fillRect(x, y, width, height); // Убрали рисование фона
        
        // Рисуем текст
        const lineHeight = parseInt(style.fontSize) * 1.2;
        let currentY = y;
        
        for (const line of lines) {
            ctx.fillText(line, x, currentY);
            currentY += lineHeight;
        }
    }

    async function downloadAsPdf(pages) {
        // Показываем индикатор загрузки
        const loadingIndicator = showPdfLoadingIndicator();
        
        try {
            // 1. Проверяем доступность библиотеки PDF
            if (typeof window.jspdf === 'undefined') {
                throw new Error('Библиотека для создания PDF не загружена');
            }

            // 2. Инициализируем новый PDF документ
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({
                orientation: 'portrait', // Книжная ориентация
                unit: 'mm',             // Единицы измерения - миллиметры
                format: 'a4'            // Формат A4
            });

            // 3. Устанавливаем белый фон для всего документа
            pdf.setFillColor(255, 255, 255);
            
            // 4. Обрабатываем каждую страницу
            for (const [index, page] of pages.entries()) {
                // Добавляем новую страницу, если это не первая
                if (index > 0) {
                    pdf.addPage();
                }
                
                // Заливаем страницу белым фоном
                pdf.rect(0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight(), 'F');
                
                try {
                    // 5. Конвертируем страницу в canvas
                    const canvas = await renderPageToCanvas(page);
                    
                    // 6. Получаем данные изображения (сначала пробуем JPEG, потом PNG)
                    const imgData = await canvasToDataUrl(canvas);
                    
                    // 7. Рассчитываем размеры для вставки в PDF
                    const imgWidth = canvas.width;
                    const imgHeight = canvas.height;
                    const pdfPageWidth = pdf.internal.pageSize.getWidth() - 20; // Отступы по 10мм с каждой стороны
                    const pdfPageHeight = pdf.internal.pageSize.getHeight() - 20;
                    
                    // Сохраняем пропорции
                    const ratio = Math.min(pdfPageWidth / imgWidth, pdfPageHeight / imgHeight);
                    const scaledWidth = imgWidth * ratio;
                    const scaledHeight = imgHeight * ratio;
                    
                    // Центрируем изображение на странице
                    const x = (pdf.internal.pageSize.getWidth() - scaledWidth) / 2;
                    const y = (pdf.internal.pageSize.getHeight() - scaledHeight) / 2;
                    
                    // 8. Добавляем изображение в PDF
                    pdf.addImage(imgData, 'JPEG', x, y, scaledWidth, scaledHeight);
                    
                } catch (pageError) {
                    console.error(`Ошибка при обработке страницы ${index + 1}:`, pageError);
                    // Добавляем сообщение об ошибке в PDF
                    pdf.setTextColor(255, 0, 0);
                    pdf.setFontSize(12);
                    pdf.text(`Ошибка на странице ${index + 1}`, 10, 20);
                }
            }

            // 9. Пытаемся сохранить PDF
            try {
                pdf.save(`${getDesignTitle()}.pdf`);
                showSuccessNotification('PDF успешно создан!');
            } catch (saveError) {
                console.error('Ошибка сохранения PDF:', saveError);
                throw new Error('Не удалось сохранить PDF файл');
            }
            
        } catch (error) {
            console.error('Критическая ошибка при создании PDF:', error);
            
            // Показываем пользователю соответствующее сообщение
            showPdfError(error);
            
            // Предлагаем альтернативный вариант скачивания
            setTimeout(async () => {
                if (confirm('Не удалось создать PDF. Скачать в формате PNG?')) {
                    await downloadMultiplePages('png');
                }
            }, 500);
            
        } finally {
            // Всегда скрываем индикатор загрузки
            hidePdfLoadingIndicator(loadingIndicator);
        }
    }

// Вспомогательные функции:


    function showNotification(message) {
        if (!DOM.notification) return;
        
        DOM.notification.textContent = message;
        DOM.notification.style.display = 'block';
        
        setTimeout(() => {
            DOM.notification.style.display = 'none';
        }, 3000);
    }

/**
 * Преобразует canvas в data URL (сначала пробует JPEG, затем PNG)
 */
    function canvasToDataUrl(canvas) {
        return new Promise((resolve, reject) => {
            try {
                // Пробуем JPEG с качеством 85%
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            } catch (jpegError) {
                console.warn('JPEG не поддерживается, пробуем PNG:', jpegError);
                try {
                    // Пробуем PNG как запасной вариант
                    resolve(canvas.toDataURL('image/png'));
                } catch (pngError) {
                    reject(new Error('Не удалось преобразовать страницу в изображение'));
                }
            }
        });
    }

/**
 * Показывает индикатор загрузки PDF
 */
    function showPdfLoadingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'pdf-loading-indicator';
        indicator.innerHTML = 'Идет создание PDF...';
        document.body.appendChild(indicator);
        return indicator;
    }

/**
 * Скрывает индикатор загрузки PDF
 */
    function hidePdfLoadingIndicator(indicator) {
        if (indicator && indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
    }

/**
 * Показывает ошибку создания PDF
 */
    function showPdfError(error) {
        let message = 'Не удалось создать PDF файл. Пожалуйста, попробуйте снова.';
        
        if (error.message.includes('Библиотека')) {
            message = 'Ошибка загрузки библиотеки PDF. Обновите страницу.';
        } else if (error.message.includes('сохранить')) {
            message = 'Ошибка сохранения файла. Проверьте права доступа.';
        }
        
        alert(message);
    }

/**
 * Получает название дизайна для имени файла
 */
    function getDesignTitle() {
        return DOM.designTitle.value || 'Мой_дизайн';
    }

    async function addImageToPdf(element, pdf) {
        const img = element.querySelector('img');
        if (!img) return;
        
        const x = parseInt(element.style.left) * 0.264583 || 0;
        const y = parseInt(element.style.top) * 0.264583 || 0;
        const width = parseInt(element.style.width) * 0.264583 || img.naturalWidth * 0.264583;
        const height = parseInt(element.style.height) * 0.264583 || img.naturalHeight * 0.264583;
        
        try {
            const imgData = await loadImageData(img);
            pdf.addImage(imgData, 'JPEG', x, y, width, height);
        } catch (error) {
            console.error('Error adding image to PDF:', error);
            pdf.setFillColor(220, 220, 220);
            pdf.rect(x, y, width, height, 'F');
            pdf.setDrawColor(153, 153, 153);
            pdf.rect(x, y, width, height, 'D');
            pdf.setTextColor(102, 102, 102);
            pdf.setFontSize(10);
            pdf.text('Image not available', x + 5, y + 10);
        }
    }

    async function addTextToPdf(element, pdf) {
        const textarea = element.querySelector('textarea');
        if (!textarea) return;
        
        const x = parseInt(element.style.left) * 0.264583 || 0;
        const y = parseInt(element.style.top) * 0.264583 || 0;
        
        const style = window.getComputedStyle(textarea);
        const fontSize = parseInt(style.fontSize) * 0.264583;
        
        pdf.setFont(style.fontFamily.includes(' ') ? 'helvetica' : style.fontFamily);
        pdf.setFontSize(fontSize);
        
        // Установка цвета текста
        const color = style.color;
        const rgb = color.match(/\d+/g);
        if (rgb && rgb.length === 3) {
            pdf.setTextColor(parseInt(rgb[0]), parseInt(rgb[1]), parseInt(rgb[2]));
        } else {
            pdf.setTextColor(0, 0, 0); // Черный по умолчанию
        }
        
        // Разбиваем текст на строки
        const lines = textarea.value.split('\n');
        let currentY = y;
        const lineHeight = fontSize * 1.2;
        
        for (const line of lines) {
            if (line.trim() === '') {
                currentY += lineHeight;
                continue;
            }
            
            pdf.text(line, x, currentY);
            currentY += lineHeight;
        }
    }

    function loadImageData(img) {
        return new Promise((resolve, reject) => {
            // Для изображений из того же источника
            if (!img.crossOrigin) {
                try {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    ctx.drawImage(img, 0, 0);
                    resolve(canvas.toDataURL('image/jpeg'));
                } catch (error) {
                    reject(error);
                }
                return;
            }
            
            // Для изображений с других источников (CORS)
            const xhr = new XMLHttpRequest();
            xhr.open('GET', img.src, true);
            xhr.responseType = 'blob';
            xhr.onload = function() {
                if (this.status === 200) {
                    const blob = this.response;
                    const reader = new FileReader();
                    reader.onload = function() {
                        resolve(reader.result);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                } else {
                    reject(new Error('Failed to load image'));
                }
            };
            xhr.onerror = reject;
            xhr.send();
        });
    }

    function downloadCanvas(canvas, filename, type) {
        const link = document.createElement('a');
        link.download = filename;
        
        // Для PNG сохраняем прозрачность
        if (type === 'image/png') {
            link.href = canvas.toDataURL('image/png');
        } 
        // Для JPG добавляем белый фон
        else {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Заливаем белым фоном
            tempCtx.fillStyle = '#ffffff';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // Копируем оригинальное изображение
            tempCtx.drawImage(canvas, 0, 0);
            
            link.href = tempCanvas.toDataURL('image/jpeg', 0.9);
        }
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
}

    function canvasToBlob(canvas, type) {
        return new Promise(resolve => {
            canvas.toBlob(resolve, type, 0.9);
        });
    }


// языки
    function setupLanguageSwitcher() {
        if (!elements.languageBtn || !elements.dropdownContent) return;
        
        // Функция для обновления активного языка в дропдауне
        const updateActiveLanguage = () => {
            const currentLang = i18n.currentLanguage;
            document.querySelectorAll('.language-option').forEach(option => {
                option.classList.toggle('active', option.dataset.lang === currentLang);
            });
            
            // Обновляем текст кнопки
            elements.languageBtn.textContent = currentLang === 'en' ? 'English' : 'Русский';
        };
        
        elements.languageBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.dropdownContent.style.display = 
                elements.dropdownContent.style.display === 'block' ? 'none' : 'block';
        });
        
        document.querySelectorAll('.language-option').forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                const lang = e.target.dataset.lang;
                if (lang && i18n.setLanguage(lang)) {
                    elements.dropdownContent.style.display = 'none';
                    updateActiveLanguage();
                }
            });
        });
        
        document.addEventListener('click', () => {
            elements.dropdownContent.style.display = 'none';
        });
        
        // Инициализация при загрузке
        updateActiveLanguage();
    }

    function changeLanguage(lang) {
        state.currentLanguage = lang;
        localStorage.setItem('language', lang);
        
        // Обновляем активный элемент в дропдауне
        document.querySelectorAll('.language-option').forEach(option => {
            option.classList.toggle('active', option.dataset.lang === lang);
        });
        
        // Применяем переводы ко всем элементам
        applyTranslations(lang);
        
        // Обновляем текст кнопки языка ПОСЛЕ применения переводов
        const languageBtn = document.querySelector('.language-btn');
        if (languageBtn) {
            languageBtn.textContent = lang === 'en' ? 'English' : 'Русский';
        }
    }

    function handleBeforeUnload(e) {
        if (state.hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            return e.returnValue;
        }
    
    }

    function setupTextElementListeners(textElement) {
        const textContent = textElement.querySelector('.text-content');
        
        textContent.addEventListener('focus', function() {
            this.oldValue = this.value; // Сохраняем старое значение
        });
        
        textContent.addEventListener('blur', function() {
            if (this.oldValue !== this.value) {
                addToHistory('edit-text', {
                    element: textElement,
                    oldContent: this.oldValue,
                    pageId: state.currentPage
                });
                state.hasUnsavedChanges = true;
            }
        });
    }

// Функция для сохранения загруженных изображений в localStorage
    function saveUploadedImagesToStorage() {
        const imagesToSave = state.uploadedImages.map(img => ({
            id: img.id,
            name: img.name,
            src: img.src,
            width: img.width,
            height: img.height
        }));
        localStorage.setItem('uploadedImages', JSON.stringify(imagesToSave));
    }

// Функция для загрузки изображений из localStorage
    function loadUploadedImagesFromStorage() {
        const savedImages = localStorage.getItem('uploadedImages');
        if (savedImages) {
            const images = JSON.parse(savedImages);
            images.forEach(imgData => {
                // Проверяем, есть ли уже такое изображение в state
                const exists = state.uploadedImages.some(img => img.id === imgData.id);
                if (!exists) {
                    const img = new Image();
                    img.onload = () => {
                        const imageData = {
                            id: imgData.id,
                            name: imgData.name,
                            src: imgData.src,
                            width: img.width,
                            height: img.height,
                            element: null
                        };
                        state.uploadedImages.push(imageData);
                        renderUploadedImage(imageData);
                    };
                    img.src = imgData.src;
                }
            });
        }
    }

    async function generateThumbnail(page) {
    try {
        const canvas = await renderPageToCanvas(page);
        return canvas.toDataURL('image/jpeg', 0.7);
    } catch (error) {
        console.error('Не удалось сгенерировать миниатюру:', error);
        return null;
    }
    }

    // Инициализация редактора
    init();
});