# Test Coverage Inventory

This document covers the suites expanded during the current coverage pass, with emphasis on the user-routes and common-schema-fields-validators areas.

## src/backend/config/__tests__/server-config.test.js

| Test ID | Name | Inputs | Expected Outputs | Why |
| --- | --- | --- | --- | --- |
| SC-1 | creates the app with runtime config, favicon, and frontend routes | Mocked Express app, mock filesystem, existing build assets | App mounts runtime config, favicon handler, frontend route, and API docs | Verifies the server bootstrap wiring that users hit on startup |
| SC-2 | serves a 503 when the frontend build is missing and 404 when favicon files are absent | Missing build directory and missing favicon files | Runtime config returns 503 and favicon requests return 404 | Covers the fallback paths when static assets are absent |
| SC-3 | setupErrorHandling wires the not-found and error handlers | Mock app and middleware spies | Not-found and error middleware are registered in order | Confirms the error middleware is installed correctly |
| SC-4 | getServerConstants returns stable server metadata | No request body or external inputs | Returns the expected host, port, and server constants | Protects configuration values used across the backend |

## src/backend/despatch/advice/__tests__/despatch-planner-service.test.js

| Test ID | Name | Inputs | Expected Outputs | Why |
| --- | --- | --- | --- | --- |
| DP-1 | throws when the order root is missing | Empty or malformed order tree | Throws a missing-root error | Guards the planner against invalid input |
| DP-2 | throws when order lines are missing | Order tree without lines | Throws a missing-lines error | Ensures planning fails fast on incomplete orders |
| DP-3 | groups lines by address and normalises quantity and line identifiers | Order tree with multiple lines and delivery addresses | Returns grouped despatch buckets with cleaned quantities and IDs | Covers the main grouping logic used to build despatch advice |
| DP-4 | rejects lines with invalid quantities | Order tree with zero or invalid quantities | Throws a quantity validation error | Prevents invalid despatch advice generation |

## src/backend/despatch/advice/__tests__/despatch-advice-document-builder.test.js

| Test ID | Name | Inputs | Expected Outputs | Why |
| --- | --- | --- | --- | --- |
| DDB-1 | throws when the order tree is invalid | Missing order tree | Throws an invalid-order error | Validates the document builder preconditions |
| DDB-2 | throws when the despatch group is invalid | Missing or malformed despatch group | Throws an invalid-group error | Prevents corrupt despatch XML construction |
| DDB-3 | builds a despatch advice document with optional fields and line metadata | Valid order tree, populated group, optional shipment fields | Returns a document with shipment, line, and metadata fields filled in | Covers the main happy path and optional XML fields |
| DDB-4 | builds a despatch advice document with fallback line id and no requested delivery period | Order tree missing some line metadata | Returns a valid document using fallback identifiers | Covers the fallback path for incomplete order data |

## src/backend/despatch/advice/__tests__/despatch-advice-xml-serializer.test.js

| Test ID | Name | Inputs | Expected Outputs | Why |
| --- | --- | --- | --- | --- |
| DXS-1 | throws when the document is missing | Null or undefined document | Throws a missing-document error | Prevents serializing empty input |
| DXS-2 | throws when the DespatchAdvice root is missing | Object without a DespatchAdvice root | Throws a root-element error | Confirms serializer validation |
| DXS-3 | serializes a despatch advice document into XML | Valid despatch advice document | Returns XML text | Covers the successful serializer path |

## src/backend/despatch/advice/__tests__/despatch-advice-service.test.js

