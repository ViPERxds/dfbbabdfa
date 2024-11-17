// Основная логика приложения
class TelegramWebApp {
    constructor() {
        this.tg = window.Telegram.WebApp;
        this.API_URL = 'https://domo-dev.profintel.ru/tg-bot';
        this.API_TOKEN = 'SecretToken';
        this.currentScreen = 'main';
        
        // Инициализируем после создания объект��
        setTimeout(() => this.initApp(), 100);
    }

    async initApp() {
        try {
            console.log('Starting initialization...');
            
            // Проверяем, что Telegram.WebApp доступен
            if (!this.tg) {
                throw new Error('Telegram WebApp is not available');
            }

            this.tg.ready();
            this.setThemeClass();
            
            // Сразу показываем экран авторизации
            this.showPhoneAuthScreen();
            this.setupBackButton();

        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Ошибка инициализации приложения');
        }
    }

    showError(message) {
        // Скрываем экран загрузки
        document.getElementById('loadingScreen').classList.add('hidden');
        
        // Показываем ошибку
        const errorScreen = document.createElement('div');
        errorScreen.className = 'screen error-screen';
        errorScreen.innerHTML = `
            <div class="error-message">
                <p>⚠️ ${message}</p>
                <button onclick="location.reload()">Попробовать снова</button>
            </div>
        `;
        document.getElementById('app').appendChild(errorScreen);
    }

