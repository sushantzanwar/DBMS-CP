# ServicePath AI - DBMS Practical Demonstration
## ASSIGNMENT 8: Distributed Databases & Architectural Scalability Study

**Target System**: ServicePath AI B2B Marketplace  
**Document Type**: Engineering Whitepaper & DBMS Viva Study Guide  
**Author**: ServicePath AI Architecture Team

---

## 1. Introduction to Distributed Database Management Systems (DDBMS)

A **Distributed Database Management System (DDBMS)** manages a collection of multiple logically interrelated databases distributed over different physical locations interconnected by a computer network. Unlike a centralized database where all processing and storage reside on a single machine, a DDBMS presents a unified, single-database view to users while partitioning data and computation across independent nodes.

### Centralized vs. Distributed Database Comparison
| Architectural Dimension | Centralized Database (e.g. Single-node MySQL) | Distributed Database (e.g. Google Spanner, CockroachDB) |
|---|---|---|
| **Storage Architecture** | Single local filesystem / block volume | Partitioned across multiple network nodes |
| **Scaling Mechanism** | **Vertical (Scale-Up)**: Add more CPU, RAM, NVMe | **Horizontal (Scale-Out)**: Add more commodity servers |
| **Failure Domain** | Single point of failure (node crash halts system) | High availability via fault-tolerant consensus |
| **Transaction Coordination** | Local OS memory and lock manager | Network consensus protocols (2PC, Paxos, Raft) |
| **Latency Profile** | Sub-millisecond local bus latency | Network transit latency (1ms local DC, 50-100ms global) |

---

## 2. Distributed Database Hardware Architectures

Distributed databases are categorized by how processor nodes share physical hardware:

```
+-----------------------------------------------------------------------------------------+
|                               DISTRIBUTED ARCHITECTURES                                 |
+----------------------------+----------------------------+-------------------------------+
|  1. Shared-Memory (SMP)    |   2. Shared-Disk           |    3. Shared-Nothing (MPP)    |
|                            |                            |                               |
|   [CPU 1] [CPU 2] [CPU 3]  |   [Node 1]     [Node 2]    |   [Node 1]        [Node 2]    |
|       \     |     /        |   (CPU/RAM)   (CPU/RAM)    |   (CPU/RAM/Disk) (CPU/RAM/Disk)|
|        [Common RAM]        |          \     /           |          \       /            |
|             |              |       [SAN / NAS]          |     High-Speed Network        |
|        [Common Disk]       |      (Common Disks)        |     (Independent Nodes)       |
+----------------------------+----------------------------+-------------------------------+
```

1. **Shared-Memory (SMP)**:
   - Multiple CPUs share common physical RAM and disk storage via a shared system bus.
   - *Limitation*: Memory bus contention limits scalability to a maximum of 32–64 cores.
2. **Shared-Disk**:
   - Each compute node has its own private CPU and RAM, but all nodes access a common shared storage array (e.g. Storage Area Network / AWS Aurora storage fleet).
   - *Advantage*: Node failures do not cause data loss; simple scale-out of read replicas.
   - *Limitation*: The shared storage subsystem can become a network throughput bottleneck.
3. **Shared-Nothing (Massively Parallel Processing - MPP)**:
   - Every node possesses its own independent processor, memory, and persistent disk storage. Nodes communicate solely via network message passing.
   - *Advantage*: Near-linear horizontal scaling to hundreds or thousands of nodes. This is the foundation of modern distributed SQL systems.

---

## 3. Data Fragmentation Strategies

**Fragmentation** is the process of partitioning a relational table $R$ into distinct sub-relations $R_1, R_2, \dots, R_n$, which are then distributed across different physical database nodes.

### Types of Fragmentation

#### A. Horizontal Fragmentation (Sharding)
- Rows of table $R$ are divided into subsets based on a predicate condition (selection operation $\sigma_p(R)$).
- **ServicePath AI Scenario**: Partitioning `business` and `request` by geographic jurisdiction:
  - Fragment 1 (West Shard - Mumbai/Pune): $\sigma_{\text{state} = '\text{Maharashtra}'}(\text{business})$
  - Fragment 2 (South Shard - Bengaluru): $\sigma_{\text{state} = '\text{Karnataka}'}(\text{business})$