| Test ID | Name | Inputs | Expected Outputs | Why |
| --- | --- | --- | --- | --- |
| DAS-1 | Validation passes + insert succeeds -> returns adviceIds array | Valid order, mock insert success | Returns created advice IDs | Covers the core creation flow |
| DAS-2 | Multiple despatch groups -> returns one adviceId per group | Order that splits into several groups | Returns one ID per generated advice | Verifies batch generation behavior |
| DAS-3 | Correct document is passed to insertOne (apiKey, despatchXml, metadata) | Valid creation request | insertOne receives the expected persisted record | Ensures persistence payload shape is correct |
| DAS-4 | buildDespatchAdviceDocument and serializeDespatchAdvice are called with parsed order and group | Parsed order and generated group | Both builder and serializer receive the correct arguments | Confirms orchestration between helpers |
| DAS-5 | validateOrder returns { success: false } -> throws with validation message | Invalid order payload | Throws validation error | Covers order validation failure |
| DAS-6 | insertOne throws -> error propagates out of createDespatchAdvice | Database insert failure | Promise rejects with the database error | Ensures persistence failures are not swallowed |
| DAS-7 | Validation passes but order UUID is missing -> still generates advice but with no UUID in order reference | Valid order data without order UUID | Advice is still created with empty order reference | Covers a partial-input edge case |
| DAS-8 | Generated advice UUID is missing -> throws generation error | createDespatchAdvice stub that omits advice IDs | Throws a generation error | Guards against invalid service output |
| DAS-9 | maps despatch advice records into response shape | Stored advice documents | Returns mapped advice summary objects | Covers list result formatting |
| DAS-10 | rethrows database errors from list operation | Database cursor failure | Promise rejects with the database error | Ensures list errors propagate |
| DAS-11 | returns 400 when search-type parameter is missing | Missing search-type query | HTTP 400 | Covers request validation for retrieval endpoints |
| DAS-12 | returns 400 when search-type parameter is invalid | Unsupported search-type query | HTTP 400 | Covers invalid search mode handling |
| DAS-13 | returns 400 when query parameter is missing | Missing query value | HTTP 400 | Covers required-query validation |
| DAS-14 | returns 400 when query is not a valid UUID | Non-UUID query value | HTTP 400 | Confirms UUID format validation |
| DAS-15 | returns 404 when advice-id is not found | Valid UUID with no stored record | HTTP 404 | Covers not-found lookup behavior |
| DAS-16 | returns 200 with despatch-advice and advice-id when found | Existing advice record | HTTP 200 with advice payload | Verifies successful advice retrieval |
| DAS-17 | returns the advice record when searched by order-id | Existing order-linked advice | HTTP 200 with advice payload | Covers order-based lookup |
| DAS-18 | returns 400 when order XML cannot be parsed | Invalid order XML | HTTP 400 | Confirms XML parse failure handling |
| DAS-19 | returns 400 when order XML fails validation | Parsed XML that fails order validation | HTTP 400 | Covers downstream validation failure |
| DAS-20 | returns 400 when validated order XML contains no orderId | Validated XML missing order ID | HTTP 400 | Guards against incomplete order metadata |
| DAS-21 | returns 404 when no despatch advice is found for the order | Valid order with no advice record | HTTP 404 | Covers absent lookup results |
| DAS-22 | returns 200 with despatch-advice and advice-id when order is found | Existing order-linked advice | HTTP 200 with advice payload | Verifies the happy path for order lookup |

## src/backend/routes/v2/__tests__/user-routes-utilities-advanced.test.js

| Test ID | Name | Inputs | Expected Outputs | Why |
| --- | --- | --- | --- | --- |
| URU-1 | parseInvoiceReferenceSummaryFromXml extracts unique order and despatch references | Invoice XML with duplicate references | Deduplicated order and despatch IDs | Covers invoice reference parsing |
| URU-2 | validateInvoiceXmlDocument accepts a valid invoice and rejects empty input | Valid invoice XML and empty input | Success for valid XML, failure for empty XML | Verifies baseline invoice validation |
| URU-3 | validateInvoiceXmlDocument rejects invoices that miss required elements | Invoice XML missing required nodes | Validation errors | Covers validation failure paths |
| URU-4 | overwrite XML document ids updates order, despatch, and invoice roots | Order, despatch, and invoice XML payloads | XML root IDs are rewritten | Confirms document ID replacement logic |
| URU-5 | deriveInvoiceLinesFromDespatch maps direct lines and XML fallback lines | Despatch documents and fallback XML | Invoice line array with derived items | Covers invoice line derivation logic |
| URU-6 | calculateInvoiceTotals rounds totals consistently | Line amounts that require rounding | Rounded totals and tax values | Protects numeric precision rules |
| URU-7 | postChalksnifferOrderForXmlResponse returns direct XML and follows xmlUrl responses | Mocked create response and xmlUrl response | Final XML response string | Covers both API response shapes |
| URU-8 | postChalksnifferOrderForXmlResponse rejects missing token and malformed responses | Missing token, empty response, and bad payloads | Throws request errors | Covers outbound order creation failure modes |
| URU-9 | postLastMinutePushInvoiceForXmlResponse returns invoice XML and validates the token | Mocked invoice create and XML fetch responses | Invoice object and invoice XML | Verifies outbound invoice creation success |
| URU-10 | postLastMinutePushInvoiceForXmlResponse rejects missing token and missing invoice data | Missing token and malformed invoice responses | Throws request errors | Covers invoice API failure paths |

