# S3 Prefix 구조 변경 가이드

> **목적**: 사용자별 업로드 파일 구분을 위한 S3 저장 경로 개선
>
> **작성일**: 2025-12
>
> **상태**: 예정
>
> **관련 문서**: [TRADE_DELETE_CASCADE_IMPLEMENTATION.md](./TRADE_DELETE_CASCADE_IMPLEMENTATION.md)

---

## 1. 현재 구조 (Before)

### 1.1 S3 저장 경로

```
trade-ai-documents/          ← 버킷
└── documents/
    ├── a1b2c3d4-uuid.pdf    ← 모든 사용자 파일이 한 폴더에
    ├── e5f6g7h8-uuid.pdf
    └── ...
```

### 1.2 현재 코드

**`backend/agent_core/s3_utils.py:56-60`**
```python
def generate_presigned_upload_url(
    self,
    file_name: str,
    file_type: str = 'application/pdf',
    expiration: int = 3600
) -> dict:
    # ...
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    s3_key = f"documents/{unique_filename}"  # ❌ 사용자 구분 없음
```

### 1.3 문제점

- 모든 사용자의 파일이 `documents/` 폴더 하나에 저장됨
- 사용자별/거래별 파일 관리 불가
- S3 콘솔에서 특정 사용자 파일 찾기 어려움
- 사용자 데이터 삭제 시 개별 파일 추적 필요

---

## 2. 변경 후 구조 (After)

### 2.1 새로운 S3 저장 경로

```
trade-ai-documents/                    ← 버킷 (변경 없음)
└── documents/
    └── {user_id}/
        └── {trade_id}/
            ├── a1b2c3d4-uuid.pdf
            └── e5f6g7h8-uuid.pdf
```

**예시:**
```
trade-ai-documents/
└── documents/
    ├── 1/                           ← user_id=1
    │   ├── 10/                      ← trade_id=10
    │   │   ├── abc123-contract.pdf
    │   │   └── def456-invoice.pdf
    │   └── 11/                      ← trade_id=11
    │       └── ghi789-offer.pdf
    └── 2/                           ← user_id=2
        └── 20/
            └── jkl012-pi.pdf
```

### 2.2 장점

| 항목 | 설명 |
|------|------|
| **사용자별 분리** | `documents/{user_id}/`로 논리적 구분 |
| **거래별 분리** | `documents/{user_id}/{trade_id}/`로 거래 단위 관리 |
| **삭제 용이** | 사용자/거래 삭제 시 폴더 단위로 처리 가능 |
| **IAM 정책** | prefix 기반 접근 제어 가능 (필요 시) |
| **콘솔 탐색** | S3 콘솔에서 폴더처럼 탐색 가능 |

---

## 3. 코드 변경 사항

### 3.1 파일 1: `backend/agent_core/s3_utils.py`

#### 변경 전

```python
def generate_presigned_upload_url(
    self,
    file_name: str,
    file_type: str = 'application/pdf',
    expiration: int = 3600
) -> dict:
    """
    Presigned URL 생성 (업로드용)

    Args:
        file_name: 원본 파일명
        file_type: MIME 타입 (기본값: application/pdf)
        expiration: URL 만료 시간(초) (기본값: 3600 = 1시간)

    Returns:
        {
            'upload_url': str,
            's3_key': str,
            'file_url': str
        }
    """
    try:
        file_extension = os.path.splitext(file_name)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        s3_key = f"documents/{unique_filename}"
        # ...
```

#### 변경 후

```python
def generate_presigned_upload_url(
    self,
    file_name: str,
    user_id: int,                              # ✅ 추가
    trade_id: int,                             # ✅ 추가
    file_type: str = 'application/pdf',
    expiration: int = 3600
) -> dict:
    """
    Presigned URL 생성 (업로드용)

    Args:
        file_name: 원본 파일명
        user_id: 사용자 ID                      # ✅ 추가
        trade_id: 거래 ID                       # ✅ 추가
        file_type: MIME 타입 (기본값: application/pdf)
        expiration: URL 만료 시간(초) (기본값: 3600 = 1시간)

    Returns:
        {
            'upload_url': str,
            's3_key': str,
            'file_url': str
        }
    """
    try:
        file_extension = os.path.splitext(file_name)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        s3_key = f"documents/{user_id}/{trade_id}/{unique_filename}"  # ✅ 변경
        # ...
```

---

### 3.2 파일 2: `backend/documents/views.py`

#### 변경 위치: `upload_request` 액션 (약 255번 줄)

