# Technical Audit Report Template — Delphi Systems
## Complete structure with 15 sections

> English version. The pt-BR original lives in `estrutura-laudo.md`. Use the version that matches the user's selected output language.

---

## Section 1 — System Identification

| Field | Value |
|---|---|
| **Company** | [Company name] |
| **System** | [System / product name] |
| **Analyzed version** | [System version] |
| **Type** | Sample-based Technical Audit |
| **Date** | [Audit date] |
| **Professional** | [Name], Delphi Specialist |
| **Objective** | Analyze and detect potential bugs and bad practices in the source code. Suggest changes and improvements. |

**Execution:** Describe how source-code access was obtained (VPN, GitHub, files sent over) and the Delphi version used to open it.

---

## Section 2 — Executive Summary

Objective paragraph (one page maximum) aimed at non-technical managers.

Must contain:
- Purpose of the audit
- Main problem found (in business language)
- Risk to the business if not addressed
- Primary recommendation
- Overall score (e.g., 🟠 CRITICAL — 2.3/5.0)

---

## Section 3 — Scope of the Analysis

List:
- Files analyzed (indicate which were recommended by the client and which were chosen by the analyst)
- What was NOT analyzed and why
- Methodology used (sampling, static analysis, guided reading)

---

## Section 4 — Technology Environment

| Item | Detail |
|---|---|
| **Language** | Delphi [version] |
| **IDE** | RAD Studio [version] |
| **Database** | [Firebird / Oracle / MSSQL / etc.] |
| **Data Access Component** | [BDE / FireDAC / Zeos / FIB / etc.] — [status: ❌ / ⚠️ / ✅] |
| **Architecture** | [Client/Server / N-Tier / REST / etc.] |
| **Third-party Components** | [DevExpress, FastReport, ACBr, etc.] |
| **Total Units** | [number] |
| **Total Forms** | [number] |
| **Total Lines (estimated)** | [number] |

---

## Section 5 — Architecture Analysis

### 5.1 Architectural Pattern Identified

Describe how the system is organized (e.g., Client/Server with direct connection Form → DataModule → DB).

### 5.2 Assessment

Evaluate:
- Separation of concerns (View / Business / Data)
- Use of DataModules as the data layer
- Presence/absence of service layers and repositories
- Organization of units by module
- SQL centralized or scattered

### 5.3 Architectural Points of Attention

List the critical issues found, with examples.

**Architecture Score:** [1–5]

---

## Section 6 — Code Quality (Clean Code + Style Guide)

### 6.1 Naming and Conventions

Evaluate:
- Variable prefixes (L, F, A, C_)
- Parameter prefixes (A vs p — wrong convention)
- Component naming
- Cryptic / unreadable abbreviations
- Use of CamelCase

For each item: show a real example found and a suggested improvement.

### 6.2 Formatting and Organization

- Indentation (2 spaces vs TAB)
- Line breaks in `uses` and variable declarations
- Use of `begin`/`end` and `else`
- Operator alignment

### 6.3 Comments

- Excessive comments explaining "how"
- Commented-out dead code
- Missing comments on complex business rules

### 6.4 Use of Forbidden Commands

| Command | Occurrences | Severity |
|---|---|---|
| `with` | [n] | ⚠️ / 🚨 |
| `Break` in loops | [n] | ⚠️ |
| `Continue` | [n] | ⚠️ |
| `RecordCount` | [n] | ⚠️ / 🚨 |
| `Locate` | [n] | ⚠️ |

**Clean Code Score:** [1–5]

---

## Section 7 — Code Smells Detected

For each Code Smell found:

### [Code Smell Name]

**Brief definition:** ...

**Examples found:**
```pascal
// Real code from the project
```

**Estimated occurrences:** [n]

**Impact:** High / Medium / Low

**Recommendation:** ...

---

Mandatory items to list when present:
- Long Methods (with name and line count)
- God Classes / God Methods
- Long Parameter List / Polyadic methods (with real examples)
- Duplicate Code
- Dead Code
- Primitive Obsession
- Cyclomatic Complexity
- RecordCount (with total project count)
- Locate (with total count)

**Code Smells Score:** [1–5]

---

## Section 8 — Security

