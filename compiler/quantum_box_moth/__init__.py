"""Engine-specific, predeployment Moth acquisition tools.

Nothing in this package is imported by the browser runtime. Live mutations
require an exact approval receipt and are intentionally absent from the CLI.
"""

from .engine_contracts import ENGINE_CONTRACTS

__all__ = ["ENGINE_CONTRACTS"]
