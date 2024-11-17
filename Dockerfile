FROM python:3.11-slim

WORKDIR /app

# Установка зависимостей
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копирование всего проекта
COPY . .

# Создаем пустые __init__.py файлы если их нет
RUN mkdir -p app/core && \
    touch app/__init__.py app/core/__init__.py

# Права на выполнение entrypoint.sh
RUN chmod +x entrypoint.sh

# Создание пользователя без прав root
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

ENTRYPOINT ["./entrypoint.sh"] 