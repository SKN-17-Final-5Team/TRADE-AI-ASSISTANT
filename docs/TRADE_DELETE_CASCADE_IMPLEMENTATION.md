# TradeFlow 삭제 시 Cascade 삭제 구현 가이드

> **목적**: TradeFlow 삭제 시 S3 파일 및 Qdrant 벡터 데이터 완전 삭제
>
> **작성일**: 2025-12
>
> **상태**: 미구현 (구현 필요)
>
> **관련 문서**: [S3_PREFIX_STRUCTURE_CHANGE.md](./S3_PREFIX_STRUCTURE_CHANGE.md)

---

## 1. 현재 상태 분석

### 1.1 삭제 관련 데이터 구조

```
TradeFlow (거래)
    │
    ├── Document (문서) ─── CASCADE 삭제 ✅
    │       │
    │       ├── s3_key: "documents/uuid.pdf"     ← S3 파일 경로
    │       ├── qdrant_point_ids: ["id1", "id2"] ← Qdrant 벡터 ID 목록
    │       │
    │       ├── DocVersion ─── CASCADE 삭제 ✅
    │       └── DocMessage ─── CASCADE 삭제 ✅
    │
    └── Mem0 Memory ─── 삭제 구현됨 ✅
```

### 1.2 현재 삭제 로직

**파일**: `backend/chat/trade_views.py` (229-267줄)

```python
def destroy(self, request, *args, **kwargs):
    trade = self.get_object()
    trade_id = trade.trade_id
    doc_ids = list(trade.documents.values_list('doc_id', flat=True))

    try:
        # 1. Mem0 메모리 삭제 ✅ 구현됨
        if doc_ids:
            mem_service = get_memory_service()
            if mem_service:
                mem_service.delete_trade_memory(trade_id, doc_ids)

        # 2. RDS 삭제 ✅ 구현됨 (Django CASCADE)
        trade.delete()

        # ❌ S3 파일 삭제 - 미구현
        # ❌ Qdrant 벡터 삭제 - 미구현
```

### 1.3 문제점

| 저장소 | 현재 상태 | 문제점 |
|--------|----------|--------|
| **MySQL (RDS)** | ✅ CASCADE 삭제 | 정상 작동 |
| **Mem0** | ✅ 삭제 구현됨 | 정상 작동 |
| **S3** | ❌ 미구현 | 고아 파일 누적 → 비용 발생 |
| **Qdrant** | ❌ 미구현 | 삭제된 문서 검색 노출 가능 |

---

## 2. Document 모델 구조

**파일**: `backend/documents/models.py` (135-248줄)

### 2.1 삭제에 필요한 필드

```python
class Document(models.Model):
    doc_id = models.BigAutoField(primary_key=True)
    trade = models.ForeignKey(TradeFlow, on_delete=models.CASCADE, related_name='documents')

    # S3 관련 필드
    s3_key = models.CharField(max_length=500, null=True, blank=True)  # ← S3 파일 경로
    s3_url = models.URLField(max_length=1000, null=True, blank=True)

    # Qdrant 관련 필드
    qdrant_point_ids = models.JSONField(default=list, blank=True)  # ← 벡터 ID 목록
```

### 2.2 삭제 시 수집해야 할 데이터

```python
# TradeFlow 삭제 전에 수집
documents = trade.documents.all()

# S3 삭제용
s3_keys = [doc.s3_key for doc in documents if doc.s3_key]

# Qdrant 삭제용
qdrant_data = [
    {'doc_id': doc.doc_id, 'point_ids': doc.qdrant_point_ids}
    for doc in documents
    if doc.qdrant_point_ids
]
```

---

## 3. 구현해야 할 코드

### 3.1 S3 삭제 함수 (이미 존재)

**파일**: `backend/agent_core/s3_utils.py` (127-147줄)

```python
def delete_file(self, s3_key: str) -> bool:
    """S3에서 파일 삭제"""
    try:
        self.s3_client.delete_object(
            Bucket=self.bucket_name,
            Key=s3_key
        )
        logger.info(f"Deleted file from S3: {s3_key}")
        return True
    except ClientError as e:
        logger.error(f"Failed to delete file from S3: {e}")
        return False
```

