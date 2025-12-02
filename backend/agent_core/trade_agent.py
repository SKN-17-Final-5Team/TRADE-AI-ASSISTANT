"""
무역 전문가 Agent

무역사기, CISG, Incoterms, 무역 클레임, 해외인증 정보를 다루는 전문 Agent
"""

import os
from agents import Agent
from agent_core.tools.search_tool import search_trade_documents
from agent_core.tools.web_search_tool import search_web


def load_instructions(filename: str = "trade_instructions.txt") -> str:
    """
    프롬프트 파일을 읽어서 instructions 반환

    Args:
        filename: 프롬프트 파일명 (agents/prompts/ 디렉토리 내)

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

def get_trade_agent():
    """
    매 요청마다 최신 프롬프트로 Agent 생성

    개발 중 프롬프트 수정사항을 서버 재시작 없이 반영하기 위해
    매번 파일에서 instructions를 새로 로드합니다.
    """
    return Agent(
        name="Trade Compliance Analyst",
        model="gpt-4o",
        instructions=load_instructions(),  # 매번 파일에서 최신 내용 로드
        tools=[search_trade_documents, search_web],
    )

# 하위 호환성을 위한 기본 인스턴스 (deprecated)
trade_agent = get_trade_agent()