#### B. Vertical Fragmentation
- Columns of table $R$ are divided into subsets using the projection operation $\pi_{A_1, A_2, \dots}(R)$. Every fragment MUST retain the relation's Primary Key to enable lossless reconstruction.
- **ServicePath AI Scenario**: Separating sensitive corporate credentials from public profiles:
  - Public Profile Fragment: $\pi_{\text{business\_id}, \text{business\_name}, \text{industry}, \text{city}}(\text{business})$
  - Financial/Audit Fragment: $\pi_{\text{business\_id}, \text{revenue\_range}, \text{employees}, \text{email}, \text{phone}}(\text{business})$

#### C. Hybrid / Mixed Fragmentation
- A combination of horizontal and vertical fragmentation (e.g., horizontally fragmenting a vertically fragmented profile by city).

### The Three Correctness Rules of Fragmentation
For any fragmentation scheme to be valid, it must satisfy three formal mathematical properties:

1. **Completeness**: If relation $R$ is decomposed into fragments $R_1, R_2, \dots, R_n$, every data item $d \in R$ must appear in at least one fragment $R_i$. No data may be omitted.
2. **Reconstruction**: It must be possible to define a relational operator to reconstruct the original relation $R$ without information loss:
   - For Horizontal Fragmentation: $R = R_1 \cup R_2 \cup \dots \cup R_n$
   - For Vertical Fragmentation: $R = R_1 \bowtie R_2 \bowtie \dots \bowtie R_n$ (joined on Primary Key).
3. **Disjointness**: If relation $R$ is horizontally fragmented, no data item can appear in more than one fragment:
   $$R_i \cap R_j = \emptyset \quad (\forall i \neq j)$$
   *(Note: For vertical fragmentation, only the primary key is replicated across fragments for joining).*

---

## 4. Replication Strategies & Consistency

**Replication** involves maintaining multiple physical copies of data fragments across distinct geographic nodes to ensure fault tolerance and low-latency local reads.

| Strategy | Mechanism | Consistency Level | Latency Impact |
|---|---|---|---|
| **Synchronous (Eager) Replication** | Updates are written to all replicas before the transaction commits. | Strong (Strict Serializability) | High write latency (waits for slowest replica acknowledgment). |
| **Asynchronous (Lazy) Replication** | Transaction commits on primary node immediately; updates replicate in background. | Eventual Consistency | Minimal write latency; risks data loss if primary crashes before replication. |
| **Quorum Consensus ($R + W > N$)** | Reads access $R$ nodes and writes write to $W$ nodes out of total $N$ replicas. | Tunable Consistency | Balanced; guarantees overlap between read and write sets. |

---

## 5. Distributed Transactions & Two-Phase Commit (2PC)

A transaction is **distributed** when it involves reading and updating data residing on two or more distinct physical nodes. Maintaining the ACID properties across network boundaries requires an atomic commitment protocol.

### The Two-Phase Commit Protocol (2PC)

The standard protocol involves a **Transaction Coordinator** and multiple **Participant Nodes (Cohorts)**.

```
       COORDINATOR                                  PARTICIPANTS
   +-----------------+                           +-----------------+
   |  Begin Global   |                           |                 |
   |   Transaction   |                           |                 |
   +--------+--------+                           +--------+--------+
            |                                             |
   ---------|========== [PHASE 1: PREPARE] ===============|--------->
            |                                             |
            | --- 1. Sends PREPARE message -------------> |
            |                                             | Writes Undo/Redo Log
            |                                             | Checks Locks/Invariants
            | <-- 2. Responds VOTE_COMMIT or VOTE_ABORT --|
            |                                             |
   ---------|========== [PHASE 2: COMMIT] ================|--------->
            |                                             |
   If ALL participants voted VOTE_COMMIT:                 |
            | --- 3. Sends GLOBAL_COMMIT ---------------> |
            |                                             | Commits locally
            | <-- 4. Sends ACKNOWLEDGMENT ----------------| Releases locks
            |                                             |
   If ANY participant voted VOTE_ABORT or timed out:      |
            | --- 3. Sends GLOBAL_ABORT ----------------> |
            |                                             | Rolls back locally
            | <-- 4. Sends ACKNOWLEDGMENT ----------------| Releases locks
            |                                             |
```

