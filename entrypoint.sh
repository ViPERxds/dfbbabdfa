#!/bin/bash

if [ "$SERVICE_TYPE" = "bot" ]; then
    echo "Starting Telegram bot..."
    python bot.py
elif [ "$SERVICE_TYPE" = "webhook" ]; then
    echo "Starting webhook server..."
    python webhook_server.py
else
    echo "Unknown service type: $SERVICE_TYPE"
    exit 1
fi 