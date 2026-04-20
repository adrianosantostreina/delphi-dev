# Template: Software Specification Document (SPEC)

> English version. The pt-BR original lives in `spec-template.md`. Use the version that matches the user's selected output language.

---

## SECTION 1 — Project Identification

| Field | Value |
|---|---|
| System Name | |
| Module / Subsystem | |
| SPEC Version | 1.0 |
| Created On | |
| Author | |
| Reviewed By | |
| Status | Draft / In review / Approved |

---

## SECTION 2 — Objective and Scope

### 2.1 Objective
Describe in 2–4 sentences what problem this system / module solves and what the expected outcome is.

### 2.2 In Scope (what is included)
- Item 1
- Item 2

### 2.3 Out of Scope (what is NOT included)
- Item 1
- Item 2

---

## SECTION 3 — Actors and User Profiles

List all users / systems that interact with the software.

| ID | Actor | Description | Permissions |
|---|---|---|---|
| AT-001 | | | |
| AT-002 | | | |

---

## SECTION 4 — Functional Requirements

What the system **must do**. One requirement per row, numbered.

| ID | Description | Priority | Actor | Notes |
|---|---|---|---|---|
| RF-001 | | High / Medium / Low | | |
| RF-002 | | | | |

**Priorities:**
- High: essential for basic operation
- Medium: important but can be delivered in a later phase
- Low: nice-to-have, can be dropped if necessary

---

## SECTION 5 — Non-Functional Requirements

Quality, performance, security, and compliance constraints.

| ID | Category | Description | Acceptance Criterion |
|---|---|---|---|
| RNF-001 | Performance | | |
| RNF-002 | Security | | |
| RNF-003 | Availability | | |
| RNF-004 | Usability | | |
| RNF-005 | Compatibility | | |

**Common categories:** Performance, Security, Availability, Usability, Compatibility,
Maintainability, Scalability, Legal Compliance.

---

## SECTION 6 — Use Cases

### UC-001: [Use Case Name]

| Field | Value |
|---|---|
| ID | UC-001 |
| Name | |
| Primary Actor | |
| Pre-conditions | |
| Post-conditions | |
| Trigger | |

**Main Flow:**
1. Step 1
2. Step 2
3. Step 3

**Alternative Flow:**
- 2a. If [condition]: ...

**Exception Flow:**
- 2b. If [error]: ...

---

## SECTION 7 — User Stories (optional / complementary to use cases)

| ID | As a... | I want... | So that... | Acceptance Criteria |
|---|---|---|---|---|
| US-001 | [actor] | [action] | [benefit] | - [ ] criterion 1 |
| US-002 | | | | |

---

## SECTION 8 — Business Rules

Constraints and policies the system must respect regardless of flow.

| ID | Description | Origin (law / policy / client) |
|---|---|---|
| RN-001 | | |
| RN-002 | | |

---

## SECTION 9 — Screen Flows and Navigation

Describe the screen sequence and transitions. Use ASCII diagrams or a screen list when no wireframe is available.

### Navigation Map

```
[Login Screen]
    └─► [Main Screen]
            ├─► [Module A]
            │       └─► [Registration]
            │               └─► [Confirmation]
            └─► [Module B]
                    └─► [List]
                            └─► [Edit]
```

### Screen Description

#### Screen: [Name]
- **Purpose:** what the user does here
- **Fields:** list of fields with type and required/optional flag
- **Actions:** buttons and their consequences
- **Validations:** screen-level validation rules
- **Related requirements:** RF-001, RN-002

---

## SECTION 10 — Data Model

### 10.1 Main Entities

| Entity | Description | Main Attributes |
|---|---|---|
| | | |

### 10.2 Relationships

```
[Customer] 1 ──── N [Order]
[Order]    1 ──── N [OrderItem]
[OrderItem] N ── 1 [Product]
```

### 10.3 Tables / Data Structures

Describe the database tables or Delphi structures relevant to this module.

---

## SECTION 11 — External Integrations

| ID | External System | Type | Protocol | Direction | Description |
|---|---|---|---|---|---|
| INT-001 | | REST API / WebService / DLL | HTTP / TCP / COM | Inbound / Outbound | |

---

## SECTION 12 — Constraints and Assumptions

### 12.1 Technical Constraints
- Minimum Delphi version: [X]
- Database: [name and version]
- Operating system: [Windows / macOS / mobile]
- Required dependencies: [components, frameworks]

### 12.2 Assumptions
Conditions assumed to be true for this document. If an assumption is invalidated,
the SPEC must be revised.

- Assumption 1
- Assumption 2

---

## SECTION 13 — Global Acceptance Criteria

The system will be considered approved when:

- [ ] All High-priority requirements are implemented and tested
- [ ] All critical use cases run without errors
- [ ] Performance non-functional requirements are met (e.g., response time < 2s)
- [ ] Unit tests cover at least [X]% of the business code
- [ ] Formal approval from the client / product owner

---

## SECTION 14 — Revision History

| Version | Date | Author | Description of Change |
|---|---|---|---|
| 1.0 | | | Initial version |
| 1.1 | | | |