## src/backend/routes/auth/__tests__/auth-routes-helpers.test.js

| Test ID | Name | Inputs | Expected Outputs | Why |
| --- | --- | --- | --- | --- |
| ARH-1 | hashes values and compares hashes safely | Plaintext values and hash strings | Hash digest and boolean comparison results | Covers password and token safety helpers |
| ARH-2 | generates verification codes and reset tokens | No external inputs beyond entropy sources | Verification code and reset token strings | Verifies token generation helpers |
| ARH-3 | checks expiry and cooldown thresholds | Timestamps and threshold values | Boolean expired/not expired decisions | Covers time-based guard logic |
| ARH-4 | builds reset urls and normalises text helpers | Base URL and text inputs | Canonical reset URL and trimmed values | Ensures helper formatting stays stable |
| ARH-5 | builds safe users and detects production mode and turnstile secret values | User records and environment settings | Sanitized user objects and environment checks | Covers user-shaping and config helpers |
| ARH-6 | validates registration, login, verification, and reset payloads | Auth request bodies | Validation results with errors or clean data | Exercises the auth validation helpers |
| ARH-7 | verifies turnstile tokens and sends email helpers | Mock token verification and mail payloads | Verification result and email send result | Covers external auth integration helpers |
| ARH-8 | regenerates and saves sessions | Mock session object | Session promises resolve correctly | Verifies session lifecycle helpers |

## src/backend/routes/v2/__tests__/user-routes-helpers.test.js

| Test ID | Name | Inputs | Expected Outputs | Why |
| --- | --- | --- | --- | --- |
| URH-1 | normalises uploaded XML documents and builds upload prefixes | Upload payloads with file metadata | Normalized document list and error prefixes | Covers upload input handling |
| URH-2 | reads quantities, rounds currency, and generates provider identifiers | Numeric and text inputs | Clean quantities, rounded values, and IDs | Verifies basic numeric and ID helpers |
| URH-3 | maps invoice and payment summaries | Invoice and payment records | Summary objects with the expected shape | Covers summary mapping logic |
| URH-4 | builds line id candidates and reads order line prices | Line identifiers and order lines | Candidate IDs and derived prices | Exercises matching helpers |
| URH-5 | summarises destinations and order lines with despatch data | Order lines and destination info | Destination summaries and enriched order lines | Covers despatch enrichment helpers |
| URH-6 | matches line candidates and applies despatch and invoice quantities | Order and despatch line sets | Matched quantities and candidate resolution | Verifies cross-document line matching |
| URH-7 | resolves lifecycle status and builds status lookups | Order, despatch, and invoice records | Lifecycle status map and lookup objects | Covers status aggregation logic |
| URH-8 | derives invoice lines from order data | Order document with order lines | Derived invoice line entries | Ensures order-to-invoice translation works |

## src/backend/routes/v2/__tests__/user-routes-create-handlers.test.js

| Test ID | Name | Inputs | Expected Outputs | Why |
| --- | --- | --- | --- | --- |
| URC-1 | creates an order document | Valid order-create body and session | HTTP 201 and success JSON | Covers the order creation handler |
| URC-2 | creates a despatch document | Valid despatch-create body and matching stored order | HTTP 201 and success JSON | Covers the despatch creation handler |
| URC-3 | creates an invoice document | Valid invoice-create body and matching stored order/despatch data | HTTP 201 and success JSON | Covers the invoice creation handler |

## src/backend/validators/common/__tests__/common-schema-fields-validators.test.js

| Test ID | Name | Inputs | Expected Outputs | Why |
| --- | --- | --- | --- | --- |
| CSV-1 | validates buyer customer party success and failure paths | Buyer customer party XML fragments | Success for valid data and specific errors for missing fields | Covers shared buyer-party validation |
| CSV-2 | validates seller supplier party success and failure paths | Seller supplier party XML fragments | Success for valid data and specific errors for missing fields | Covers shared seller-party validation |