### 3.2 Qdrant 삭제 함수 (신규 작성 필요)

**파일**: `backend/documents/services.py` 또는 `backend/agent_core/` 에 추가

```python
from qdrant_client.models import PointIdsList
from agent_core.config import qdrant_client, COLLECTION_USER_DOCS

def delete_document_vectors(document_id: int, point_ids: list) -> bool:
    """
    Qdrant에서 문서 벡터 삭제

    Args:
        document_id: 문서 ID (로깅용)
        point_ids: 삭제할 Qdrant point ID 목록

    Returns:
        bool: 성공 여부
    """
    if not point_ids:
        return True

    try:
        qdrant_client.delete(
            collection_name=COLLECTION_USER_DOCS,
            points_selector=PointIdsList(
                points=point_ids
            )
        )
        logger.info(f"Deleted {len(point_ids)} vectors for document_id={document_id}")
        return True

    except Exception as e:
        logger.error(f"Failed to delete vectors for document_id={document_id}: {e}")
        return False
```

### 3.3 TradeFlow 삭제 로직 수정

**파일**: `backend/chat/trade_views.py`

#### 변경 전

```python
def destroy(self, request, *args, **kwargs):
    trade = self.get_object()
    trade_id = trade.trade_id
    doc_ids = list(trade.documents.values_list('doc_id', flat=True))

    try:
        # 1. Mem0 메모리 삭제
        if doc_ids:
            mem_service = get_memory_service()
            if mem_service:
                mem_service.delete_trade_memory(trade_id, doc_ids)

        # 2. RDS 삭제
        trade.delete()
        # ...
```

#### 변경 후

```python
from agent_core.s3_utils import s3_manager
from documents.services import delete_document_vectors

def destroy(self, request, *args, **kwargs):
    trade = self.get_object()
    trade_id = trade.trade_id

    # ========== 삭제 전 데이터 수집 ==========
    documents = trade.documents.all()
    doc_ids = [doc.doc_id for doc in documents]

    # S3 삭제용 데이터
    s3_keys = [doc.s3_key for doc in documents if doc.s3_key]

    # Qdrant 삭제용 데이터
    qdrant_data = [
        {'doc_id': doc.doc_id, 'point_ids': doc.qdrant_point_ids}
        for doc in documents
        if doc.qdrant_point_ids
    ]

    try:
        # ========== 1. S3 파일 삭제 (신규) ==========
        s3_delete_count = 0
        for s3_key in s3_keys:
            if s3_manager.delete_file(s3_key):
                s3_delete_count += 1
            else:
                logger.warning(f"Failed to delete S3 file: {s3_key}")

        if s3_keys:
            logger.info(f"Deleted {s3_delete_count}/{len(s3_keys)} S3 files for trade_id={trade_id}")

        # ========== 2. Qdrant 벡터 삭제 (신규) ==========
        qdrant_delete_count = 0
        for data in qdrant_data:
            if delete_document_vectors(data['doc_id'], data['point_ids']):
                qdrant_delete_count += 1
            else:
                logger.warning(f"Failed to delete Qdrant vectors for doc_id={data['doc_id']}")

        if qdrant_data:
            logger.info(f"Deleted vectors for {qdrant_delete_count}/{len(qdrant_data)} documents")

        # ========== 3. Mem0 메모리 삭제 (기존) ==========
        if doc_ids:
            mem_service = get_memory_service()
            if mem_service:
                mem_service.delete_trade_memory(trade_id, doc_ids)
                logger.info(f"Deleted Mem0 memories for trade_id={trade_id}")

        # ========== 4. RDS 삭제 (기존) ==========
        trade.delete()

        logger.info(f"Successfully deleted trade_id={trade_id} with {len(doc_ids)} documents")

        return Response({
            'message': '무역 플로우가 삭제되었습니다.',
            'trade_id': trade_id,
            'deleted_doc_count': len(doc_ids),
            'deleted_s3_files': s3_delete_count,       # 추가
            'deleted_qdrant_docs': qdrant_delete_count  # 추가
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Failed to delete trade: {e}")
        return Response(
            {'error': f'삭제 중 오류가 발생했습니다: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
```