### The Blocking Problem of 2PC
- **Vulnerability**: If the Coordinator crashes after participants have voted `VOTE_COMMIT` but before broadcasting `GLOBAL_COMMIT`, participants remain locked in an **in-doubt state**. They cannot unilaterally abort or commit because they do not know the global outcome.
- **Modern Evolution**: Systems like Google Spanner and CockroachDB replace coordinator single-points-of-failure by wrapping 2PC inside a distributed consensus protocol (**Raft** or **Multi-Paxos**), ensuring non-blocking automated leader election.

### CAP & PACELC Theorems
- **CAP Theorem** (Brewer): In a distributed data store experiencing a network partition (**P**), you must choose between **Consistency (C)** (every read returns the latest write or an error) and **Availability (A)** (every request receives a non-error response without guarantee of latest data).
- **PACELC Theorem** (Abadi): If there is a Partition (**P**), how does the system trade off Availability (**A**) vs Consistency (**C**)? **Else (E)**, when running normally, how does it trade off Latency (**L**) vs Consistency (**C**)?
  - Spanner / CockroachDB: **CP / PC** (prioritizes strong consistency both under partition and normal execution).

---

## 6. Real-World Distributed Database Implementations

1. **Google Spanner**:
   - Globally distributed, synchronously replicated NewSQL database.
   - Solves distributed clock skew using the **TrueTime API** (synchronized hardware GPS receivers and atomic clocks) to provide externally consistent, linearizable transactions worldwide.
2. **CockroachDB**:
   - Open-source cloud-native distributed SQL database modeled after Google Spanner.
   - Replaces TrueTime with Hybrid Logical Clocks (HLC) and uses the **Raft consensus algorithm** for replicated storage ranges.
3. **AWS Aurora**:
   - Cloud-native relational engine decoupling compute from storage.
   - Storage is replicated 6-ways across 3 Availability Zones (AZs) using a 4/6 write quorum and 3/6 read quorum.
4. **TiDB**:
   - Open-source distributed HTAP (Hybrid Transactional/Analytical Processing) database.
   - MySQL-protocol compatible on the frontend with Raft-replicated key-value storage (`TiKV`) on the backend.

---

## 7. Applying Distributed Concepts to ServicePath AI

### Architectural Scaling Blueprint
As ServicePath AI scales across India, its single-node instance can transition to a geographically sharded distributed architecture:

```
+---------------------------------------------------------------------------------------+
|                            SERVICEPATH AI DISTRIBUTED BLUEPRINT                       |
+---------------------------------------------------------------------------------------+
|  REGIONAL SHARD 1: WEST (Mumbai / Pune)      |  REGIONAL SHARD 2: SOUTH (Bengaluru)   |
|  - TechNova Solutions (IT, Mumbai)           |  - FinEdge Consulting (Finance, Blr)   |
|  - GreenLeaf Foods (Food, Mumbai)            |  - South Regional Service Providers    |
|  - EduSpark Academy (Education, Pune)        |                                        |
+----------------------------------------------+----------------------------------------+
                        \                                    /
                         \                                  /
                          +--------------------------------+
                          |   GLOBAL CATALOG & REPUTATION  |
                          |   - Read-replicated Service DB |
                          |   - Global Review Directory    |
                          +--------------------------------+
```

### Distributed Transaction Scenario in ServicePath AI:
1. **Context**: TechNova Solutions (located in Shard 1 - West) hires FinEdge Consulting (located in Shard 2 - South) for an accounting audit valued at ₹27,000.
2. **Cross-Shard Execution**:
   - **Step 1**: The API Gateway initiates a distributed transaction $T_{cross}$.
   - **Step 2 (Prepare Phase)**:
     - Shard 1 coordinator verifies TechNova's corporate escrow balance and prepares debit record. Votes `VOTE_COMMIT`.
     - Shard 2 coordinator verifies FinEdge provider active status and prepares disbursement record. Votes `VOTE_COMMIT`.
   - **Step 3 (Commit Phase)**:
     - Global coordinator receives unanimous `VOTE_COMMIT`.
     - Sends `GLOBAL_COMMIT` to both Shard 1 (debit escrow) and Shard 2 (credit provider).
     - Deal record (`transaction_id: 3004`) is finalized with ACID atomicity across state borders.

