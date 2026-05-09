# Makefile for Retro Game

.PHONY: help install dev build server client clean

help:
	@echo "Usage:"
	@echo "  make install  - Install dependencies"
	@echo "  make dev      - Run both backend and frontend in parallel"
	@echo "  make server   - Run only the backend server"
	@echo "  make client   - Run only the frontend (Vite)"
	@echo "  make build    - Build the frontend for production"
	@echo "  make clean    - Remove node_modules, dist, and database"

install:
	npm install

dev:
	@echo "🚀 Starting backend and frontend..."
	@npm run server & npm run dev

server:
	npm run server

client:
	npm run dev

build:
	npm run build

clean:
	rm -rf node_modules dist retro.db
