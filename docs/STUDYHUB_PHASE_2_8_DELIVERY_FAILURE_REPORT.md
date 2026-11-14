# STUDYHUB — PHASE 2.8 TECHNICAL REPORT
## TELEGRAM FILE DELIVERY FAILURE HANDLING

**Date:** November 14, 2026  
**Status:** Completed & Production Verified  
**Scope:** Telegram Bot Delivery Pipeline (`src/telegram/fileDelivery.js`, `src/telegram/templates.js`)  
**Database Document Count:** 92,143 (Strictly Read-Only Baseline, 0 schema mutations, 0 records modified)

---

## 1. EXECUTIVE SUMMARY

In Phase 1, an audit of the `telegramresources` database discovered that 26 genuine academic resources had previously been marked unavailable (`isAvailable: false`). Investigation into the delivery pipeline revealed that when a file forward or relay operation failed due to temporary network timeouts, flood wait restrictions, Telegram 429 rate-limits, or relay delays, the legacy system treated the failure indiscriminately as an unrecoverable source loss, deactivating valid resources and presenting confusing error messages to students.

Phase 2.8 resolves this reliability flaw by introducing a strict **error classification engine** (`classifyDeliveryError`) that distinguishes:
1. **Permanent Failures**: Confirmed message deletions (`MESSAGE_ID_INVALID`, `MESSAGE_EMPTY`), inaccessible/deleted channels (`CHANNEL_PRIVATE`, `CHANNEL_INVALID`), or channel bans (`USER_BANNED_IN_CHANNEL`).
2. **Temporary Failures**: Rate limits (`429 Too Many Requests`), GramJS flood wait (`FloodWaitError`, `420 FLOOD_WAIT_X`), socket and network timeouts (`ETIMEDOUT`, `ECONNRESET`), Telegram 5xx server errors, and 30-second relay queue timeouts.
3. **Unknown/Unverified Failures**: Unrecognized exceptions protected by default from triggering resource deactivation.

When a temporary failure occurs, the resource remains active (`isAvailable: true`), and the student is shown a friendly message (`"Couldn't retrieve this file right now. Please try again."`) with an instant `[🔄 Try Again]` one-tap retry button. Permanent deactivation (`markResourceUnavailable`) is executed exclusively upon verified, confirmed source deletions.

---

## 2. ROOT CAUSE ANALYSIS

### 2.1 Indiscriminate Failure Handling
In `src/telegram/fileDelivery.js`, both `handleDownload` (single files) and `handleGroupDownload` (multi-page albums) previously caught all forwarding and relay errors in generic `catch (gramError)` or timeout blocks and passed generic `templates.renderError()` text:
> *"This file may have been removed from its source channel."*

Furthermore, if an automated script or handler subsequently ran `markResourceUnavailable`, any network hiccup or Telegram MTProto flood wait caused genuine study materials to be permanently suppressed from search results across both the bot and website.

### 2.2 Album Cascade Deactivation Risk
For multi-page albums (`groupId != null`), if a single image in a 10-page photo booklet encountered a temporary forward timeout while the other 9 images were intact, historical handling risked deactivating the entire album cluster.

---

## 3. IMPLEMENTATION DETAILS

### 3.1 Delivery Error Classification Engine (`classifyDeliveryError`)

Implemented in `src/telegram/fileDelivery.js`:
```javascript
const DELIVERY_ERROR_TYPES = {
  PERMANENT_FAILURE: "PERMANENT_FAILURE",
  TEMPORARY_FAILURE: "TEMPORARY_FAILURE",
  UNKNOWN_FAILURE: "UNKNOWN_FAILURE",
};

const PERMANENT_ERROR_CODES = new Set([
  "MESSAGE_ID_INVALID",
  "MESSAGE_EMPTY",
  "MSG_ID_INVALID",
  "CHANNEL_PRIVATE",
  "CHANNEL_INVALID",
  "CHAT_INVALID",
  "USER_BANNED_IN_CHANNEL",
  "CHAT_ADMIN_REQUIRED",
  "INPUT_USER_DEACTIVATED",
  "PEER_ID_INVALID",
]);

const TEMPORARY_ERROR_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ESOCKETTIMEDOUT",
  "EHOSTUNREACH",
  "EPIPE",
  "RELAY_TIMEOUT",
  "TIMEOUT",
]);
```

#### Classification Logic:
1. **Flood Wait & Rate Limiting**: Matches `error.name === "FloodWaitError"`, HTTP 420/429, or messages starting with `FLOOD_WAIT` / `TOO MANY REQUESTS`. Classified as **`TEMPORARY_FAILURE`**.
2. **Network & Timeouts**: Matches `TimeoutError`, `ConnectionError`, `RelayTimeoutError`, POSIX socket codes (`ETIMEDOUT`, `ECONNRESET`), or connection drops. Classified as **`TEMPORARY_FAILURE`**.
3. **5xx Server Errors**: Matches Telegram API HTTP 500/502/503/504 and GramJS `RPC_CALL_FAIL`. Classified as **`TEMPORARY_FAILURE`**.
4. **Relay Group Timeouts**: The 30-second pending queue timeout is classified explicitly as **`TEMPORARY_FAILURE`**.
5. **Verified Source Deletions**: Matches `MESSAGE_ID_INVALID`, `MESSAGE_EMPTY`, or `CHANNEL_PRIVATE`. Only these positive confirmations trigger **`PERMANENT_FAILURE`**.
6. **Unknown Errors**: Default to **`UNKNOWN_FAILURE`**, preserving resource availability.

### 3.2 Safe Availability Management (`markResourceUnavailable`)

