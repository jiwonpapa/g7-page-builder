"""Explicit validation contracts."""
from dataclasses import asdict, dataclass, field


@dataclass(frozen=True)
class Gate:
    name: str
    argv: tuple[str, ...]
    inputs: tuple[str, ...]
    reason: str
    runtime: bool = False
    env: tuple[tuple[str, str], ...] = ()
    requires: tuple[str, ...] = ()
    reusable: bool = True
    deferred: bool = False


@dataclass
class Plan:
    paths: list[str]
    gates: list[Gate] = field(default_factory=list)
    unresolved: list[str] = field(default_factory=list)
    full: bool = False
    phase: str = "verification"

    @property
    def requirements(self):
        used = {tool for gate in self.gates for tool in gate.requires}
        return {tool: tool in used for tool in ("node", "php", "g7", "browser")}

    def to_dict(self):
        return {**asdict(self), "requirements": self.requirements}