### 8.1 Authentication and Access Control

- Is there a login system? How robust?
- Profile / permission control?

### 8.2 Sensitive Data

- Hardcoded credentials in source (e.g., DB password)?
- `.ini`/`.cfg` files with cleartext passwords?
- Exposed API keys?

### 8.3 SQL Injection

- SQL concatenated with user input?
- Use of `:param` parameters or direct concatenation?

### 8.4 Audit Logs

- Is there traceability of user actions?

**Security Score:** [1–5]

---

## Section 9 — Risks and Vulnerabilities

Consolidated risk table:

| Risk | Severity | Likelihood | Business Impact |
|---|---|---|---|
| [Description] | High / Medium / Low | High / Medium / Low | [Description] |

---

## Section 10 — Positive Points

Genuinely list what is done well. Common examples:
- Use of modern components (FireDAC, up-to-date FastReport)
- Exception handling present in critical areas
- Some module-based organization already implemented
- Up-to-date ACBr for fiscal operations
- Documented manual tests

---

## Section 11 — Consolidated Critical Points

List of the 5–10 most serious issues with priority:

| # | Problem | Severity | Location |
|---|---|---|---|
| 1 | [Description] | 🚨 Critical | [Unit / Form] |
| 2 | ... | ⚠️ High | ... |

---

## Section 12 — Recommendations

### 12.1 Immediate (Current Sprint)
Urgent actions that can be taken now with immediate impact.

### 12.2 Short Term (1–3 months)
Priority refactorings.

### 12.3 Medium Term (3–12 months)
Progressive architectural modernization.

### 12.4 Strategic (12+ months)
Long-term architectural decisions (technology migration, partial rewrite, etc.).

**Recommended tools:**
- **Refactoring > Extract Method** — to break up Long Methods
- **Refactoring > Rename** — to rename variables / methods across the project automatically
- **Refactoring > Extract Class** — to split God Classes
- **CnPack (CnWizards)** — to rename components automatically when dropped on a Form

---

## Section 13 — Modernization Effort Estimate

See `estimativas-modernizacao.md` for formulas and risk factors.

| Action | Priority | Complexity | Estimate |
|---|---|---|---|
| Migrate BDE to FireDAC | High | High | X days |
| Rename variables / methods (Style Guide) | Medium | Low | X days |
| Refactor priority Long Methods | High | High | X days |
| Centralize SQL in repositories | High | Medium | X days |
| Implement interfaces for decoupling | Medium | High | X days |
| Remove dead code | Low | Low | X days |
| **TOTAL** | | | **X days** |

---

## Section 14 — Overall Classification

| Dimension | Score | Note |
|---|---|---|
| Architecture | [1–5] | |
| Clean Code | [1–5] | |
| Code Smells | [1–5] | |
| Data Access | [1–5] | |
| Security | [1–5] | |
| Maintainability | [1–5] | |
| **AVERAGE** | **[1–5]** | |

**Final Classification:** 🟢 GOOD / 🟡 FAIR / 🟠 CRITICAL / 🔴 NOT VIABLE

---

## Section 15 — Conclusion

Closing paragraph with:
- Synthesis of the main findings
- Positive tone about the potential for improvement
- Availability for deeper engagement
- Call to action (recommended next steps)

Example closing:
> "The system has [X years] of history and has clearly delivered value to the business. The
> challenges identified are common in systems built during this period and are perfectly
> tractable through a progressive modernization plan. We are available to support the team
> on this evolution journey."

---

## Severity Label Mapping (pt-BR ↔ en-US)

When generating output, use the English labels below:

| pt-BR | en-US |
|---|---|
| 🚨 CRÍTICO | 🚨 CRITICAL |
| ⚠️ ATENÇÃO | ⚠️ WARNING |
| 💡 RECOMENDAÇÃO | 💡 RECOMMENDATION |
| 🟢 BOM | 🟢 GOOD |
| 🟡 REGULAR | 🟡 FAIR |
| 🟠 CRÍTICO | 🟠 CRITICAL |
| 🔴 INVIÁVEL | 🔴 NOT VIABLE |
| Excelente / Bom / Aceitável / Crítico / Inviável | Excellent / Good / Acceptable / Critical / Not Viable |
