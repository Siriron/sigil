# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass
import json


@allow_storage
@dataclass
class AuditEntry:
    entry_id: u256
    project_contract: str
    project_name: str
    milestone_id: u256
    milestone_title: str
    verdict: str
    score: u256
    reasoning: str
    timestamp: str
    triggered_by: str

    def to_dict(self):
        return {
            "entry_id": str(self.entry_id),
            "project_contract": self.project_contract,
            "project_name": self.project_name,
            "milestone_id": str(self.milestone_id),
            "milestone_title": self.milestone_title,
            "verdict": self.verdict,
            "score": str(self.score),
            "reasoning": self.reasoning,
            "timestamp": self.timestamp,
            "triggered_by": self.triggered_by,
        }


@allow_storage
@dataclass
class ComparisonEntry:
    entry_id: u256
    project_a: str
    project_b: str
    verdict_a: str
    verdict_b: str
    score_a: u256
    score_b: u256
    comparison_summary: str
    timestamp: str

    def to_dict(self):
        return {
            "entry_id": str(self.entry_id),
            "project_a": self.project_a,
            "project_b": self.project_b,
            "verdict_a": self.verdict_a,
            "verdict_b": self.verdict_b,
            "score_a": str(self.score_a),
            "score_b": str(self.score_b),
            "comparison_summary": self.comparison_summary,
            "timestamp": self.timestamp,
        }


