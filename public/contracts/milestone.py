# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass
from datetime import datetime, timezone
import json


@allow_storage
@dataclass
class EvidenceItem:
    url: str
    description: str

    def to_dict(self):
        return {
            "url": self.url,
            "description": self.description,
        }


@allow_storage
@dataclass
class VerificationSnapshot:
    verdict: str          # "passed" | "failed" | "partial"
    score: u256           # 0-100
    reasoning: str
    timestamp: str
    verified_by: str      # address of caller

    def to_dict(self):
        return {
            "verdict": self.verdict,
            "score": str(self.score),
            "reasoning": self.reasoning,
            "timestamp": self.timestamp,
            "verified_by": self.verified_by,
        }


@allow_storage
@dataclass
class MilestoneData:
    title: str
    criteria: str
    deadline: str
    is_active: bool
    is_flagged: bool
    is_archived: bool
    last_verdict: str
    last_score: u256
    last_reasoning: str
    verification_count: u256
    snapshots: DynArray[VerificationSnapshot]

    def to_dict(self):
        return {
            "title": self.title,
            "criteria": self.criteria,
            "deadline": self.deadline,
            "is_active": str(self.is_active),
            "is_flagged": str(self.is_flagged),
            "is_archived": str(self.is_archived),
            "last_verdict": self.last_verdict,
            "last_score": str(self.last_score),
            "last_reasoning": self.last_reasoning,
            "verification_count": str(self.verification_count),
        }


