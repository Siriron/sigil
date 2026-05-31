# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass
import json


@allow_storage
@dataclass
class ProjectEntry:
    owner: Address
    contract: Address
    project_name: str
    registered_at: str
    milestone_count: u256
    passed_count: u256
    failed_count: u256
    partial_count: u256

    def to_dict(self):
        total = int(self.passed_count) + int(self.failed_count) + int(self.partial_count)
        completion_rate = (int(self.passed_count) * 100 // total) if total > 0 else 0
        return {
            "owner": self.owner.as_hex,
            "contract": self.contract.as_hex,
            "project_name": self.project_name,
            "registered_at": self.registered_at,
            "milestone_count": str(self.milestone_count),
            "passed_count": str(self.passed_count),
            "failed_count": str(self.failed_count),
            "partial_count": str(self.partial_count),
            "completion_rate": str(completion_rate),
        }


@allow_storage
@dataclass
class MilestoneEntry:
    project_contract: Address
    milestone_id: u256
    title: str
    last_verdict: str
    last_score: u256
    updated_at: str

    def to_dict(self):
        return {
            "project_contract": self.project_contract.as_hex,
            "milestone_id": str(self.milestone_id),
            "title": self.title,
            "last_verdict": self.last_verdict,
            "last_score": str(self.last_score),
            "updated_at": self.updated_at,
        }


class ProjectRegistry(gl.Contract):
    admins: DynArray[Address]

    # project contract address → ProjectEntry
    projects: TreeMap[Address, ProjectEntry]

    # owner address → list of project contract addresses (as hex strings)
    projects_by_owner: TreeMap[Address, DynArray[str]]

    # project contract → milestone_id → MilestoneEntry
    milestones: TreeMap[Address, TreeMap[u256, MilestoneEntry]]

    # total counts
    total_projects: u256
    total_verifications: u256

    def __init__(self):
        self.admins.append(gl.message.sender_address)
        self.total_projects = u256(0)
        self.total_verifications = u256(0)

    # ─────────────────────────────────────────────
    # Called by MilestoneContract instances
    # ─────────────────────────────────────────────

    @gl.public.write
    def register_project(
        self,
        owner_address: str,
        project_name: str,
    ):
        """
        Called by the backend after deploying a MilestoneContract.
        Sender IS the MilestoneContract address.
        """
        contract_addr = gl.message.sender_address
        owner_addr = Address(owner_address)

        entry = ProjectEntry(
            owner=owner_addr,
            contract=contract_addr,
            project_name=project_name,
            registered_at=gl.message_raw["datetime"],
            milestone_count=u256(0),
            passed_count=u256(0),
            failed_count=u256(0),
            partial_count=u256(0),
        )
        self.projects[contract_addr] = entry

        # Index by owner
        owner_list = self.projects_by_owner.get_or_insert_default(owner_addr)
        owner_list.append(contract_addr.as_hex)

        self.total_projects = u256(int(self.total_projects) + 1)

    @gl.public.write
    def register_milestone(
        self,
        owner_address: str,
        milestone_id: int,
        title: str,
    ):
        """Called by MilestoneContract.add_milestone()."""
        contract_addr = gl.message.sender_address
        if contract_addr not in self.projects:
            return  # silently skip unregistered contracts

        project = self.projects[contract_addr]
        project.milestone_count = u256(int(project.milestone_count) + 1)
        self.projects[contract_addr] = project

        idx = u256(milestone_id)
        entry = MilestoneEntry(
            project_contract=contract_addr,
            milestone_id=idx,
            title=title,
            last_verdict="pending",
            last_score=u256(0),
            updated_at=gl.message_raw["datetime"],
        )
        contract_milestones = self.milestones.get_or_insert_default(contract_addr)
        contract_milestones[idx] = entry

    @gl.public.write
    def record_verdict(
        self,
        caller_address: str,
        milestone_id: int,
        verdict: str,
        score: int,
    ):
        """Called by MilestoneContract.verify() after consensus."""
        contract_addr = gl.message.sender_address
        if contract_addr not in self.projects:
            return

        project = self.projects[contract_addr]
        idx = u256(milestone_id)
        now = gl.message_raw["datetime"]

        # Update milestone entry
        contract_milestones = self.milestones.get_or_insert_default(contract_addr)
        if idx in contract_milestones:
            m = contract_milestones[idx]
            m.last_verdict = verdict
            m.last_score = u256(score)
            m.updated_at = now
            contract_milestones[idx] = m

        # Update project counters
        if verdict == "passed":
            project.passed_count = u256(int(project.passed_count) + 1)
        elif verdict == "failed":
            project.failed_count = u256(int(project.failed_count) + 1)
        elif verdict == "partial":
            project.partial_count = u256(int(project.partial_count) + 1)

        self.projects[contract_addr] = project
        self.total_verifications = u256(int(self.total_verifications) + 1)

    # ─────────────────────────────────────────────
    # Admin
    # ─────────────────────────────────────────────

    @gl.public.write
    def add_admin(self, address: str):
        self._only_admin()
        self.admins.append(Address(address))

    @gl.public.write
    def remove_project(self, contract_address: str):
        self._only_admin()
        addr = Address(contract_address)
        if addr in self.projects:
            del self.projects[addr]

    # ─────────────────────────────────────────────
    # Views
    # ─────────────────────────────────────────────

    @gl.public.view
    def get_projects(self, limit: int) -> str:
        result = []
        count = 0
        for k, v in self.projects.items():
            if count >= limit:
                break
            result.append(v.to_dict())
            count += 1
        return json.dumps(result)

    @gl.public.view
    def get_projects_by_score(self, limit: int) -> str:
        """Return top projects sorted by completion rate descending."""
        all_projects = []
        for k, v in self.projects.items():
            all_projects.append(v)

        def completion_rate(p):
            total = int(p.passed_count) + int(p.failed_count) + int(p.partial_count)
            return (int(p.passed_count) * 100 // total) if total > 0 else 0

        sorted_projects = sorted(all_projects, key=completion_rate, reverse=True)[:limit]
        return json.dumps([p.to_dict() for p in sorted_projects])

    @gl.public.view
    def get_project(self, contract_address: str) -> str:
        addr = Address(contract_address)
        if addr not in self.projects:
            return json.dumps({"error": "Project not found"})
        return json.dumps(self.projects[addr].to_dict())

    @gl.public.view
    def get_my_projects(self) -> str:
        owner = gl.message.sender_address
        owner_list = self.projects_by_owner.get(owner, None)
        if owner_list is None:
            return json.dumps([])
        result = []
        for hex_addr in owner_list:
            addr = Address(hex_addr)
            if addr in self.projects:
                result.append(self.projects[addr].to_dict())
        return json.dumps(result)

    @gl.public.view
    def get_milestones(self, contract_address: str) -> str:
        addr = Address(contract_address)
        contract_milestones = self.milestones.get(addr, None)
        if contract_milestones is None:
            return json.dumps([])
        result = []
        for k, v in contract_milestones.items():
            result.append(v.to_dict())
        return json.dumps(result)

    @gl.public.view
    def get_stats(self) -> str:
        return json.dumps({
            "total_projects": str(self.total_projects),
            "total_verifications": str(self.total_verifications),
        })

    @gl.public.view
    def get_recent_verdicts(self, limit: int) -> str:
        """Return recently verified milestones across all projects."""
        all_milestones = []
        for contract_addr, contract_milestones in self.milestones.items():
            for mid, m in contract_milestones.items():
                if m.last_verdict != "pending":
                    all_milestones.append(m)

        sorted_milestones = sorted(
            all_milestones,
            key=lambda m: m.updated_at,
            reverse=True,
        )[:limit]
        return json.dumps([m.to_dict() for m in sorted_milestones])

    def _only_admin(self):
        if gl.message.sender_address not in self.admins:
            raise Exception("Only admin can call this")
