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

        // Добавляем маску для номера телефона
        const phoneInput = document.getElementById('phoneInput');
        phoneInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 0) {
                if (value[0] !== '7') value = '7' + value;
                value = value.substring(0, 11);
                e.target.value = this.formatPhoneInput(value);
            }
        });

        // Добавляем фокус на поле ввода
        phoneInput.addEventListener('focus', () => {
            phoneInput.parentElement.classList.add('focused');
        });

        phoneInput.addEventListener('blur', () => {
            if (!phoneInput.value) {
                phoneInput.parentElement.classList.remove('focused');
            }
        });
    }

    async handleAuth() {
        const phone = document.getElementById('phoneInput').value.replace(/\D/g, '');
        if (phone.length !== 11) {
            this.showError('Введите корректный номер');
            return;
        }
        await this.checkAuth(phone);
    }

    async checkAuth(phone) {
        try {
            const response = await fetch(`${this.API_URL}/check-tenant`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.API_TOKEN
                },
                body: JSON.stringify({ phone: parseInt(phone) })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.tenant_id = data.tenant_id;
                this.showMainMenu();
            } else {
                throw new Error('Auth failed');
            }
        } catch (error) {
            this.showError('Ошибка авторизации');
        }
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

    // Вспомогательные методы
    formatPhoneInput(value) {
        if (!value) return '';
        const match = value.match(/^(\d{1})(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})$/);
        if (!match) return value;
        let formatted = '+' + match[1];
        if (match[2]) formatted += ` (${match[2]}`;
        if (match[3]) formatted += `) ${match[3]}`;
        if (match[4]) formatted += `-${match[4]}`;
        if (match[5]) formatted += `-${match[5]}`;
        return formatted;
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = message;
        document.getElementById('mainScreen').appendChild(errorDiv);
        setTimeout(() => errorDiv.remove(), 3000);
    }

    // API методы остаются без изменений
}