---

## 4. 필요한 import 추가

**파일**: `backend/chat/trade_views.py` 상단에 추가

```python
from agent_core.s3_utils import s3_manager
from documents.services import delete_document_vectors  # 신규 함수
```

---

## 5. 삭제 순서 및 이유

```
1. S3 파일 삭제        ← 외부 저장소 먼저
2. Qdrant 벡터 삭제    ← 외부 저장소
3. Mem0 메모리 삭제    ← 외부 저장소
4. RDS 삭제 (CASCADE)  ← DB는 마지막에 (롤백 가능성)
```

**이유**:
- DB를 마지막에 삭제해야 실패 시 재시도 가능
- DB 삭제 후에는 `s3_key`, `qdrant_point_ids` 정보를 알 수 없음

---

## 6. 에러 처리 전략

### 6.1 Soft Fail 방식 (권장)

```python
# S3/Qdrant 삭제 실패해도 계속 진행
for s3_key in s3_keys:
    try:
        s3_manager.delete_file(s3_key)
    except Exception as e:
        logger.warning(f"S3 delete failed (continuing): {s3_key}, {e}")
```

**장점**:
- 일부 실패해도 나머지 정리 진행
- 사용자 경험 저하 방지

**단점**:
- 고아 파일 발생 가능 (정기 정리 배치 필요)

### 6.2 Hard Fail 방식 (엄격)

```python
# 하나라도 실패하면 전체 롤백
with transaction.atomic():
    # 외부 저장소 삭제
    for s3_key in s3_keys:
        if not s3_manager.delete_file(s3_key):
            raise Exception(f"S3 delete failed: {s3_key}")

    # DB 삭제
    trade.delete()
```

**장점**: 데이터 일관성 보장

**단점**: 외부 서비스 장애 시 삭제 불가

---

## 7. 테스트 체크리스트

- [ ] TradeFlow 삭제 시 관련 S3 파일 삭제 확인
- [ ] TradeFlow 삭제 시 관련 Qdrant 벡터 삭제 확인
- [ ] 삭제 후 Qdrant 검색에서 해당 문서 미노출 확인
- [ ] S3/Qdrant 삭제 실패 시에도 RDS 삭제 진행 확인
- [ ] 응답에 삭제된 파일/벡터 수 포함 확인
- [ ] 업로드 안 된 문서(s3_key=null) 삭제 정상 작동 확인

---

## 8. 관련 파일 목록

| 파일 | 역할 | 변경 여부 |
|------|------|----------|
| `backend/chat/trade_views.py` | TradeFlow 삭제 API | ✅ 수정 필요 |
| `backend/documents/services.py` | Qdrant 삭제 함수 추가 | ✅ 추가 필요 |
| `backend/agent_core/s3_utils.py` | S3 삭제 함수 | ❌ 이미 존재 |
| `backend/documents/models.py` | Document 모델 | ❌ 변경 없음 |

---

## 9. 향후 고려사항

### 9.1 개별 Document 삭제

현재는 TradeFlow 단위 삭제만 분석했음.
개별 Document 삭제 시에도 동일한 로직 적용 필요.

### 9.2 배치 정리 작업

S3/Qdrant 삭제 실패로 인한 고아 데이터 정리용 배치 작업 고려:

```python
# 주기적으로 실행
def cleanup_orphan_data():
    # 1. DB에 없는 S3 파일 삭제
    # 2. DB에 없는 Qdrant 벡터 삭제
```

### 9.3 User 삭제 시

User 삭제 시에도 해당 사용자의 모든 TradeFlow → Document → S3/Qdrant 삭제 필요.
Django signal 또는 User 모델의 delete 메서드 오버라이드 고려.
