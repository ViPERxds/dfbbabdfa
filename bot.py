from telegram import Update, ReplyKeyboardMarkup, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.ext import Application, CommandHandler, MessageHandler, CallbackQueryHandler
from telegram.ext import ContextTypes, filters
import httpx
import logging
import json
import os
from dotenv import load_dotenv
from app.core.config import settings
from fastapi import HTTPException
from datetime import datetime

# Загружаем переменные окружения
load_dotenv()

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Конфигурация
API_URL = settings.API_URL
TELEGRAM_TOKEN = settings.TELEGRAM_TOKEN

# Нужно добавить обработку ошибок при отсутствии TELEGRAM_TOKEN
if not TELEGRAM_TOKEN:
    raise ValueError("Не задан TELEGRAM_TOKEN в .env файле")

class DomophoneBot:
    def __init__(self):
        if not TELEGRAM_TOKEN:
            raise ValueError("Не задан TELEGRAM_TOKEN")
        self.app = Application.builder().token(TELEGRAM_TOKEN).build()
        self.setup_handlers()
        
    def setup_handlers(self):
        """Настройка обработчиков команд"""
        self.app.add_handler(CommandHandler("start", self.start_command))
        self.app.add_handler(CommandHandler("help", self.help_command))
        self.app.add_handler(CommandHandler("domofons", self.show_domofons))
        self.app.add_handler(CommandHandler("apartments", self.show_apartments))
        self.app.add_handler(MessageHandler(filters.CONTACT, self.handle_contact))
        self.app.add_handler(MessageHandler(
            filters.TEXT & ~filters.COMMAND,
            self.handle_menu_buttons
        ))
        self.app.add_handler(CallbackQueryHandler(self.handle_callback))
        
    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработка команды /start"""
        user_id = update.effective_user.id
        logger.info(f"Пользователь начал общение с ботом. Chat ID: {user_id}")
        
        if 'tenant_id' not in context.user_data:
            keyboard = [[{"text": "Отправить номер телефона", "request_contact": True}]]
            reply_markup = ReplyKeyboardMarkup(keyboard, one_time_keyboard=True)
            await update.message.reply_text(
                "👋 Добро пожаловать в систему управления домофоном!\n\n"
                "🔐 С помощью этого бота вы сможете:\n"
                "• Просматривать снимки с камер\n"
                "• Открывать двери\n"
                "• Получать уведомления о звонках\n\n"
                "📱 Для начала работы, пожалуйста, поделитесь номером телефона.",
                reply_markup=reply_markup
            )
        else:
            await self.show_main_menu(update, context)

    async def help_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Отображение справки по командам"""
        help_text = """
🤖 *Команды бота:*

/start - Начать работу с ботом
/help - Показать эту справку
/domofons - Показать список доступных домофонов
/apartments - Показать список квартир

*Возможности:*
• 📱 Авторизация по номеру телефона
• 📋 Просмотр списка доступных домофонов
• 📷 Получение снимков с камер
• 🚪 Открытие дверей
• 🔔 Уведомления о входящих выовах

*Как пользоваться:*
1. Отправьте свой номер телфона для авторизации
2. Используйте команду /domofons для просмотра списка
3. Нажимайте на кнопки для получения снимкв и открытия дверей
        """
        await update.message.reply_text(
            help_text,
            parse_mode='Markdown'
        )

    async def handle_contact(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработка полученного контакта"""
        try:
            phone = update.message.contact.phone_number
            
            # Преобразуем телефон в формат 7XXXXXXXXXX
            phone = phone.replace('+', '').replace('-', '').replace(' ', '')
            if phone.startswith('8'):
                phone = '7' + phone[1:]
            
            logger.info(f"Получен номер телефона: {phone}")
            
            # Валидация номера телефона
            if not phone.isdigit() or len(phone) != 11:
                await update.message.reply_text("❌ Неверный формат номера телефона")
                return
            
            async with httpx.AsyncClient(timeout=10.0) as client:
                headers = {
                    "x-api-key": settings.API_TOKEN,
                    "Content-Type": "application/json"
                }
                
                url = f"{settings.API_URL}/check-tenant"
                payload = {"phone": int(phone)}  # Преобразуем в int согласно API
                
                logger.info(f"Отправляем запрос: URL={url}, payload={payload}")
                
                response = await client.post(
                    url,
                    headers=headers,
                    json=payload
                )
                
                logger.info(f"Статус ответа: {response.status_code}")
                logger.info(f"Тело ответа: {response.text}")
                
                if response.status_code == 200:
                    data = response.json()
                    tenant_id = data.get('tenant_id')
                    if tenant_id is not None:
                        context.user_data['tenant_id'] = tenant_id
                        await self.show_main_menu(update, context)
                    else:
                        await update.message.reply_text(
                            "❌ Не удалось получить ID пользователя"
                        )
                elif response.status_code == 422:
                    error_data = response.json()
                    error_msg = error_data.get('detail', [{'msg': 'Неизвестная ошибка'}])[0].get('msg')
                    await update.message.reply_text(f"❌ Ошибка валидации: {error_msg}")
                else:
                    raise HTTPException(status_code=response.status_code, detail=response.text)

        except Exception as e:
            logger.error(f"Ошибка при обработке контакта: {str(e)}")
            await update.message.reply_text(
                "❌ Ошибка авторизации. Попробуйте позже или обратитесь в поддержку."
            )

    async def show_apartments(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Показ списка квартир"""
        if 'tenant_id' not in context.user_data:
            await update.message.reply_text(
                "Вы не авторизованы. Используйте /start для авторизации."
            )
            return
        
        try:
            headers = {
                "x-api-key": settings.API_TOKEN,
                "Content-Type": "application/json",
                "accept": "application/json"
            }
            
            tenant_id = context.user_data['tenant_id']
            apartments_url = f"{settings.API_URL}/domo.apartment"
            
            async with httpx.AsyncClient() as client:
                logger.info(f"Запрос квартир для tenant_id={tenant_id}")
                apartments_response = await client.get(
                    apartments_url,
                    headers=headers,
                    params={"tenant_id": tenant_id}
                )
                
                logger.info(f"Статус ответа: {apartments_response.status_code}")
                logger.info(f"Тело ответа: {apartments_response.text}")
                
                if apartments_response.status_code == 200:
                    apartments = apartments_response.json()
                    if not apartments:
                        await update.message.reply_text("У вас нет доступных квартир")
                        return
                        
                    # Формируем сообщение со списком квартир
                    message_text = "🏘 *Информация о ваших квартирах*\n\n"
                    for idx, apartment in enumerate(apartments, 1):
                        location = apartment.get('location', {})
                        address = location.get('readable_address', 'Адрес не указан')
                        apartment_number = location.get('apartments_number', '')
                        paid_before = apartment.get('paid_before', '')
                        
                        message_text += f"*Квартира #{idx}*\n"
                        message_text += f"📍 Адрес: `{address}`\n"
                        if apartment_number:
                            message_text += f"🚪 Номер квартиры: `{apartment_number}`\n"
                        if paid_before:
                            message_text += f"💳 Оплачено до: `{paid_before}`\n"
                        
                        # Добавляем информацию о жильцах
                        tenants = apartment.get('tenants', [])
                        if tenants:
                            message_text += "\n👥 *Жильцы:*\n"
                            
                            for tenant in tenants:
                                name = tenant.get('name', '').strip()
                                phone = tenant.get('phone', '')
                                status = tenant.get('status', {})
                                role = status.get('role', 0)
                                
                                # Форматируем номер телефона
                                if phone and len(phone) == 11:
                                    formatted_phone = f"+{phone[0]} ({phone[1:4]}) {phone[4:7]}-{phone[7:9]}-{phone[9:]}"
                                else:
                                    formatted_phone = phone
                                    
                                # Добавляем роль жильца
                                role_text = "👑 Владелец" if role == 1 else "👤 Жилец"
                                
                                message_text += f"• {name} ({role_text})\n"
                                message_text += f"  📱 `{formatted_phone}`\n"
                        
                        message_text += "\n" + "─" * 30 + "\n\n"
                    
                    # Добавляем информацию о командах
                    message_text += (
                        "*Доступные команды:*\n"
                        "📱 /domofons - Управление домофонами\n"
                        "ℹ️ /help - Справка по командам\n"
                    )
                    
                    # Отправляем информацию о квартирах
                    await update.message.reply_text(
                        message_text,
                        parse_mode='Markdown',
                        disable_web_page_preview=True
                    )
                        
                elif apartments_response.status_code == 422:
                    error_data = apartments_response.json()
                    error_msg = error_data.get('detail', [{'msg': 'Неизвестная ошибка'}])[0].get('msg')
                    await update.message.reply_text(f"❌ Ошибка валидации: {error_msg}")
                else:
                    raise HTTPException(
                        status_code=apartments_response.status_code,
                        detail=apartments_response.text
                    )
                    
        except Exception as e:
            logger.error(f"Ошибка получения списка квартир: {str(e)}")
            await update.message.reply_text(
                "❌ Ошибка получения списка. Попробуйте позже или обратитесь в поддержку."
            )

    async def show_domofons(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Показ списка доступных домофонов"""
        if 'tenant_id' not in context.user_data:
            await update.message.reply_text(
                "❌ Вы не авторизованы. Используйте /start для авторизации."
            )
            return
        
        try:
            headers = {
                "x-api-key": settings.API_TOKEN,
                "Content-Type": "application/json"
            }
            
            tenant_id = context.user_data['tenant_id']
            apartments_url = f"{settings.API_URL}/domo.apartment"
            
            async with httpx.AsyncClient() as client:
                apartments_response = await client.get(
                    apartments_url,
                    headers=headers,
                    params={"tenant_id": tenant_id}
                )
                
                if apartments_response.status_code != 200:
                    raise HTTPException(
                        status_code=apartments_response.status_code,
                        detail=apartments_response.text
                    )
                
                apartments = apartments_response.json()
                if not apartments:
                    await update.message.reply_text("❌ У вас нет доступных квартир")
                    return
                    
                keyboard = []
                
                for apartment in apartments:
                    apartment_id = apartment.get('id')
                    if apartment_id:
                        domofons_url = f"{settings.API_URL}/domo.apartment/{apartment_id}/domofon"
                        domofons_response = await client.get(
                            domofons_url,
                            headers=headers,
                            params={"tenant_id": tenant_id}
                        )
                        
                        if domofons_response.status_code == 200:
                            domofons = domofons_response.json()
                            for domofon in domofons:
                                domofon_id = domofon.get('id')
                                name = domofon.get('name', '')
                                
                                # Проверяем, является ли домофон консьержем
                                if "консьерж" in name.lower():
                                    keyboard.append([
                                        InlineKeyboardButton(
                                            f"📷 Камера {name}",
                                            callback_data=f"snapshot_{domofon_id}"
                                        )
                                    ])
                                else:
                                    keyboard.append([
                                        InlineKeyboardButton(
                                            f"📷 Камера {name}",
                                            callback_data=f"snapshot_{domofon_id}"
                                        ),
                                        InlineKeyboardButton(
                                            f"🔓 Открыть",
                                            callback_data=f"open_{domofon_id}"
                                        )
                                    ])
                
                if keyboard:
                    reply_markup = InlineKeyboardMarkup(keyboard)
                    await update.message.reply_text(
                        "🏠 Доступные домофоны:",
                        reply_markup=reply_markup,
                        parse_mode='Markdown'
                    )
                else:
                    await update.message.reply_text(
                        "❌ Не найдено доступных домофонов для ваших квартир"
                    )
                    
        except Exception as e:
            logger.error(f"Ошибка получения списка домофонов: {str(e)}")
            await update.message.reply_text(
                "❌ Ошибка получения списка. Попробуйте позже или обратитесь в поддержку."
            )

    async def handle_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработка нажатий на кнопки"""
        try:
            query = update.callback_query
            data_parts = query.data.split('_')
            action = data_parts[0]
            domofon_id = int(data_parts[1])
            
            tenant_id = context.user_data.get('tenant_id')
            if not tenant_id:
                await query.message.reply_text("❌ Ошибка: пользователь не авторизован")
                await query.answer()
                return

            if action == "snapshot":
                # Получение снимка  камеры
                url = f"{settings.API_URL}/domo.domofon/urlsOnType"
                
                headers = {
                    "X-API-KEY": settings.API_TOKEN,
                    "Content-Type": "application/json",
                    "accept": "application/json"
                }
                
                payload = {
                    "intercoms_id": [domofon_id],
                    "media_type": ["JPEG"]
                }
                params = {"tenant_id": tenant_id}
                
                async with httpx.AsyncClient() as client:
                    try:
                        response = await client.post(
                            url,
                            headers=headers,
                            json=payload,
                            params=params
                        )
                        
                        logger.info(f"Ответ сервера: {response.status_code} - {response.text}")
                        
                        if response.status_code == 200:
                            data = response.json()
                            if data and len(data) > 0:
                                jpeg_url = data[0].get('jpeg')
                                if jpeg_url:
                                    await query.message.reply_photo(
                                        photo=jpeg_url,
                                        caption="📷 Снимок с камеры"
                                    )
                                else:
                                    await query.message.reply_text("❌ Ссылка на снимок отсутствует")
                            else:
                                await query.message.reply_text("❌ Нет данных от камеры")
                        else:
                            await query.message.reply_text(f"❌ Ошибка получения снимка: {response.text}")
                            
                    except httpx.RequestError as e:
                        logger.error(f"Ошибка запроса: {str(e)}")
                        await query.message.reply_text("❌ Ошибка соединения с сервером")
                    
            elif action == "open":
                url = f"{settings.API_URL}/domo.domofon/{domofon_id}/open"
                
                headers = {
                    "X-API-KEY": settings.API_TOKEN,
                    "Content-Type": "application/json",
                    "accept": "application/json"
                }
                
                payload = {"door_id": 0}
                params = {"tenant_id": tenant_id}
                
                async with httpx.AsyncClient() as client:
                    try:
                        response = await client.post(
                            url,
                            headers=headers,
                            json=payload,
                            params=params
                        )
                        
                        logger.info(f"Ответ сервера: {response.status_code} - {response.text}")
                        
                        if response.status_code == 200:
                            success_message = (
                                "✅ *Дверь успешно открыта*\n\n"
                                "🕐 Время: {}\n"
                                "🚪 Домофон: #{}\n"
                                "📍 Статус: Успешно\n\n"
                                "_Дверь будет открыта в течение нескольких секунд_"
                            ).format(
                                datetime.now().strftime("%H:%M:%S"),
                                domofon_id
                            )
                            await query.message.reply_text(
                                success_message,
                                parse_mode='Markdown'
                            )
                        elif response.status_code == 422:
                            error_data = response.json()
                            error_msg = error_data.get('detail', ['Ошибка валидации'])[0].get('msg', 'Неизвестная ошибка')
                            await query.message.reply_text(f"❌ Ошибка: {error_msg}")
                        else:
                            await query.message.reply_text(f"❌ Ошибка сервера: {response.text}")
                            
                    except httpx.RequestError as e:
                        logger.error(f"Ошибка запроса: {str(e)}")
                        await query.message.reply_text("❌ Ошибка соединения с сервером")
        
            await query.answer()
                    
        except Exception as e:
            logger.error(f"Ошибка при обработке callback: {str(e)}", exc_info=True)
            await query.message.reply_text("❌ Произошла ошибка")
            await query.answer()

    async def check_api(self):
        """Проверка доступности API"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{API_URL}/")
                response.raise_for_status()
        except Exception as e:
            logger.error(f"API недоступен: {str(e)}")
            raise

    async def show_main_menu(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Показ главного меню с кнопками"""
        keyboard = [
            ["🏠 Посмотреть квартиры"],
            ["🚪 Посмотреть домофоны"]
        ]
        reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True)
        await update.message.reply_text(
            "Выберите действие:",
            reply_markup=reply_markup
        )

    async def handle_menu_buttons(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Обработка нажатий на кнопки меню"""
        text = update.message.text
        
        if text == "🏠 Посмотреть квартиры":
            await self.show_apartments(update, context)
        elif text == "🚪 Посмотреть домофоны":
            await self.show_domofons(update, context)

    def run(self):
        """Запуск бота"""
        self.app.run_polling()

if __name__ == '__main__':
    bot = DomophoneBot()
    bot.run() 