---

## 8. Critical Architectural Clarification: Dolt vs. Distributed Databases

> [!IMPORTANT]
> **Academic Integrity & Viva Requirement**:
> **Dolt is NOT a distributed database management system.** It does not use Paxos, Raft, or Two-Phase Commit to partition and execute live relational transactions across a network cluster.
> Instead, Dolt is a **version-controlled, single-node relational database** that implements Git-like version control semantics directly on SQL storage.

### Systematic Comparison: Dolt vs. True Distributed Systems

| Architectural Dimension | Dolt (Version-Controlled SQL) | Distributed Database (Spanner / CockroachDB) | Centralized RDBMS (MySQL) |
|---|---|---|---|
| **Primary Design Goal** | Data versioning, branching, merging, and auditable history. | Horizontal scale-out, global high availability, and partition tolerance. | ACID compliance on single server hardware. |
| **Storage Structure** | Content-addressed storage trees (**Prolly Trees**). | Distributed B-Trees / LSM-Trees (Log-Structured Merge). | Standard B+ Trees (InnoDB pages). |
| **Transaction Scope** | Local ACID transactions on a single active database instance. | Globally distributed ACID transactions across multiple servers. | Local ACID transactions on single node. |
| **Multi-Node Model** | **Decentralized Asynchronous Pull/Push** (like Git clone, push, pull to DoltHub remotes). | **Real-time Consensus Cluster** (nodes communicate every millisecond via Raft/Paxos). | Single active master with optional read replicas. |
| **Conflict Resolution** | Three-way merge algorithm with human-in-the-loop conflict resolution (`dolt_conflicts`). | Automated deterministic conflict aborts (Optimistic Concurrency / 2PC rollbacks). | Lock waits, timeouts, and deadlock rollbacks. |
| **Execution in ServicePath AI** | Powers our version control, schema audit trail, and zero-loss local development. | Theoretical target architecture if ServicePath AI reaches 100M+ transactions across India. | Primary runtime engine running in MySQL Workbench on port 3307/3306. |

---

## 9. Viva Examination Cheat Sheet & Model Answers

**Q1: What is the difference between horizontal fragmentation and vertical fragmentation?**  
*Answer*: Horizontal fragmentation splits rows using relational selection ($\sigma$), placing different tuples into different physical nodes while retaining all columns (e.g. sharding businesses by state). Vertical fragmentation splits columns using relational projection ($\pi$), placing subsets of attributes into different physical nodes while retaining the primary key in each fragment for lossless reconstruction.

**Q2: What is the main drawback of the Two-Phase Commit (2PC) protocol?**  
*Answer*: The primary drawback is that 2PC is a **blocking protocol**. If the transaction coordinator crashes during Phase 2 after participants have voted to commit, participants are left in an "in-doubt" state and cannot release locks, potentially causing distributed deadlocks and halting system throughput until the coordinator recovers.

**Q3: How does the CAP theorem apply to distributed financial transactions?**  
*Answer*: Under the CAP theorem, during a network partition (**P**), a financial system MUST choose **Consistency (C)** over Availability (**A**). In ServicePath AI, if a network partition disconnects the Mumbai buyer node from the Bengaluru seller node, the system must reject or halt cross-region deal commitments rather than risk double-spending or divergent payment balances.

**Q4: Is Dolt a distributed database? Why or why not?**  
*Answer*: No. Dolt is a single-node relational database engine that incorporates Git version-control primitives (commits, branches, diffs, merges) into SQL tables using Prolly Trees. While it supports decentralized data sharing via remote repositories (DoltHub) through asynchronous push/pull commands, it does not perform real-time distributed query processing, data sharding, or multi-node 2PC consensus.