#### 변경 전

```python
@action(detail=True, methods=['post'], url_path='upload_request')
def upload_request(self, request, pk=None):
    """Presigned URL 요청"""
    document = self.get_object()

    serializer = PresignedUploadRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    file_name = serializer.validated_data['file_name']
    file_type = serializer.validated_data.get('file_type', 'application/pdf')

    try:
        presigned_data = s3_manager.generate_presigned_upload_url(
            file_name=file_name,
            file_type=file_type
        )
        # ...
```

#### 변경 후

```python
@action(detail=True, methods=['post'], url_path='upload_request')
def upload_request(self, request, pk=None):
    """Presigned URL 요청"""
    document = self.get_object()

    serializer = PresignedUploadRequestSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    file_name = serializer.validated_data['file_name']
    file_type = serializer.validated_data.get('file_type', 'application/pdf')

    # ✅ user_id, trade_id 가져오기
    user_id = document.trade.user.user_id
    trade_id = document.trade.trade_id

    try:
        presigned_data = s3_manager.generate_presigned_upload_url(
            file_name=file_name,
            user_id=user_id,        # ✅ 추가
            trade_id=trade_id,      # ✅ 추가
            file_type=file_type
        )
        # ...
```

---

## 4. AWS 설정 변경

**변경 필요 없음**

S3에서 "폴더"는 실제 객체가 아니라 key의 prefix입니다.
`documents/1/10/file.pdf`로 저장하면 자동으로 해당 경로에 저장됩니다.

현재 설정 확인:
```python
# backend/config/settings.py
AWS_DEFAULT_ACL = 'private'        # ✅ 파일 비공개
AWS_QUERYSTRING_AUTH = True        # ✅ presigned URL 사용
AWS_S3_FILE_OVERWRITE = False      # ✅ 파일 덮어쓰기 방지
```

CORS 설정도 경로 제한 없이 메서드/오리진만 제한하고 있어 변경 불필요.

---

## 5. 기존 데이터 처리

### 5.1 옵션 A: 기존 파일 그대로 유지 (권장)

- 기존에 업로드된 파일은 `documents/{uuid}.pdf` 경로 그대로 유지
- 새로 업로드되는 파일만 `documents/{user_id}/{trade_id}/{uuid}.pdf` 구조 적용
- DB의 `s3_key` 필드에 전체 경로가 저장되어 있으므로 기존 파일 접근에 문제 없음

### 5.2 옵션 B: 기존 파일 마이그레이션

기존 파일도 새 구조로 이동하려면:

```python
# 마이그레이션 스크립트 (필요 시 작성)
# 1. Document 테이블에서 s3_key가 있는 모든 레코드 조회
# 2. 각 Document의 trade.user.user_id, trade.trade_id 확인
# 3. S3에서 파일 복사 (copy_object)
# 4. DB의 s3_key 업데이트
# 5. 원본 파일 삭제 (선택)
```

**주의**: 마이그레이션 중 서비스 중단 또는 presigned URL 무효화 가능성 있음

---

## 6. 테스트 체크리스트

- [ ] 새 파일 업로드 시 `documents/{user_id}/{trade_id}/{uuid}.pdf` 경로에 저장되는지 확인
- [ ] S3 콘솔에서 폴더 구조로 표시되는지 확인
- [ ] presigned URL로 업로드/다운로드 정상 작동 확인
- [ ] 기존 파일 (구 경로) 다운로드 정상 작동 확인
- [ ] 문서 벡터화 파이프라인 (`documents/services.py`) 정상 작동 확인

---

## 7. 관련 파일 목록

| 파일 | 역할 | 변경 여부 |
|------|------|----------|
| `backend/agent_core/s3_utils.py` | S3 presigned URL 생성 | ✅ 변경 |
| `backend/documents/views.py` | 업로드 요청 처리 | ✅ 변경 |
| `backend/documents/services.py` | PDF 다운로드 및 벡터화 | ❌ 변경 없음 (s3_key로 접근) |
| `backend/documents/models.py` | Document 모델 (s3_key 필드) | ❌ 변경 없음 |
| `backend/config/settings.py` | AWS 설정 | ❌ 변경 없음 |

---

## 8. 롤백 계획

문제 발생 시:
1. `s3_utils.py`의 `s3_key` 생성 로직을 원래대로 복구
2. `documents/views.py`의 호출부에서 `user_id`, `trade_id` 파라미터 제거
3. 새 구조로 저장된 파일은 그대로 유지 (DB에 전체 경로 저장되어 있음)
