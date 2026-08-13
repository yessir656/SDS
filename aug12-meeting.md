Safety Data Sheet Centralized System for Chemical Management (SDS-CHEM)
Date: August 12, 2026 		Time: 12:30 NN – 1:40 PM
Attendees
•	Gina Catalan
•	Mary Joy Bautista
•	Eric Casila
•	Shaun Wesley Simbajon
•	MarJames Delimios
•	Jhon Ivan Villegas

1.	Brief Review of the SDS-CHEM Proposal
The meeting started at approximately 12:30 PM. Ms. Gina Catalan presented the updated project background and rationale, highlighting the project's alignment with relevant ISO standards and the updated NSDB framework.
Mr. Eric Casila further clarified the scope and limitations of the proposed SDS-CHEM system. He emphasized that the inventory and management of chemicals/substances currently kept and maintained in MIRDC laboratories are outside the scope of the system.
Mr. Casila also suggested that the integration of Artificial Intelligence (AI) could further enhance the functionality of SDS-CHEM. One potential feature discussed was an AI-powered chatbot capable of answering queries related to chemicals and SDS information and/or providing summaries of information stored in the system.

2.	Design Walkthrough of the Prototype
Jhon Ivan presented the current design prototype of the SDS-CHEM system. The walkthrough demonstrated the system's search and filtering functions, as well as the different sections for displaying chemical information stored in the system.
Ms. Gina Catalan and Ms. Mary Joy Bautista particularly noted the usefulness of the "Emergency" button/section, which could provide readily accessible safety information and appropriate measures during emergencies, hazardous situations, or chemical-related accidents.

3.	Proposed Features and Enhancements
Following the prototype presentation, the participants discussed several features and enhancements that could improve the usability and functionality of the system.

3.1 Emergency Contacts
It was suggested that the Emergency Contact section include the relevant MIRDC office local telephone numbers and designated personnel/units who may be contacted during emergencies. The proposed contacts are:
•	Pollution Control Officer – Ms. Gina Catalan
•	Chemical Spillage Brigade – Ms. Mary Joy Bautista
•	Fire Brigade – BFP Taguig City FTI
•	First Aid Brigade – Ms. Deborah Balota
•	Safety Officer – Engr. Nestor Colibao

3.2 Chemical Classification and Regulatory Tags
The system should include category or classification tags for applicable chemicals like:
•	Controlled/Regulated Chemicals – as regulated by relevant agencies, such as DENR-EMB, PNP, PDEA, and other concerned regulatory agencies
These classification tags should be displayed beside or below the existing Danger/Warning tags of each chemical. It was clarified that these additional classification tags will only apply to chemicals that fall under the corresponding classifications and should not be displayed for all chemicals in the system.

3.3	PPE Requirements
The system should also provide a dedicated section for Personal Protective Equipment (PPE) requirements for each chemical. This is important because different chemicals may require different types of PPE, handling procedures, and safety precautions.

The PPE information may be incorporated within the Emergency section, alongside the other safety measures, or positioned near the Emergency Information button.

4. SDS-CHEM System Management and Administration
The Management Information Systems (MIS) will serve as the Super Administrator of the SDS-CHEM system and will be responsible for maintaining the system's backend, database, and overall functionality.
Upon deployment of the application, designated personnel or representatives from each division should be assigned as system administrators and focal persons. They will be responsible for scanning, maintaining, and updating SDS documents and ensuring that the appropriate documents are uploaded to the system.
For the initial development and testing phase, Jhon Ivan will handle the uploading of a limited number of existing SDS PDF files until the official deployment of the application.

Action Items
•	SDS Requirement for Procurement Documents: Moving forward, Purchase Requests (PRs) and Purchase Orders (POs) involving chemicals or chemical-containing products should be supported by the corresponding Safety Data Sheet (SDS) provided by the seller or manufacturer.
•	Provision of Chemical Classification Lists and Existing SDS Files: Ms. Gina Catalan will provide: A separate list of Controlled/Regulated Chemicals, including the applicable regulatory agency; and several scanned PDF copies of existing SDS documents currently maintained by the MIRDC laboratories.
These materials will be provided to Jhon Ivan for testing and for determining the appropriate approach/workaround for implementing the proposed classifications, tags, and SDS document features in the system.

