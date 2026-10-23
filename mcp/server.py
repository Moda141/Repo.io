"""MDM MCP server (M0 skeleton): read-only tools over the MDM API.

It authenticates to the API with a bot token (MDM_API_TOKEN), so every call is bound to that bot's
role. Write tools (resolve_task, ...) arrive in M5 with explicit confirmation and audit.
"""
import os

import httpx
from mcp.server.fastmcp import FastMCP

API_URL = os.environ.get("MDM_API_URL", "http://api:8000").rstrip("/")
API_TOKEN = os.environ.get("MDM_API_TOKEN", "")

mcp = FastMCP("mdm", host="0.0.0.0", port=int(os.environ.get("MCP_PORT", "8001")))


def _get(path: str, **params):
    headers = {"Authorization": f"Bearer {API_TOKEN}"} if API_TOKEN else {}
    response = httpx.get(f"{API_URL}{path}", params=params, headers=headers, timeout=15)
    response.raise_for_status()
    return response.json()


@mcp.tool()
def get_health() -> dict:
    """Platform health (database, queue)."""
    return _get("/api/v1/health")


@mcp.tool()
def search_customers(query: str, limit: int = 25) -> list[dict]:
    """Search mirrored source customer records by name, phone or email. (Golden-record search arrives in M3.)"""
    return _get("/api/v1/customers/search", q=query, limit=limit)


@mcp.tool()
def list_sources() -> list[dict]:
    """Source systems mirrored in the catalog with record counts."""
    return _get("/api/v1/catalog/sources")


if __name__ == "__main__":
    mcp.run(transport="streamable-http")
