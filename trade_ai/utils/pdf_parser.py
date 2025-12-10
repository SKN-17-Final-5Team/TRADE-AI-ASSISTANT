"""
PDF 파서 (RAG 파이프라인용)

LLM-RAG 애플리케이션에 최적화된 PDF 파서.
PyMuPDF를 사용하여 텍스트 추출 및 에러 처리를 수행합니다.
"""

import pymupdf
from pathlib import Path
from typing import Optional


def analyze_pdf_characteristics(pdf_path: str) -> dict:
    """
    PDF 특성 분석 (RAG 처리용)

    Args:
        pdf_path: PDF 파일 경로

    Returns:
        PDF 특성 및 타입 분류 정보가 담긴 dict
    """
    doc = pymupdf.open(pdf_path)

    analysis = {
        'filename': Path(pdf_path).name,
        'page_count': len(doc),
        'metadata': doc.metadata,
        'is_encrypted': doc.is_encrypted,
        'has_images': False,
        'text_density': [],
        'page_sizes': []
    }

    # 첫 10페이지 샘플링
    sample_size = min(10, len(doc))

    for i in range(sample_size):
        page = doc[i]

        # 텍스트 밀도 확인
        text = page.get_text("text")
        char_count = len(text.strip())
        page_area = page.rect.width * page.rect.height
        density = char_count / page_area if page_area > 0 else 0
        analysis['text_density'].append(density)

        # 이미지 포함 여부 확인
        images = page.get_images()
        if images:
            analysis['has_images'] = True

        # 페이지 크기
        analysis['page_sizes'].append((page.rect.width, page.rect.height))

    # 평균 텍스트 밀도 계산
    avg_density = sum(analysis['text_density']) / len(analysis['text_density']) if analysis['text_density'] else 0

    # PDF 타입 분류
    if avg_density < 0.01:
        pdf_type = "스캔/이미지 기반 (OCR 필요)"
    elif avg_density < 0.1:
        pdf_type = "낮은 텍스트 밀도 (그래픽 중심)"
    else:
        pdf_type = "텍스트 기반 PDF (추출 적합)"

    doc.close()

    return {
        **analysis,
        'avg_text_density': avg_density,
        'pdf_type': pdf_type
    }


def parse_pdf_for_rag_enhanced(
    pdf_path: str,
    page_chunks: bool = False,
    password: Optional[str] = None,
    show_progress: bool = True,
    min_chars_per_page: int = 10
) -> dict:
    """
    RAG 파이프라인용 PDF 파서 (에러 처리 강화)

    Args:
        pdf_path: PDF 파일 경로
        page_chunks: True면 페이지별 딕셔너리 리스트 반환
        password: 암호화된 PDF용 비밀번호 (선택)
        show_progress: 진행 정보 출력 여부
        min_chars_per_page: 페이지에 콘텐츠가 있다고 판단할 최소 문자 수

    Returns:
        dict 포함:
          - 'success': bool
          - 'data': 추출된 텍스트 또는 페이지 청크
          - 'warnings': 경고 리스트
          - 'metadata': PDF 메타데이터
    """
    result = {
        'success': False,
        'data': None,
        'warnings': [],
        'metadata': {}
    }

    try:
        # 문서 열기
        doc = pymupdf.open(pdf_path)

        # 암호화된 PDF 처리
        if doc.is_encrypted:
            if password:
                if not doc.authenticate(password):
                    result['warnings'].append("잘못된 비밀번호")
                    return result
            else:
                result['warnings'].append("PDF가 암호화되어 있지만 비밀번호가 제공되지 않음")
                doc.close()
                return result

        # 메타데이터 수집
        result['metadata'] = {
            'page_count': len(doc),
            'format': doc.metadata.get('format', 'Unknown'),
            'creator': doc.metadata.get('creator', ''),
            'is_encrypted': doc.is_encrypted
        }

        if show_progress:
            print(f"파싱 중: {Path(pdf_path).name} ({len(doc)} 페이지)")

        # 콘텐츠 추출
        if page_chunks:
            chunks = []
            empty_pages = 0

            for page_num, page in enumerate(doc, start=1):
                text = page.get_text("text")
                char_count = len(text.strip())

                # 빈 페이지 경고
                if char_count < min_chars_per_page:
                    empty_pages += 1

                chunks.append({
                    'page': page_num,
                    'text': text,
                    'char_count': char_count,
                    'metadata': {
                        'page_width': page.rect.width,
                        'page_height': page.rect.height,
                        'has_images': len(page.get_images()) > 0
                    }
                })

            # 경고
            if empty_pages > len(doc) * 0.5:
                result['warnings'].append(
                    f"{empty_pages}/{len(doc)} 페이지에 텍스트가 거의 없음 - "
                    "스캔된 PDF일 수 있으며 OCR 필요"
                )
            elif empty_pages > 0:
                result['warnings'].append(f"{empty_pages} 페이지에 텍스트가 거의 없음")

            result['data'] = chunks

            if show_progress:
                total_chars = sum(c['char_count'] for c in chunks)
                print(f"{len(chunks)} 페이지 추출 ({total_chars:,} 문자)")
                if result['warnings']:
                    for w in result['warnings']:
                        print(f"  경고: {w}")

        else:
            # 전체 문서 추출
            full_text = []
            total_chars = 0

            for page in doc:
                text = page.get_text("text")
                full_text.append(text)
                total_chars += len(text.strip())

            result['data'] = '\n'.join(full_text)

            # 경고
            if total_chars < 100:
                result['warnings'].append(
                    "추출된 텍스트가 매우 적음 - 스캔/이미지 기반 PDF일 수 있음"
                )

            if show_progress:
                lines = len(result['data'].splitlines())
                print(f"{lines} 줄 추출 ({total_chars:,} 문자)")
                if result['warnings']:
                    for w in result['warnings']:
                        print(f"  경고: {w}")

        doc.close()
        result['success'] = True

    except Exception as e:
        result['warnings'].append(f"에러: {str(e)}")
        if show_progress:
            print(f"PDF 파싱 실패: {e}")

    return result


def production_pdf_pipeline(pdf_path: str, min_chunk_chars: int = 100) -> dict:
    """
    RAG 문서 처리용 프로덕션 파이프라인

    Args:
        pdf_path: PDF 파일 경로
        min_chunk_chars: 포함할 청크당 최소 문자 수

    Returns:
        상태, 청크, 경고, 메타데이터가 담긴 dict
    """
    result = parse_pdf_for_rag_enhanced(pdf_path, page_chunks=True, show_progress=False)

    if not result['success']:
        return {"status": "error", "error": "PDF 열기 실패", "warnings": result['warnings']}

    # OCR 필요 여부 확인
    total_chars = sum(p['char_count'] for p in result['data'])
    avg_chars_per_page = total_chars / len(result['data']) if result['data'] else 0

    if avg_chars_per_page < 50:
        return {
            "status": "needs_ocr",
            "message": "스캔된 문서로 보입니다. OCR을 권장합니다.",
            "data": result['data'],
            "warnings": result['warnings'],
            "metadata": result['metadata']
        }

    # RAG용 처리 - 정리 및 청크 분할
    chunks = []
    for page in result['data']:
        if page['char_count'] > min_chunk_chars:  # 거의 빈 페이지 스킵
            chunks.append({
                'text': page['text'].strip(),
                'page_num': page['page'],
                'metadata': page['metadata']
            })

    return {
        "status": "success",
        "chunks": chunks,
        "warnings": result['warnings'],
        "metadata": result['metadata']
    }