class MilestoneContract(gl.Contract):
    # Identity
    registry: Address
    owner: Address
    project_name: str
    project_description: str

    # Milestone state
    milestones: TreeMap[u256, MilestoneData]
    milestone_count: u256

    # Evidence per milestone
    evidence: TreeMap[u256, DynArray[EvidenceItem]]

    # Audit log contract
    auditlog: Address

    # Bridge / treasury (same pattern as questera)
    bridge_out: Address
    treasury: str          # EVM escrow address (hex string)
    relayer: Address

    # Meta
    created_at: str
    last_updated: str

    def __init__(
        self,
        registry_address: str,
        auditlog_address: str,
        owner_address: str,
        project_name: str,
        project_description: str,
        bridge_out_address: str,
        treasury_address: str,
        relayer_address: str,
    ):
        self.registry = Address(registry_address)
        self.auditlog = Address(auditlog_address)
        self.owner = Address(owner_address)
        self.project_name = project_name
        self.project_description = project_description
        self.bridge_out = Address(bridge_out_address)
        self.treasury = treasury_address
        self.relayer = Address(relayer_address)
        self.milestone_count = u256(0)
        self.created_at = gl.message_raw["datetime"]
        self.last_updated = gl.message_raw["datetime"]

    # ─────────────────────────────────────────────
    # Owner / Admin
    # ─────────────────────────────────────────────

    @gl.public.write
    def add_milestone(
        self,
        title: str,
        criteria: str,
        deadline: str,
        evidence_urls: list,
        evidence_descriptions: list,
    ):
        self._only_owner()
        idx = self.milestone_count
        self.milestones[idx] = MilestoneData(
            title=title,
            criteria=criteria,
            deadline=deadline,
            is_active=True,
            is_flagged=False,
            is_archived=False,
            last_verdict="pending",
            last_score=u256(0),
            last_reasoning="",
            verification_count=u256(0),
            snapshots=DynArray[VerificationSnapshot](),
        )
        items = DynArray[EvidenceItem]()
        for i in range(len(evidence_urls)):
            desc = evidence_descriptions[i] if i < len(evidence_descriptions) else ""
            items.append(EvidenceItem(url=evidence_urls[i], description=desc))
        self.evidence[idx] = items
        self.milestone_count = u256(int(self.milestone_count) + 1)
        self.last_updated = gl.message_raw["datetime"]

        # Register in registry
        registry_contract = gl.get_contract_at(self.registry)
        registry_contract.emit().register_milestone(
            gl.message.sender_address.as_hex,
            int(idx),
            title,
        )

    @gl.public.write
    def update_evidence(
        self,
        milestone_id: int,
        evidence_urls: list,
        evidence_descriptions: list,
    ):
        self._only_owner()
        idx = u256(milestone_id)
        if idx not in self.milestones:
            raise Exception("Milestone not found")
        items = DynArray[EvidenceItem]()
        for i in range(len(evidence_urls)):
            desc = evidence_descriptions[i] if i < len(evidence_descriptions) else ""
            items.append(EvidenceItem(url=evidence_urls[i], description=desc))
        self.evidence[idx] = items
        self.last_updated = gl.message_raw["datetime"]

    # ─────────────────────────────────────────────
    # Core AI Verification
    # ─────────────────────────────────────────────

    @gl.public.write
    def verify(self, milestone_id: int):
        """
        Fetches all evidence URLs for this milestone, evaluates them against
        the criteria using GenLayer AI validators, and stores the verdict.
        """
        idx = u256(milestone_id)
        if idx not in self.milestones:
            raise Exception("Milestone not found")
        milestone = self.milestones[idx]
        if milestone.is_archived:
            raise Exception("Milestone is archived")
        if not milestone.is_active:
            raise Exception("Milestone is not active")

        evidence_list = self.evidence.get(idx, DynArray[EvidenceItem]())
        if len(evidence_list) == 0:
            raise Exception("No evidence submitted yet")

        criteria = milestone.criteria
        title = milestone.title
        evidence_data = []
        for item in evidence_list:
            evidence_data.append({"url": item.url, "description": item.description})

        def leader_fn():
            # Fetch each evidence URL independently
            fetched = []
            for item in evidence_data:
                url = item["url"]
                desc = item["description"]
                try:
                    resp = gl.nondet.web.request(url, method="GET")
                    if resp.status_code < 400:
                        content = resp.body.decode("utf-8")[:3000]
                        fetched.append({
                            "url": url,
                            "description": desc,
                            "status": "ok",
                            "content_preview": content,
                        })
                    else:
                        fetched.append({
                            "url": url,
                            "description": desc,
                            "status": f"http_{resp.status_code}",
                            "content_preview": "",
                        })
                except Exception:
                    fetched.append({
                        "url": url,
                        "description": desc,
                        "status": "unreachable",
                        "content_preview": "",
                    })

            evidence_summary = json.dumps(fetched, ensure_ascii=False)

            prompt = f"""You are an objective milestone verification AI for a decentralized grant platform.

MILESTONE TITLE: {title}

SUCCESS CRITERIA:
{criteria}

SUBMITTED EVIDENCE:
{evidence_summary}

TASK:
Evaluate whether the submitted evidence satisfies the success criteria.
For each piece of evidence, assess if it demonstrates the required deliverable.

Return ONLY valid JSON with exactly these fields:
{{
  "verdict": "passed" | "failed" | "partial",
  "score": <integer 0-100>,
  "reasoning": "<2-4 sentence explanation referencing specific evidence>",
  "evidence_assessment": [
    {{"url": "<url>", "meets_criteria": true|false, "note": "<brief note>"}}
  ]
}}

Rules:
- "passed": score >= 75 AND all critical criteria are demonstrably met
- "partial": score 40-74, some criteria met but gaps exist
- "failed": score < 40 OR critical criteria clearly unmet OR evidence unreachable
- If evidence URLs are unreachable, that is a strong negative signal
- Be strict. A grant program depends on accurate verdicts.
- Output must be valid JSON only, no markdown, no preamble.
"""
            result = gl.nondet.exec_prompt(prompt)
            parsed = json.loads(_extract_json(result))
            # Return only stable derived fields for consensus
            return {
                "verdict": parsed["verdict"],
                "score": int(parsed["score"]),
                "reasoning": parsed["reasoning"],
            }

        def validator_fn(leader_result: gl.vm.Result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            leader = leader_result.calldata
            my_result = leader_fn()
            # Consensus: verdict must match, score within 20 points
            verdict_match = leader["verdict"] == my_result["verdict"]
            score_close = abs(leader["score"] - my_result["score"]) <= 20
            return verdict_match and score_close

        result = gl.vm.run_nondet(leader_fn, validator_fn)

        verdict = result["verdict"]
        score = u256(result["score"])
        reasoning = result["reasoning"]
        now = gl.message_raw["datetime"]
        caller = gl.message.sender_address.as_hex

        # All storage writes outside nondet block
        milestone.last_verdict = verdict
        milestone.last_score = score
        milestone.last_reasoning = reasoning
        milestone.verification_count = u256(int(milestone.verification_count) + 1)
        snapshot = VerificationSnapshot(
            verdict=verdict,
            score=score,
            reasoning=reasoning,
            timestamp=now,
            verified_by=caller,
        )
        milestone.snapshots.append(snapshot)
        self.milestones[idx] = milestone
        self.last_updated = now

        # Notify registry
        registry_contract = gl.get_contract_at(self.registry)
        registry_contract.emit().record_verdict(
            gl.message.sender_address.as_hex,
            int(idx),
            verdict,
            int(score),
        )

        # Log to global audit trail
        if self.auditlog != Address("0x0000000000000000000000000000000000000000"):
            auditlog_contract = gl.get_contract_at(self.auditlog)
            auditlog_contract.emit().log_verdict(
                gl.message.sender_address.as_hex,
                self.project_name,
                self.project_name,
                int(idx),
                milestone.title,
                verdict,
                int(score),
                reasoning,
                caller,
            )

        # If passed: signal treasury on EVM via bridge
        if verdict == "passed" and self.treasury and self.bridge_out != Address("0x0000000000000000000000000000000000000000"):
            message = json.dumps({
                "milestone_id": int(idx),
                "verdict": verdict,
                "score": int(score),
                "project": self.project_name,
            })
            bridge_contract = gl.get_contract_at(self.bridge_out)
            bridge_contract.emit().send_message(
                40245,  # Base Sepolia chain id
                self.treasury,
                message.encode(),
            )

    @gl.public.write
    def refresh(self, milestone_id: int):
        """Re-run verification with current evidence state. Alias for verify."""
        self.verify(milestone_id)

    @gl.public.write
    def analyze(self, milestone_id: int, analysis_question: str):
        """
        Run a focused AI analysis on a milestone — e.g. 'What specific gaps remain?'
        Stores reasoning as a new snapshot tagged 'analysis'.
        """
        idx = u256(milestone_id)
        if idx not in self.milestones:
            raise Exception("Milestone not found")
        milestone = self.milestones[idx]
        evidence_list = self.evidence.get(idx, DynArray[EvidenceItem]())
        criteria = milestone.criteria
        title = milestone.title
        last_verdict = milestone.last_verdict
        last_reasoning = milestone.last_reasoning
        evidence_data = [{"url": e.url, "description": e.description} for e in evidence_list]
        question = analysis_question

        def leader_fn():
            fetched = []
            for item in evidence_data:
                try:
                    resp = gl.nondet.web.request(item["url"], method="GET")
                    content = resp.body.decode("utf-8")[:2000] if resp.status_code < 400 else ""
                    fetched.append({"url": item["url"], "content": content})
                except Exception:
                    fetched.append({"url": item["url"], "content": ""})

            prompt = f"""You are an expert technical analyst reviewing a grant milestone.

MILESTONE: {title}
CRITERIA: {criteria}
LAST VERDICT: {last_verdict}
LAST REASONING: {last_reasoning}
EVIDENCE (fetched): {json.dumps(fetched)[:2000]}

ANALYSIS QUESTION: {question}

Provide a focused, specific answer to the analysis question based on the evidence.
Return ONLY valid JSON:
{{
  "analysis": "<your detailed analysis, 3-6 sentences>",
  "gaps": ["<gap 1>", "<gap 2>"],
  "recommendations": ["<rec 1>", "<rec 2>"]
}}
No markdown, no preamble, valid JSON only.
"""
            result = gl.nondet.exec_prompt(prompt)
            parsed = json.loads(_extract_json(result))
            return {
                "analysis": parsed.get("analysis", ""),
                "gaps": parsed.get("gaps", []),
            }

        def validator_fn(leader_result: gl.vm.Result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            # Non-comparative: validator just checks the leader produced a non-empty analysis
            return bool(leader_result.calldata.get("analysis", "").strip())

        result = gl.vm.run_nondet(leader_fn, validator_fn)

        now = gl.message_raw["datetime"]
        caller = gl.message.sender_address.as_hex
        analysis_text = result.get("analysis", "")
        gaps = result.get("gaps", [])
        summary = f"[ANALYSIS] Q: {question} | A: {analysis_text} | Gaps: {', '.join(gaps)}"

        snapshot = VerificationSnapshot(
            verdict="analysis",
            score=u256(0),
            reasoning=summary,
            timestamp=now,
            verified_by=caller,
        )
        milestone.snapshots.append(snapshot)
        self.milestones[idx] = milestone
        self.last_updated = now

    @gl.public.write
    def compare(self, milestone_id_a: int, milestone_id_b: int):
        """
        Compare two milestones' current evidence and verdicts.
        Stores a comparison snapshot on milestone_a.
        """
        idx_a = u256(milestone_id_a)
        idx_b = u256(milestone_id_b)
        if idx_a not in self.milestones or idx_b not in self.milestones:
            raise Exception("One or both milestones not found")

        m_a = self.milestones[idx_a]
        m_b = self.milestones[idx_b]
        summary_a = {
            "title": m_a.title,
            "verdict": m_a.last_verdict,
            "score": int(m_a.last_score),
        }
        summary_b = {
            "title": m_b.title,
            "verdict": m_b.last_verdict,
            "score": int(m_b.last_score),
        }
        data_a = json.dumps(summary_a)
        data_b = json.dumps(summary_b)

        def leader_fn():
            prompt = f"""Compare two grant milestones and return a structured comparison.

MILESTONE A: {data_a}
MILESTONE B: {data_b}

Return ONLY valid JSON:
{{
  "stronger": "A" | "B" | "equal",
  "comparison": "<2-3 sentence comparison>",
  "score_delta": <integer, A_score minus B_score>
}}
No markdown, valid JSON only.
"""
            result = gl.nondet.exec_prompt(prompt)
            parsed = json.loads(_extract_json(result))
            return {
                "stronger": parsed.get("stronger", "equal"),
                "comparison": parsed.get("comparison", ""),
            }

        def validator_fn(leader_result: gl.vm.Result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            return bool(leader_result.calldata.get("comparison", "").strip())

        result = gl.vm.run_nondet(leader_fn, validator_fn)

        now = gl.message_raw["datetime"]
        caller = gl.message.sender_address.as_hex
        comparison_text = result.get("comparison", "")
        stronger = result.get("stronger", "equal")
        summary = f"[COMPARE] vs milestone {milestone_id_b} | Stronger: {stronger} | {comparison_text}"

        snapshot = VerificationSnapshot(
            verdict="compare",
            score=u256(0),
            reasoning=summary,
            timestamp=now,
            verified_by=caller,
        )
        m_a.snapshots.append(snapshot)
        self.milestones[idx_a] = m_a
        self.last_updated = now

    @gl.public.write
    def flag(self, milestone_id: int, reason: str):
        """Mark a milestone as flagged for manual review."""
        idx = u256(milestone_id)
        if idx not in self.milestones:
            raise Exception("Milestone not found")
        milestone = self.milestones[idx]
        milestone.is_flagged = True
        now = gl.message_raw["datetime"]
        caller = gl.message.sender_address.as_hex
        snapshot = VerificationSnapshot(
            verdict="flagged",
            score=u256(0),
            reasoning=f"Flagged by {caller}: {reason}",
            timestamp=now,
            verified_by=caller,
        )
        milestone.snapshots.append(snapshot)
        self.milestones[idx] = milestone
        self.last_updated = now

    @gl.public.write
    def archive(self, milestone_id: int):
        """Close a milestone permanently. Only owner."""
        self._only_owner()
        idx = u256(milestone_id)
        if idx not in self.milestones:
            raise Exception("Milestone not found")
        milestone = self.milestones[idx]
        milestone.is_archived = True
        milestone.is_active = False
        now = gl.message_raw["datetime"]
        snapshot = VerificationSnapshot(
            verdict="archived",
            score=u256(0),
            reasoning="Milestone archived by project owner.",
            timestamp=now,
            verified_by=gl.message.sender_address.as_hex,
        )
        milestone.snapshots.append(snapshot)
        self.milestones[idx] = milestone
        self.last_updated = now

    # ─────────────────────────────────────────────
    # Views
    # ─────────────────────────────────────────────

    @gl.public.view
    def get_project(self) -> str:
        return json.dumps({
            "project_name": self.project_name,
            "project_description": self.project_description,
            "owner": self.owner.as_hex,
            "milestone_count": str(self.milestone_count),
            "created_at": self.created_at,
            "last_updated": self.last_updated,
            "treasury": self.treasury,
        })

    @gl.public.view
    def get_milestone(self, milestone_id: int) -> str:
        idx = u256(milestone_id)
        if idx not in self.milestones:
            return json.dumps({"error": "Milestone not found"})
        m = self.milestones[idx]
        evidence_list = self.evidence.get(idx, DynArray[EvidenceItem]())
        snapshots = [s.to_dict() for s in m.snapshots]
        evidence_out = [e.to_dict() for e in evidence_list]
        result = m.to_dict()
        result["evidence"] = evidence_out
        result["snapshots"] = snapshots
        return json.dumps(result)

    @gl.public.view
    def get_all_milestones(self) -> str:
        result = []
        for i in range(int(self.milestone_count)):
            idx = u256(i)
            if idx in self.milestones:
                m = self.milestones[idx]
                d = m.to_dict()
                d["id"] = str(i)
                result.append(d)
        return json.dumps(result)

    @gl.public.view
    def get_snapshots(self, milestone_id: int) -> str:
        idx = u256(milestone_id)
        if idx not in self.milestones:
            return json.dumps([])
        m = self.milestones[idx]
        return json.dumps([s.to_dict() for s in m.snapshots])

    # ─────────────────────────────────────────────
    # Guards
    # ─────────────────────────────────────────────

    def _only_owner(self):
        if gl.message.sender_address != self.owner:
            raise Exception("Only project owner can call this")


def _extract_json(s: str) -> str:
    start = s.find("{")
    end = s.rfind("}")
    if start != -1 and end != -1 and start < end:
        return s[start:end + 1]
    return "{}"
