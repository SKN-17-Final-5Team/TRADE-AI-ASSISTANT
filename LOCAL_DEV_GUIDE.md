# 로컬 개발 서버 실행 가이드

## 필수 환경변수

각 서버 디렉토리에 `.env` 파일이 필요합니다.

## 서버 실행

### 1. AI Server (port 8001)
```bash
cd trade_ai
uvicorn main:app --host 0.0.0.0 --port 8001
```

### 2. Django Backend (port 8000)
```bash
cd trade_backend
python manage.py runserver 8000
```

### 3. Frontend (port 3000)
```bash
cd trade_frontend
npm run dev
```

## 실행 순서
1. AI Server 먼저 실행
2. Django Backend 실행
3. Frontend 실행

## 접속 URL
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/api/
- AI Server: http://localhost:8001

## Health Check
```bash
# AI Server
curl http://localhost:8001/health

# Django Backend
curl http://localhost:8000/api/documents/documents/
```