    showPhoneAuthScreen() {
        console.log('Showing phone auth screen');
        this.hideAllScreens();
        const authScreen = document.getElementById('authScreen');
        authScreen.classList.remove('hidden');
        
        // Очищаем содержимое
        authScreen.innerHTML = `
            <div class="welcome-screen">
                <h2>👋 Добро пожаловать в систему управления домофоном!</h2>
                
                <div class="features-block">
                    <p>🔐 С помощью этого приложения вы сможете:</p>
                    <ul>
                        <li>Просматривать снимки с камер</li>
                        <li>Открывать двери</li>
                        <li>Получать уведомления о звонках</li>
                    </ul>
                </div>
                
                <div class="auth-form">
                    <p>📱 Для начала работы введите номер телефона:</p>
                    <div class="input-group">
                        <input type="tel" 
                               id="phoneInput" 
                               placeholder="+7 (___) ___-__-__"
                               class="phone-input">
                    </div>
                    <button class="auth-button" onclick="app.handlePhoneAuth()">
                        Продолжить
                    </button>
                    <div id="authError" class="error-message hidden"></div>
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
                const formatted = this.formatPhoneInput(value);
                e.target.value = formatted;
            }
        });
    }

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

    async handlePhoneAuth() {
        const phoneInput = document.getElementById('phoneInput');
        const errorDiv = document.getElementById('authError');
        const phone = phoneInput.value.replace(/\D/g, '');

        if (phone.length !== 11) {
            errorDiv.textContent = '⚠️ Введите корректный номер телефона';
            errorDiv.classList.remove('hidden');
            return;
        }

        try {
            await this.checkAuth(phone);
        } catch (error) {
            errorDiv.textContent = '⚠️ Ошибка авторизации';
            errorDiv.classList.remove('hidden');
        }
    }

    setupBackButton() {
        this.tg.BackButton.onClick(() => {
            if (this.currentScreen === 'domofon-control') {
                this.showDomofonsScreen();
            } else if (this.currentScreen === 'domofons') {
                this.showMainScreen();
            }
        });
    }

    async checkAuth(phone) {
        try {
            console.log('Checking auth for phone:', phone);
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
                this.showMainScreen();
            } else {
                throw new Error('Auth failed');
            }
        } catch (error) {
            console.error('Auth error:', error);
            this.showError('Ошибка авторизации');
        }
    }

    async showMainScreen() {
        this.currentScreen = 'main';
        this.tg.BackButton.hide();
        this.hideAllScreens();
        const mainScreen = document.getElementById('mainScreen');
        mainScreen.classList.remove('hidden');
        
        mainScreen.innerHTML = `
            <div class="container">
                <div class="header">
                    <h1>Система управления домофоном</h1>
                </div>
                <div class="menu-grid">
                    <div class="menu-card" onclick="app.showApartmentsScreen()">
                        <div class="menu-icon">🏠</div>
                        <h3>Мои квартиры</h3>
                        <p>Информация о квартирах и жильцах</p>
                    </div>
                    <div class="menu-card" onclick="app.showDomofonsScreen()">
                        <div class="menu-icon">🚪</div>
                        <h3>Домофоны</h3>
                        <p>Управление домофонами и камерами</p>
                    </div>
                </div>
            </div>
        `;
    }

    async showDomofonsScreen() {
        this.currentScreen = 'domofons';
        this.tg.BackButton.show();
        this.hideAllScreens();
        const domofonsScreen = document.getElementById('domofonsScreen');
        domofonsScreen.classList.remove('hidden');

        domofonsScreen.innerHTML = `
            <div class="container">
                <div class="header">
                    <h2>Управление домофонами</h2>
                </div>
                <div class="domofons-grid" id="domofonsList">
                    <div class="loader"></div>
                </div>
            </div>
        `;

        const domofons = await this.getDomofons();
        const domofonsList = document.getElementById('domofonsList');
        domofonsList.innerHTML = '';

        domofons.forEach(domofon => {
            const card = document.createElement('div');
            card.className = 'domofon-card';
            card.innerHTML = `
                <div class="card-header">
                    <h3>📷 ${domofon.name}</h3>
                </div>
                <div class="card-content">
                    <div class="preview-container" id="preview_${domofon.id}">
                        <div class="preview-placeholder">
                            Нажмите "Снимок" для просмотра
                        </div>
                    </div>
                    <div class="card-actions">
                        <button class="button" onclick="app.handleSnapshot(${domofon.id})">
                            📷 Снимок
                        </button>
                        ${!domofon.name.toLowerCase().includes('консьерж') ? `
                            <button class="button success" onclick="app.handleDoorOpen(${domofon.id})">
                                🔓 Открыть дверь
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
            domofonsList.appendChild(card);
        });
    }

    async showApartmentsScreen() {
        this.currentScreen = 'apartments';
        this.tg.BackButton.show();
        this.hideAllScreens();
        const apartmentsScreen = document.getElementById('apartmentsScreen');
        apartmentsScreen.classList.remove('hidden');

        const apartments = await this.getApartments();
        const apartmentsList = document.createElement('div');
        apartmentsList.className = 'apartments-list';

        apartments.forEach(apartment => {
            const apartmentCard = document.createElement('div');
            apartmentCard.className = 'apartment-card';
            const location = apartment.location || {};
            
            apartmentCard.innerHTML = `
                <h3>Квартира #${apartment.id}</h3>
                <p>📍 Адрес: ${location.readable_address || 'Не указан'}</p>
                <p>🚪 Номер квартиры: ${location.apartments_number || 'Не указан'}</p>
                ${apartment.tenants ? `
                    <div class="tenants-list">
                        <h4>👥 Жильцы:</h4>
                        ${apartment.tenants.map(tenant => `
                            <div class="tenant">
                                <p>${tenant.name} (${tenant.status?.role === 1 ? '👑 Владелец' : '👤 Жилец'})</p>
                                <p>📱 ${this.formatPhone(tenant.phone)}</p>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            `;
            apartmentsList.appendChild(apartmentCard);
        });

        apartmentsScreen.innerHTML = '';
        apartmentsScreen.appendChild(apartmentsList);
    }

    formatPhone(phone) {
        if (!phone || phone.length !== 11) return phone;
        return `+${phone[0]} (${phone.slice(1,4)}) ${phone.slice(4,7)}-${phone.slice(7,9)}-${phone.slice(9)}`;
    }

    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
    }

    async getDomofons() {
        try {
            const response = await fetch(`${this.API_URL}/domo.apartment?tenant_id=${this.tenant_id}`, {
                headers: {
                    'x-api-key': this.API_TOKEN
                }
            });
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения списка домофонов:', error);
            return [];
        }
    }

    async openDoor(domofonId) {
        try {
            const response = await fetch(`${this.API_URL}/domo.domofon/${domofonId}/open`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.API_TOKEN
                },
                body: JSON.stringify({
                    door_id: 0,
                    tenant_id: this.tenant_id
                })
            });
            return response.ok;
        } catch (error) {
            console.error('Ошибка открытия двери:', error);
            return false;
        }
    }

    async getSnapshot(domofonId) {
        try {
            const response = await fetch(`${this.API_URL}/domo.domofon/urlsOnType`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.API_TOKEN
                },
                body: JSON.stringify({
                    intercoms_id: [domofonId],
                    media_type: ["JPEG"],
                    tenant_id: this.tenant_id
                })
            });
            const data = await response.json();
            return data[0]?.jpeg;
        } catch (error) {
            console.error('Ошибка получения снимка:', error);
            return null;
        }
    }

    setThemeClass() {
        // Применяем тему Telegram
        document.documentElement.className = this.tg.colorScheme;
    }

    // Метод для отправки данных в бот
    sendDataToBot(data) {
        this.tg.sendData(JSON.stringify(data));
    }

    async handleSnapshot(domofonId) {
        const previewContainer = document.getElementById(`preview_${domofonId}`);
        previewContainer.innerHTML = '<div class="loader"></div>';
        
        try {
            const snapshotUrl = await this.getSnapshot(domofonId);
            if (snapshotUrl) {
                previewContainer.innerHTML = `
                    <img src="${snapshotUrl}" alt="Снимок с камеры" class="snapshot-image">
                    <div class="snapshot-timestamp">
                        ${new Date().toLocaleTimeString()}
                    </div>
                `;
            } else {
                throw new Error('Не удалось получить снимок');
            }
        } catch (error) {
            previewContainer.innerHTML = `
                <div class="error-message">
                    Ошибка получения снимка
                </div>
            `;
        }
    }

    async handleDoorOpen(domofonId) {
        const card = document.querySelector(`#preview_${domofonId}`).closest('.domofon-card');
        const statusElement = document.createElement('div');
        statusElement.className = 'door-status';
        
        try {
            const success = await this.openDoor(domofonId);
            if (success) {
                statusElement.innerHTML = `
                    <div class="success-message">
                        ✅ Дверь успешно открыта
                        <div class="status-details">
                            🕐 ${new Date().toLocaleTimeString()}
                        </div>
                    </div>
                `;
            } else {
                throw new Error('Не удалось открыть дверь');
            }
        } catch (error) {
            statusElement.innerHTML = `
                <div class="error-message">
                    ❌ Ошибка при открытии двери
                </div>
            `;
        }
        
        card.appendChild(statusElement);
        setTimeout(() => statusElement.remove(), 3000);
    }
}