class AuditLog(gl.Contract):
    admins: DynArray[Address]

    # Append-only verdict log
    entries: TreeMap[u256, AuditEntry]
    entry_count: u256

    # Comparison log
    comparisons: TreeMap[u256, ComparisonEntry]
    comparison_count: u256

    # Index: project_contract (hex) → list of entry_ids
    entries_by_project: TreeMap[str, DynArray[u256]]

    # Archived entry IDs
    archived_entries: TreeMap[u256, bool]

    def __init__(self):
        self.admins.append(gl.message.sender_address)
        self.entry_count = u256(0)
        self.comparison_count = u256(0)

    # ─────────────────────────────────────────────
    # Write — called by authorised MilestoneContracts / backend
    # ─────────────────────────────────────────────

    @gl.public.write
    def log_verdict(
        self,
        project_contract: str,
        project_name: str,
        milestone_id: int,
        milestone_title: str,
        verdict: str,
        score: int,
        reasoning: str,
        triggered_by: str,
    ):
        entry_id = self.entry_count
        entry = AuditEntry(
            entry_id=entry_id,
            project_contract=project_contract,
            project_name=project_name,
            milestone_id=u256(milestone_id),
            milestone_title=milestone_title,
            verdict=verdict,
            score=u256(score),
            reasoning=reasoning,
            timestamp=gl.message_raw["datetime"],
            triggered_by=triggered_by,
        )
        self.entries[entry_id] = entry

        # Index by project
        project_entries = self.entries_by_project.get_or_insert_default(project_contract)
        project_entries.append(entry_id)

        self.entry_count = u256(int(self.entry_count) + 1)

    @gl.public.write
    def compare(
        self,
        project_a: str,
        project_b: str,
        verdict_a: str,
        verdict_b: str,
        score_a: int,
        score_b: int,
    ):
        """
        AI-powered cross-project comparison. Stores a comparison entry.
        Uses nondet to generate a comparison summary.
        """
        p_a = project_a
        p_b = project_b
        v_a = verdict_a
        v_b = verdict_b
        s_a = score_a
        s_b = score_b

        def leader_fn():
            prompt = f"""You are an auditor comparing two grant project milestone outcomes.

PROJECT A: {p_a}
  Latest verdict: {v_a}
  Score: {s_a}/100

PROJECT B: {p_b}
  Latest verdict: {v_b}
  Score: {s_b}/100

Compare these two projects on their milestone delivery performance.
Return ONLY valid JSON:
{{
  "better_performer": "A" | "B" | "equal",
  "summary": "<2-3 sentence objective comparison>",
  "score_gap": {s_a - s_b}
}}
No markdown, valid JSON only.
"""
            result = gl.nondet.exec_prompt(prompt)
            parsed = json.loads(_extract_json(result))
            return {
                "better_performer": parsed.get("better_performer", "equal"),
                "summary": parsed.get("summary", ""),
            }

        def validator_fn(leader_result: gl.vm.Result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            return bool(leader_result.calldata.get("summary", "").strip())

        result = gl.vm.run_nondet(leader_fn, validator_fn)

        comp_id = self.comparison_count
        comp = ComparisonEntry(
            entry_id=comp_id,
            project_a=project_a,
            project_b=project_b,
            verdict_a=verdict_a,
            verdict_b=verdict_b,
            score_a=u256(score_a),
            score_b=u256(score_b),
            comparison_summary=result.get("summary", ""),
            timestamp=gl.message_raw["datetime"],
        )
        self.comparisons[comp_id] = comp
        self.comparison_count = u256(int(self.comparison_count) + 1)

    @gl.public.write
    def archive(self, entry_id: int):
        """Soft-archive an audit entry. Does not delete — immutable log."""
        self._only_admin()
        idx = u256(entry_id)
        if idx not in self.entries:
            raise Exception("Entry not found")
        self.archived_entries[idx] = True

    @gl.public.write
    def add_admin(self, address: str):
        self._only_admin()
        self.admins.append(Address(address))

    # ─────────────────────────────────────────────
    # Views
    # ─────────────────────────────────────────────

    @gl.public.view
    def get_entries(self, limit: int) -> str:
        result = []
        total = int(self.entry_count)
        # Return most recent first
        start = max(0, total - limit)
        for i in range(total - 1, start - 1, -1):
            idx = u256(i)
            if idx in self.entries:
                entry = self.entries[idx]
                if not self.archived_entries.get(idx, False):
                    result.append(entry.to_dict())
        return json.dumps(result)

    @gl.public.view
    def get_entries_by_project(self, project_contract: str, limit: int) -> str:
        id_list = self.entries_by_project.get(project_contract, None)
        if id_list is None:
            return json.dumps([])
        result = []
        count = 0
        # Reverse: most recent first
        length = len(id_list)
        for i in range(length - 1, -1, -1):
            if count >= limit:
                break
            entry_id = id_list[i]
            if entry_id in self.entries:
                entry = self.entries[entry_id]
                if not self.archived_entries.get(entry_id, False):
                    result.append(entry.to_dict())
                    count += 1
        return json.dumps(result)

    @gl.public.view
    def get_entry(self, entry_id: int) -> str:
        idx = u256(entry_id)
        if idx not in self.entries:
            return json.dumps({"error": "Entry not found"})
        return json.dumps(self.entries[idx].to_dict())

    @gl.public.view
    def get_comparisons(self, limit: int) -> str:
        result = []
        total = int(self.comparison_count)
        start = max(0, total - limit)
        for i in range(total - 1, start - 1, -1):
            idx = u256(i)
            if idx in self.comparisons:
                result.append(self.comparisons[idx].to_dict())
        return json.dumps(result)

    @gl.public.view
    def get_stats(self) -> str:
        passed = 0
        failed = 0
        partial = 0
        for i in range(int(self.entry_count)):
            idx = u256(i)
            if idx in self.entries and not self.archived_entries.get(idx, False):
                v = self.entries[idx].verdict
                if v == "passed":
                    passed += 1
                elif v == "failed":
                    failed += 1
                elif v == "partial":
                    partial += 1
        return json.dumps({
            "total_entries": str(self.entry_count),
            "total_comparisons": str(self.comparison_count),
            "passed": str(passed),
            "failed": str(failed),
            "partial": str(partial),
        })

    @gl.public.view
    def get_verdicts_by_type(self, verdict_type: str, limit: int) -> str:
        result = []
        count = 0
        for i in range(int(self.entry_count) - 1, -1, -1):
            if count >= limit:
                break
            idx = u256(i)
            if idx in self.entries:
                entry = self.entries[idx]
                if entry.verdict == verdict_type and not self.archived_entries.get(idx, False):
                    result.append(entry.to_dict())
                    count += 1
        return json.dumps(result)

    def _only_admin(self):
        if gl.message.sender_address not in self.admins:
            raise Exception("Only admin can call this")


def _extract_json(s: str) -> str:
    start = s.find("{")
    end = s.rfind("}")
    if start != -1 and end != -1 and start < end:
        return s[start:end + 1]
    return "{}"