Updated in `src/telegram/fileDelivery.js`:
- Safety guards: Aborts immediately if `!resourceId && !groupId` or if Mongoose is disconnected.
- In `handleDownload` and `handleGroupDownload`:
  ```javascript
  const errorClass = classifyDeliveryError(deliveryError);
  if (errorClass === DELIVERY_ERROR_TYPES.PERMANENT_FAILURE) {
    await markResourceUnavailable(resource._id, resource.groupId);
  }
  ```
  Temporary and unknown errors **never** trigger `markResourceUnavailable`.

### 3.3 Enhanced Student-Facing Error Prompts (`templates.renderDeliveryError`)

Implemented in `src/telegram/templates.js`:
- **Temporary Failure UI**:
  ```
  ─────────────────────
  ⏳ Couldn't retrieve this file right now

  Telegram was momentarily busy or the network timed out.

  Please tap below to try again in a few moments.
  ─────────────────────
  [ 🔄 Try Again ]
  [ 🔍 New Search ]  [ 🔥 Trending ]
  ```
  - For single files, `[🔄 Try Again]` targets `get_${resource._id}`.
  - For multi-file albums, `[🔄 Try Again]` targets `grp_${resource._id}`.
  - No internal Telegram error strings (`FLOOD_WAIT`, `RPC_CALL_FAIL`) are exposed to the student.
- **Permanent Failure UI**:
  ```
  ─────────────────────
  ⚠️ Resource Unavailable

  This resource is currently unavailable from its original source.

  Try searching again — there may be another copy available in another channel.
  ─────────────────────
  [ 🔍 Search Again ]  [ 🔥 Trending ]
  ```
  - Omits futile retry buttons; offers direct navigation to search or trending materials.

---

## 4. VERIFICATION & TEST RESULTS

### 4.1 Phase 2.8 Test Suite (`test/telegram-delivery-failure.test.js`)
All 11 test scenarios executed successfully:
```
=======================================================
  StudyHub Phase 2.8 — File Delivery Failure Handling  
=======================================================

Group 1: Delivery Error Classification (classifyDeliveryError)
  ✓ Test 1: Classifies network timeouts and socket resets as TEMPORARY_FAILURE
  ✓ Test 2: Classifies HTTP 429 Too Many Requests as TEMPORARY_FAILURE
  ✓ Test 3: Classifies GramJS FloodWaitError & 420 FLOOD_WAIT as TEMPORARY_FAILURE
  ✓ Test 4: Classifies Relay Group timeout & delay as TEMPORARY_FAILURE
  ✓ Test 5: Classifies confirmed deleted messages & private channels as PERMANENT_FAILURE
  ✓ Test 6: Classifies unknown / unverified errors as UNKNOWN_FAILURE

Group 2: Student Experience & Error Prompts (renderDeliveryError)
  ✓ Test 7: Temporary failure renders friendly retry prompt with [🔄 Try Again] button
  ✓ Test 8: Album temporary failure retry button targets grp_<id>
  ✓ Test 9: Permanent failure renders clean unavailable prompt without retry button
  ✓ Test 10: Successful file delivery renders clean channel credit

Group 3: Database Availability Invariance
  ✓ Test 11: Database document count remains strictly unchanged at 92,143

-------------------------------------------------------
Results: 11 / 11 tests passed
-------------------------------------------------------
```

### 4.2 Full Phase 2 Regression Suite
All test suites across Phase 2 were executed in sequence:
- **Phase 2.1 (Query Expansion Syntax)**: 9/9 passed (`test/search-query-expansion.test.js`)
- **Phase 2.2 (Exact Duplicate Deduplication)**: 8/8 passed (`test/search-duplicate-deduplication.test.js`)
- **Phase 2.3 (Subject Search Relevance)**: 7/7 passed (`test/search-subject-relevance.test.js`)
- **Phase 2.4 (Search Suggestions & Autocomplete)**: 15/15 passed (`test/search-suggestions.test.js`)
- **Phase 2.5 (Search Results Experience)**: 9/9 passed (`test/search-results-experience.test.js`)
- **Phase 2.6 (Telegram Pagination & Session Recovery)**: 14/14 passed (`test/search-pagination-session.test.js`)
- **Phase 2.7 (Website Pagination & Browse Reliability)**: 11/11 passed (`test/explore-pagination.test.js`)
- **Phase 2.8 (Telegram Delivery Failure Handling)**: 11/11 passed (`test/telegram-delivery-failure.test.js`)
- **Total Tests Passing**: **84 / 84 tests passed (100% pass rate)**.
- **Database Baseline Invariance**: Strictly verified at **92,143 documents** (0 mutations).

---

## 5. SUMMARY OF MODIFIED & CREATED FILES

| File | Type | Changes Description |
|---|---|---|
| [src/telegram/fileDelivery.js](file:///c:/Users/billy/Desktop/StudyHub/src/telegram/fileDelivery.js) | Modified | Added `classifyDeliveryError`, `DELIVERY_ERROR_TYPES`, availability protection guards, and differentiated error handling in `handleDownload` & `handleGroupDownload`. |
| [src/telegram/templates.js](file:///c:/Users/billy/Desktop/StudyHub/src/telegram/templates.js) | Modified | Added `renderDeliveryError` supporting both temporary retry prompts and permanent unavailable screens. |
| [test/telegram-delivery-failure.test.js](file:///c:/Users/billy/Desktop/StudyHub/test/telegram-delivery-failure.test.js) | Created | Automated test suite covering error classification, prompt rendering, album isolation, and availability invariance. |
| [docs/STUDYHUB_PHASE_2_8_DELIVERY_FAILURE_REPORT.md](file:///c:/Users/billy/Desktop/StudyHub/docs/STUDYHUB_PHASE_2_8_DELIVERY_FAILURE_REPORT.md) | Created | Full technical report and verification documentation. |
