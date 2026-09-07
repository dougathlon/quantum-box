"""Pinned, non-secret portions of the four reviewed engine contracts."""

from __future__ import annotations

from types import MappingProxyType

from .models import EngineContract


_CONTRACTS = {
    "coin-toss-v1": EngineContract(
        engine_id="coin-toss-v1",
        canonical_sha256=(
            "e868d1e2436e629a911bc3a7bb85c33c20951fbc8130c9bbd62dc239d005c51c"
        ),
        redacted_sha256=(
            "a2c4ed5fd06e67d5d20c6ce07debd99b7b8b44f61cbf7de2a280e74c3dea6dc4"
        ),
        updated_at="2026-07-23T16:09:42Z",
        credits_per_run=2,
        input_slots=(),
        output_type="application/json",
        result_contract_state="code-sample-only",
        unresolved_gaps=(
            "No formal result schema binds output to heads or tails.",
            "One job does not provide an ordered seven-rally batch.",
            "The formatted result does not evidence an effective seed.",
        ),
    ),
    "blur-v1": EngineContract(
        engine_id="blur-v1",
        canonical_sha256=(
            "bb0719963cd5927ade8d75bfbe66b6b906495697352fe3832437d71091cbf082"
        ),
        redacted_sha256=(
            "12d39951f60c995ba59225ea7c33aea10157174778b118ba394c1afa64f93710"
        ),
        updated_at="2026-08-04T12:08:45Z",
        credits_per_run=1,
        input_slots=("image", "mask"),
        output_type="application/octet-stream",
        result_contract_state="asset-transport-documented",
        unresolved_gaps=(
            "A concrete input asset and exact decoder request have not been approved.",
            "Execution source and seed behavior are not evidenced by the result asset.",
        ),
    ),
    "qpixl-v1": EngineContract(
        engine_id="qpixl-v1",
        canonical_sha256=(
            "5ce2090ea3b6d6601e6c69caa772c072681f733f2533da5301063df66ced9316"
        ),
        redacted_sha256=(
            "00c64ea121a76b47afdd641f3d704f2201df9cdf34e73f833d15631c5a29f4e1"
        ),
        updated_at="2026-08-21T10:32:52Z",
        credits_per_run=1,
        input_slots=(),
        output_type="application/json",
        result_contract_state="cached-simulator-only-record",
        unresolved_gaps=(
            "The cached record exposes simulated machines only; the current QPU path is not pinned.",
            "No formal current result schema or value-ordering provenance is pinned.",
            "Current QPU backend, price, capacity, retention, and redistribution terms require review.",
        ),
    ),
    "graph-v1": EngineContract(
        engine_id="graph-v1",
        canonical_sha256=(
            "5a1d16aba1eabb9a14fab5e397b1f96a5773812a0a4a26e2a31624fddfe10dfb"
        ),
        redacted_sha256=(
            "ae2408f7c84d1c51f90b0218e5477eb7bbf1f4480258b3cb08657ffad2f5df24"
        ),
        updated_at="2026-08-20T11:05:21Z",
        credits_per_run=5,
        input_slots=(),
        output_type="application/json",
        result_contract_state="insufficient-for-fluxball",
        unresolved_gaps=(
            "No formal result schema defines per-edge or full-register distributions.",
            "The code sample exposes only mode, dominant_bitstring, and edge_agreement_score.",
            "No bit ordering or four-player joint-outcome convention is established.",
            "The engine-authored graph state is not the current Fluxball tomography recipe.",
        ),
    ),
    "labyrinth-v1": EngineContract(
        engine_id="labyrinth-v1",
        canonical_sha256=(
            "f88c54b9d4d6366593ffdece799b4bef7676bc7c691833aeaebed0a85605b766"
        ),
        redacted_sha256=(
            "31663e9999d994f29de09111755feb88e011c07eb04ece6dd3b8f2c2307c6168"
        ),
        updated_at="2026-07-23T16:09:42Z",
        credits_per_run=5,
        input_slots=(),
        output_type="application/json",
        result_contract_state="insufficient-for-quantman",
        unresolved_gaps=(
            "No formal schema defines measurement completeness or zero bins.",
            "Backend bit/register order is not mapped to row-major rooms.",
            "The relationship between returned top_n measurements and a playable state is unreviewed.",
        ),
    ),
}

ENGINE_CONTRACTS = MappingProxyType(_CONTRACTS)
