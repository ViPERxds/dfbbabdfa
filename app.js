class TelegramWebApp {
    constructor() {
        this.tg = window.Telegram.WebApp;
        this.API_URL = 'https://domo-dev.profintel.ru/tg-bot';
        this.API_TOKEN = 'SecretToken';
        this.initApp();
    }

    async initApp() {
        try {
            this.tg.ready();
            this.tg.expand();
            this.showAuthScreen();
        } catch (error) {
            console.error('Init error:', error);
            this.showError('Ошибка инициализации');
        }
    }

    showAuthScreen() {
        const mainScreen = document.getElementById('mainScreen');
        mainScreen.innerHTML = `
            <div class="welcome-container fade-in">
                <div class="welcome-header">
                    <h1>👋 Добро пожаловать!</h1>
                    <p class="welcome-subtitle">в систему управления домофоном</p>
                </div>
                
                <div class="features-block slide-up">
                    <h2>🔐 Возможности приложения:</h2>
                    <ul class="features-list">
                        <li>📸 Просматривать снимки с камер</li>
                        <li>🚪 Открывать двери</li>
                        <li>🔔 Получать уведомления о звонках</li>
                    </ul>
                </div>

                <div class="auth-form slide-up">
                    <div class="input-group">
                        <label>📱 Введите номер телефона:</label>
                        <input type="tel" 
                            id="phoneInput" 
                            class="phone-input" 
                            value="+"
                            placeholder="+7 (___) ___-__-__"
                        >
                        <div class="input-line"></div>
                    </div>
                    <button class="auth-button pulse" onclick="app.handleAuth()">
                        Продолжить
                        <span class="button-arrow">→</span>
                    </button>
                </div>
            </div>
        `;

        const phoneInput = document.getElementById('phoneInput');
        
        // Обработка ввода номера телефона
        phoneInput.addEventListener('input', (e) => {
            let value = e.target.value;
            
            // Всегда оставляем + в начале
            if (!value.startsWith('+')) {
                value = '+' + value;
            }
            
            // Убираем все нецифровые символы, кроме +
            let digits = value.substring(1).replace(/\D/g, '');
            
            // Ограничиваем длину до 11 цифр
            if (digits.length > 11) {
                digits = digits.substring(0, 11);
            }
            
            // Форматируем номер
            e.target.value = this.formatPhoneInput(digits);
        });

        // Обработка фокуса
        phoneInput.addEventListener('focus', () => {
            phoneInput.parentElement.classList.add('focused');
            // Если поле пустое, добавляем +
            if (!phoneInput.value) {
                phoneInput.value = '+';
            }
        });

        phoneInput.addEventListener('blur', () => {
            if (phoneInput.value === '+') {
                phoneInput.value = '';
            }
            phoneInput.parentElement.classList.remove('focused');
        });
    }

    async handleAuth() {
        const phoneInput = document.getElementById('phoneInput');
        // Получаем только цифры из номера
        const digits = phoneInput.value.replace(/\D/g, '');
        
        // Проверяем формат номера
        if (digits.length !== 11) {
            this.showError('Введите номер в формате +7 (XXX) XXX-XX-XX');
            return;
        }

        try {
            await this.checkAuth(digits);
        } catch (error) {
            this.showError('Ошибка авторизации');
        }
    }

    async checkAuth(phone) {
        try {
            const data = await this.apiRequest('/check-tenant', 'POST', { 
                phone: parseInt(phone) 
            });
            this.tenant_id = data.tenant_id;
            this.showMainMenu();
        } catch (error) {
            console.error('Auth error:', error);
            throw error;
        }
    }

    formatPhoneInput(digits) {
        if (!digits) return '+';
        
        let formatted = '+';
        if (digits.length > 0) formatted += digits.substring(0, 1);
        if (digits.length > 1) formatted += ' (' + digits.substring(1, 4);
        if (digits.length > 4) formatted += ') ' + digits.substring(4, 7);
        if (digits.length > 7) formatted += '-' + digits.substring(7, 9);
        if (digits.length > 9) formatted += '-' + digits.substring(9, 11);
        
        return formatted;
    }

    showMainMenu() {
        const mainScreen = document.getElementById('mainScreen');
        mainScreen.innerHTML = `
            <div class="menu-container fade-in">
                <h2 class="menu-title">🏠 Главное меню</h2>
                <div class="menu-grid">
                    <div class="menu-card slide-up" onclick="app.showApartments()">
                        <div class="card-icon">🏢</div>
                        <h3>Мои квартиры</h3>
                        <p>Информация о квартирах и жильцах</p>
                    </div>
                    <div class="menu-card slide-up" onclick="app.showDomofons()">
                        <div class="card-icon">🚪</div>
                        <h3>Домофоны</h3>
                        <p>Управление домофонами и камерами</p>
                    </div>
                </div>
            </div>
        `;
    }

    async showDomofons() {
        const mainScreen = document.getElementById('mainScreen');
        mainScreen.innerHTML = `
            <div class="domofons-container fade-in">
                <h2 class="section-title">🏠 Доступные домофоны</h2>
                <div class="loader"></div>
            </div>
        `;

        try {
            const domofons = await this.getDomofons();
            const container = mainScreen.querySelector('.domofons-container');
            let html = '<div class="domofons-grid">';
            
            domofons.forEach((domofon, index) => {
                html += `
                    <div class="domofon-card slide-up" style="animation-delay: ${index * 0.1}s">
                        <div class="card-header">
                            <span class="card-title">📷 ${domofon.name}</span>
                        </div>
                        <div class="card-preview" id="preview_${domofon.id}">
                            <div class="preview-placeholder">
                                Нажмите "Снимок" для просмотра
                            </div>
                        </div>
                        <div class="card-actions">
                            <button class="action-button" onclick="app.getSnapshot(${domofon.id})">
                                📸 Снимок
                            </button>
                            ${!domofon.name.toLowerCase().includes('консьерж') ? `
                                <button class="action-button success" onclick="app.openDoor(${domofon.id})">
                                    🔓 Открыть
                                </button>
                            ` : ''}
                        </div>
                    </div>
                `;
            });

            html += '</div>';
            container.innerHTML = html;
        } catch (error) {
            this.showError('Ошибка загрузки домофонов');
        }
    }

    async showApartments() {
        const mainScreen = document.getElementById('mainScreen');
        mainScreen.innerHTML = '<div class="loader"></div>';

        try {
            const apartments = await this.getApartments();
            let html = '<div class="apartments-list">';
            
            apartments.forEach(apartment => {
                const location = apartment.location || {};
                html += `
                    <div class="apartment-item">
                        <div class="apartment-header">
                            Квартира ${location.apartments_number || ''}
                        </div>
                        <div class="apartment-address">
                            ${location.readable_address || ''}
                        </div>
                    </div>
                `;
            });

            html += '</div>';
            mainScreen.innerHTML = html;
        } catch (error) {
            this.showError('Ошибка загрузки квартир');
        }
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = message;
        document.getElementById('mainScreen').appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 3000);
    }

    // Добавляем общий метод для API запросов
    async apiRequest(endpoint, method = 'GET', body = null) {
        const config = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.API_TOKEN
            },
            mode: 'no-cors' // Добавляем этот параметр для обхода CORS
        };

        if (body) {
            config.body = JSON.stringify(body);
        }

        try {
            const response = await fetch(`${this.API_URL}${endpoint}`, config);
            if (!response.ok) throw new Error('API request failed');
            return await response.json();
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    }

    // Обновляем остальные методы API
    async getDomofons() {
        return await this.apiRequest(`/domo.apartment?tenant_id=${this.tenant_id}`);
    }

    async getSnapshot(domofonId) {
        return await this.apiRequest('/domo.domofon/urlsOnType', 'POST', {
            intercoms_id: [domofonId],
            media_type: ["JPEG"],
            tenant_id: this.tenant_id
        });
    }

    async openDoor(domofonId) {
        return await this.apiRequest(`/domo.domofon/${domofonId}/open`, 'POST', {
            door_id: 0,
            tenant_id: this.tenant_id
        });
    }

    async getApartments() {
        return await this.apiRequest(`/domo.apartment?tenant_id=${this.tenant_id}`);
    }
}