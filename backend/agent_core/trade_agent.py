"""
무역 전문가 Agent

무역사기, CISG, Incoterms, 무역 클레임, 해외인증 정보를 다루는 전문 Agent
Langfuse를 통한 프롬프트 버전 관리 지원
"""

import os
import requests
from agents import Agent
from agent_core.tools.search_tool import search_trade_documents
from agent_core.tools.web_search_tool import search_web
from dotenv import load_dotenv

# 환경 변수 로드
load_dotenv()

# Langfuse 설정
LANGFUSE_PUBLIC_KEY = os.getenv("LANGFUSE_PUBLIC_KEY")
LANGFUSE_SECRET_KEY = os.getenv("LANGFUSE_SECRET_KEY")
LANGFUSE_BASE_URL = os.getenv("LANGFUSE_BASE_URL", "https://cloud.langfuse.com")
LANGFUSE_ENABLED = bool(LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY)

if LANGFUSE_ENABLED:
    print("✅ Langfuse 설정 확인 완료")
else:
    print("⚠️ Langfuse 키가 설정되지 않았습니다. 로컬 파일 모드로 작동합니다.")


def load_instructions_from_langfuse(
    prompt_name: str = "trade_assistant_v1",
    version: int | None = None,
    label: str = "production"
) -> str:
    """
    Langfuse API를 통해 프롬프트를 가져옴 (버전 관리)

    Args:
        prompt_name: Langfuse에 등록된 프롬프트 이름
        version: 특정 버전 번호 (None이면 label 기준으로 가져옴)
        label: 버전 레이블 ("production", "latest" 등)

    Returns:
        프롬프트 문자열
    """
    if not LANGFUSE_ENABLED:
        raise Exception("Langfuse가 비활성화되어 있습니다")

    try:
        # Langfuse API 엔드포인트
        url = f"{LANGFUSE_BASE_URL}/api/public/v2/prompts/{prompt_name}"

        # 쿼리 파라미터 설정
        params = {}
        if version is not None:
            params["version"] = version
        else:
            params["label"] = label

        # HTTP 요청
        response = requests.get(
            url,
            params=params,
            auth=(LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY),
            headers={"Content-Type": "application/json"}
        )

        if response.status_code == 200:
            data = response.json()
            prompt_text = data.get("prompt", "")
            version_num = data.get("version", "unknown")

            if version is not None:
                print(f"✅ Langfuse에서 프롬프트 로드: {prompt_name} (버전: {version})")
            else:
                print(f"✅ Langfuse에서 프롬프트 로드: {prompt_name} (label: {label}, 버전: {version_num})")

            return prompt_text
        else:
            raise Exception(f"HTTP {response.status_code}: {response.text}")

    except Exception as e:
        raise Exception(f"Langfuse 프롬프트 로드 실패: {e}")


def load_instructions_from_file(filename: str = "trade_instructions.txt") -> str:
    """
    로컬 파일에서 프롬프트 로드 (Fallback용)

    Args:
        filename: 프롬프트 파일명 (prompts/ 디렉토리 내)

    Returns:
        파일 내용 (프롬프트 문자열)
    """
    current_dir = os.path.dirname(__file__)
    prompts_dir = os.path.join(current_dir, "prompts")
    file_path = os.path.join(prompts_dir, filename)

    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


# =====================================================================
# Agent 정의 (무역 전문가 Agent)
# =====================================================================

def get_trade_agent(
    use_langfuse: bool = True,
    prompt_version: int | None = None,
    prompt_label: str = "production"
):
    """
    무역 전문가 Agent 생성

    Args:
        use_langfuse: Langfuse 사용 여부 (False면 로컬 파일 사용)
        prompt_version: Langfuse 프롬프트 특정 버전 (None이면 label 기준)
        prompt_label: Langfuse 프롬프트 레이블 ("production", "latest" 등)

    Returns:
        Agent 인스턴스
    """
    # Langfuse에서 프롬프트 로드 시도
    if use_langfuse and LANGFUSE_ENABLED:
        try:
            instructions = load_instructions_from_langfuse(
                prompt_name="trade_assistant_v1",
                version=prompt_version,
                label=prompt_label
            )
        except Exception as e:
            print(f"⚠️ Langfuse 로드 실패, 로컬 파일로 대체: {e}")
            instructions = load_instructions_from_file()
    else:
        # 로컬 파일에서 프롬프트 로드
        if not use_langfuse:
            print("📁 로컬 파일에서 프롬프트 로드 (use_langfuse=False)")
        else:
            print("📁 로컬 파일에서 프롬프트 로드 (Langfuse 비활성화)")
        instructions = load_instructions_from_file()

    return Agent(
        name="Trade Compliance Analyst",
        model="gpt-4o",
        instructions=instructions,
        tools=[search_trade_documents, search_web],
    )


# 하위 호환성을 위한 기본 인스턴스는 제거됨
# 매번 get_trade_agent()를 호출하여 최신 프롬프트 사용


