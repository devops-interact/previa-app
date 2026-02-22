"""
Previa App — Subscription Plan Limits
Defines resource caps for each plan tier.
A value of -1 means unlimited.
"""

from typing import Dict

PLAN_LIMITS: Dict[str, Dict[str, int]] = {
    "free": {
        "max_orgs": 1,
        "max_watchlists_per_org": 1,
        "max_rfcs_per_watchlist": 20,
    },
    "basic": {
        "max_orgs": 8,
        "max_watchlists_per_org": 200,
        "max_rfcs_per_watchlist": 2_000,
    },
    "premium": {
        "max_orgs": 24,
        "max_watchlists_per_org": 800,
        "max_rfcs_per_watchlist": 8_000,
    },
    "company": {
        "max_orgs": -1,
        "max_watchlists_per_org": 2_000,
        "max_rfcs_per_watchlist": 4_000,
    },
}


def get_plan_limits(plan: str) -> Dict[str, int]:
    """Return limits dict for the given plan, defaulting to free."""
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