Prepared by:							Reviewed by:

Shaun Wesley Y. Simbajon					Eric B. Casila
ISA I, PMD-MIS						ISA III, PMD-MIS

---

## Implementation Status (as of last update)

> This addendum is appended below the original meeting record for traceability. The meeting notes above are preserved verbatim — do not edit them. This status section tracks what has been built in response to the meeting, and what has been explicitly deferred.

### §3.1 Emergency Contacts — **DEFERRED**
The August 12 meeting proposed a fixed MIRDC emergency contact list (PCO, Spillage Brigade, Fire Brigade BFP Taguig, First Aid Brigade, Safety Officer). This has **not been implemented**. The existing per-chemical `emergencyContact` field is still in place, but the proposed MIRDC-specific contact directory section is not yet built.

### §3.2 Chemical Classification and Regulatory Tags — **PARTIALLY IMPLEMENTED**
The `regulatoryTags` field exists in `prisma/schema.prisma` (JSON `string[]`, default `"[]"`) and on the TypeScript `Chemical` type. A `RegulatoryTags` component renders them. However, the seed data sets all 14 chemicals to empty arrays, and there is no admin UI to populate the field or filter by it. The DENR-EMB / PNP / PDEA classification lists mentioned in the Action Items have not been provided yet, so the field is structurally ready but unused.

### §3.3 PPE Requirements — **PARTIALLY IMPLEMENTED**
The `personalProtectiveEquipment` field exists on the `Chemical` model (JSON array) and is populated by the AI auto-fill feature (extracted from SDS Section 8). It is displayed in the chemical detail view and in the emergency view. There is **no dedicated PPE section** as proposed in the meeting — PPE is shown alongside other safety information rather than as a standalone section.

### §4 System Management & Administration — **IMPLEMENTED (exceeded scope)**
The meeting specified "MIS will serve as the Super Administrator" and proposed per-division focal persons as administrators. Implementation went further:
- 3-tier role hierarchy: `SUPER_ADMIN` (MIS) > `ADMIN` (focal persons) > `USER` (reserved, cannot sign in)
- SUPER_ADMIN can create / edit / disable / delete admin accounts via the in-app Users tab (no longer requires editing `.env` + re-seeding for new admins)
- Audit log records every chemical / SDS / user / system mutation with actor, before/after JSON, IP, timestamp
- System Settings tab gives SUPER_ADMIN live visibility into AI provider config, storage, database, sync stats, and runtime info
- Password change on next login is enforced (triple-layered) for newly created admins and after password resets

### §4 Initial SDS Upload by Jhon Ivan — **IMPLEMENTED**
14 chemicals are seeded with placeholder SDS PDFs. Admins (including Jhon Ivan's account once provisioned) can upload real SDS PDFs via the SDS tab. The AI auto-fill feature extracts 15 fields from each uploaded PDF.

### Action Items — **EXPLICITLY DEFERRED**
Per current scope decisions, the two Action Items from the meeting are **not implemented** and are not on the near-term roadmap:
1. **SDS Requirement for Procurement Documents** (PRs/POs must be supported by SDS) — this is a procurement-process change, not a software feature. Out of scope for the SDS-CHEM codebase.
2. **Provision of Chemical Classification Lists and Existing SDS Files** — depends on Ms. Gina Catalan providing the controlled/regulated chemicals list and scanned SDS PDFs. Blocked on external input.

### Additional features built (not from this meeting)
- AI auto-fill from PDF (VLM provider abstraction: `zai` sandbox default, `gemini` for local dev)
- Offline-first PWA with delta sync
- Emergency mode (full-screen, offline, context-aware FAB)
- Dark mode, responsive design, accessibility
- 3-tier admin role hierarchy with lockout prevention
- Append-only audit log
- System Settings tab with AI provider test-connection
- Password change on next login (triple-layered enforcement)
