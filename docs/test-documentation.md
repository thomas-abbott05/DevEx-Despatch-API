# Test Documentation

This document provides a comprehensive reference for all newly-added tests across the DevEx Despatch API test suite. Each row describes a single test case, the input it uses, the expected outcome, and the reason the scenario is covered.

| Test ID | Test Name | Input | Expected Output | Reason for Testing |
|---------|-----------|-------|-----------------|-------------------|
| DB-001 | Second connectToDatabase call skips index recreation | Second call to `connectToDatabase` after indexes already initialised | Index-creation commands are not called again | Verifies the `indexesInitialised` guard prevents redundant DB operations on reconnection |
| DB-002 | dotenv parsed keys logged when .env file found | Mock `dotenv.config` returning `{ parsed: { KEY: 'val' } }` | `console.log` called with parsed keys | Ensures the startup log branch that prints loaded env keys is exercised |
| DB-003 | DatabaseError uses default message | `new DatabaseError()` with no arguments | Instance message equals default string | Confirms the custom error class default message fallback works |
| DB-004 | DatabaseError uses provided message | `new DatabaseError('custom msg')` | Instance message equals `'custom msg'` | Confirms the custom error class accepts a caller-supplied message |
| SESS-001 | Calls next() when session and userId present | `req.session = { userId: 'user-123' }` | `next()` called once; no response sent | Validates the happy path: authenticated requests pass through |
| SESS-002 | Returns 401 when session is null | `req.session = null` | HTTP 401 with `errors` array containing auth message | Covers the null-session guard that rejects unauthenticated requests |
| SESS-003 | Returns 401 when session exists but userId absent | `req.session = {}` | HTTP 401 with `errors` array containing auth message | Covers the missing-userId branch within an existing session object |
| RL-001 | buildRateLimitConfig uses expected defaults | No overrides | `windowMs=60000`, `limit=100`, `standardHeaders=true`, `legacyHeaders=false` | Ensures baseline config values are correct out of the box |
| RL-002 | createApiRateLimiter passes custom options to express-rate-limit | `{ windowMs: 5000, limit: 2 }` | `rateLimit` called with merged options; returned limiter reflects custom values | Verifies custom limiter creation correctly merges caller options |
| RL-003 | Exports a default limiter instance | Module import | `apiRateLimiter` has config with `windowMs=60000`, `limit=100` | Confirms the module exports a ready-to-use default limiter |
| RL-004 | buildRateLimitConfig falls back to defaults for invalid overrides | `{ windowMs: 'invalid', limit: -10 }` | `windowMs=60000`, `limit=100` | Guards against non-positive or non-numeric config values |
| RL-005 | buildRateLimitConfig falls back to defaults for zero values | `{ windowMs: 0, limit: 0 }` | `windowMs=60000`, `limit=100` | Ensures zero is treated as invalid (same as negative) |
| RL-006 | buildRateLimitConfig uses provided custom handler | `{ handler: customHandler }` | `config.handler === customHandler` | Allows callers to override the default rate-limit response handler |
| RL-007 | Default handler uses statusCode from options | `options.statusCode = 429` | `res.status(429)` called with errors array and `executed-at` timestamp | Verifies handler correctly reads status code from express-rate-limit options |
| RL-008 | Default handler falls back to 429 when statusCode missing | `options = {}` | `res.status(429)` called | Ensures the handler never crashes when statusCode is absent |
| RL-009 | Health endpoint available while API routes are rate-limited | 101 sequential requests to `/api/v1/api-key/list` | Health returns 200; 101st API request returns 429 with error message | Integration test confirming health is exempt from rate limiting |
| RL-010 | buildRateLimitConfig uses defaults when no overrides given (routes) | No overrides | `windowMs=60000`, `limit=100`, `standardHeaders=true`, `legacyHeaders=false` | Route-level smoke test for default config |
| RL-011 | buildRateLimitConfig accepts valid positive integer overrides | `{ windowMs: 30000, limit: 50 }` | `windowMs=30000`, `limit=50` | Confirms valid overrides are accepted and not overwritten |
| RL-012 | buildRateLimitConfig falls back to defaults for non-positive values (routes) | `{ windowMs: 'invalid', limit: -5 }` | `windowMs=60000`, `limit=100` | Route-level duplicate of middleware guard test for completeness |
| RL-013 | buildRateLimitConfig falls back to defaults for zero values (routes) | `{ windowMs: 0, limit: 0 }` | `windowMs=60000`, `limit=100` | Route-level duplicate of zero-value guard test |
| RL-014 | buildRateLimitConfig uses provided custom handler (routes) | `{ handler: customHandler }` | `config.handler === customHandler` | Route-level confirmation custom handler override works |
| RL-015 | Default handler returns 429 with error message (routes) | `options.statusCode = 429` | `res.status(429)` and errors array with timestamp | Route-level handler response format validation |
| RL-016 | Default handler falls back to 429 when statusCode missing (routes) | `options = {}` | `res.status(429)` called | Route-level fallback guard when statusCode is absent |
| APIKEY-001 | POST /create returns 400 when body missing (no Content-Type) | POST with no Content-Type header | HTTP 400 | Guards the `!req.body` dead-code path when body parsing is skipped |
| APIKEY-002 | POST /create resends email when key already exists (resend path) | Existing contact email with `resend=true` | HTTP 200 with existing key re-sent via email | Verifies the re-send branch when an API key already exists for a contact |
| AUTH-001 | POST /register returns 400 when body missing | POST with no Content-Type header | HTTP 400 | Covers the null-body guard in the register handler |
| AUTH-002 | POST /register returns 400 for non-string email | `email: 12345` | HTTP 400 | Validates type-checking on email input |
| AUTH-003 | POST /register returns 400 for invalid email format | `email: 'notanemail'` | HTTP 400 | Ensures RFC-compliant email validation rejects bad formats |
| AUTH-004 | POST /register returns 400 when password too short | `password: 'Ab1'` | HTTP 400 | Enforces minimum password length policy |
| AUTH-005 | POST /register returns 400 when password lacks letter and number | `password: 'onlyletters'` | HTTP 400 | Enforces password complexity requirement |
| AUTH-006 | POST /register returns 400 when firstName too long | `firstName` exceeding max length | HTTP 400 | Validates maximum length constraint on firstName field |
| AUTH-007 | POST /register returns 400 when lastName too long | `lastName` exceeding max length | HTTP 400 | Validates maximum length constraint on lastName field |
| AUTH-008 | POST /register returns 400 when email already registered | Duplicate email address | HTTP 400 | Ensures duplicate-account prevention logic returns the correct status |
| AUTH-009 | POST /register returns 400 on MongoDB duplicate key error (11000) | MongoDB throws error code 11000 | HTTP 400 | Covers the Mongo duplicate-key error code branch |
| AUTH-010 | POST /register returns 500 on unexpected database error | DB throws generic error | HTTP 500 | Verifies unexpected errors are surfaced as 500, not swallowed |
| AUTH-011 | POST /register fails Turnstile verification | Turnstile returns `success: false` | HTTP 400 | Ensures Cloudflare Turnstile failure blocks registration |
| AUTH-012 | POST /register returns 400 when Turnstile HTTP request fails | Turnstile fetch returns `ok: false` | HTTP 400 | Covers the HTTP-level Turnstile failure path |
| AUTH-013 | POST /register uses CLOUDFLARE_TURNSTILE_SECRET_KEY in production | `NODE_ENV=production` with secret key set | Correct secret key used in Turnstile request | Verifies production secret key is used instead of test key |
| AUTH-014 | POST /login returns 400 when body missing | POST with no Content-Type header | HTTP 400 | Covers null-body guard in login handler |
| AUTH-015 | POST /login returns 400 for invalid email format | `email: 'bad'` | HTTP 400 | Validates email format check in login flow |
| AUTH-016 | POST /login returns 400 when password missing | No password field | HTTP 400 | Ensures missing password is rejected before DB lookup |
| AUTH-017 | POST /login returns 401 when password does not match | Wrong password | HTTP 401 | Verifies incorrect credentials return unauthorised status |
| AUTH-018 | POST /login returns 500 on unexpected database error | DB throws generic error | HTTP 500 | Ensures DB errors during login are surfaced correctly |
| AUTH-019 | POST /request-verification-code returns 400 when body missing | POST with no Content-Type | HTTP 400 | Guards null-body in verification-code request handler |
| AUTH-020 | POST /request-verification-code returns 400 for invalid email | `email: 'bad'` | HTTP 400 | Validates email format before sending verification code |
| AUTH-021 | POST /request-verification-code returns 200 when user not found | Unknown email | HTTP 200 (no-op) | Prevents user enumeration by returning 200 regardless |
| AUTH-022 | POST /request-verification-code returns 200 when already verified | Already-verified email | HTTP 200 (no-op) | Ensures already-verified users get a silent 200 |
| AUTH-023 | POST /request-verification-code sends email and returns 200 | Valid unverified email, not in cooldown | HTTP 200; email send called | Validates the happy path for verification-code dispatch |
| AUTH-024 | POST /request-verification-code returns 500 on unexpected error | Service throws | HTTP 500 | Ensures unexpected errors surface as 500 |
| AUTH-025 | POST /verify-email returns 400 when body missing | POST with no Content-Type | HTTP 400 | Guards null-body in verify-email handler |
| AUTH-026 | POST /verify-email returns 400 when email missing | No email field | HTTP 400 | Validates required email field in verify-email |
| AUTH-027 | POST /verify-email returns 400 when code format invalid | Malformed verification code | HTTP 400 | Enforces code format validation |
| AUTH-028 | POST /verify-email returns 400 when user not found | Unknown email | HTTP 400 | Ensures non-existent users cannot verify |
| AUTH-029 | POST /verify-email returns 200 when already verified | Already-verified email | HTTP 200 | Idempotent: re-verifying an already-verified account is safe |
| AUTH-030 | POST /verify-email returns 400 when code expired | Expired verification code | HTTP 400 | Covers expired-token branch in verification flow |
| AUTH-031 | POST /verify-email returns 400 when code wrong | Incorrect verification code | HTTP 400 | Ensures wrong codes are rejected |
| AUTH-032 | POST /verify-email returns 500 on unexpected error | Service throws | HTTP 500 | Unexpected errors surfaced as 500 |
| AUTH-033 | POST /request-password-reset returns 400 when body missing | POST with no Content-Type | HTTP 400 | Guards null-body in password-reset request handler |
| AUTH-034 | POST /request-password-reset returns 400 for invalid email | `email: 'bad'` | HTTP 400 | Validates email format before generating reset token |
| AUTH-035 | POST /request-password-reset sends email when not in cooldown | Valid email, not in cooldown | HTTP 200; email send called | Validates happy path for password reset initiation |
| AUTH-036 | POST /request-password-reset returns 200 but skips email in cooldown | Valid email, in cooldown | HTTP 200; email NOT sent | Prevents reset email spam during cooldown period |
| AUTH-037 | POST /request-password-reset returns 500 on unexpected error | Service throws | HTTP 500 | Unexpected errors surfaced as 500 |
| AUTH-038 | POST /reset-password returns 400 when body missing | POST with no Content-Type | HTTP 400 | Guards null-body in reset-password handler |
| AUTH-039 | POST /reset-password returns 400 when token missing | No token field | HTTP 400 | Validates required token field |
| AUTH-040 | POST /reset-password returns 400 when token too short | Short token string | HTTP 400 | Enforces minimum token length |
| AUTH-041 | POST /reset-password returns 400 when password too short | Short password | HTTP 400 | Enforces password length policy at reset |
| AUTH-042 | POST /reset-password returns 400 for non-string password | `password: 12345` | HTTP 400 | Validates type-checking on password at reset |
| AUTH-043 | POST /reset-password returns 200 on success | Valid token and password | HTTP 200 | Validates the full happy path for password reset |
| AUTH-044 | POST /reset-password returns 400 when token not found | Token not in DB | HTTP 400 | Ensures invalid/expired reset tokens are rejected |
| AUTH-045 | POST /reset-password returns 500 on unexpected error | DB throws | HTTP 500 | Unexpected errors surfaced as 500 |
| AUTH-046 | GET /session returns 401 when no session cookie | No session cookie | HTTP 401 | Ensures unauthenticated session check returns 401 |
| AUTH-047 | GET /session returns 401 when userId not a valid ObjectId | `userId: 'invalid-id'` | HTTP 401 | Validates ObjectId format check in session lookup |
| AUTH-048 | GET /session returns 500 on unexpected error | DB throws | HTTP 500 | Unexpected errors surfaced as 500 during session lookup |
| AUTH-049 | POST /logout destroys session for authenticated user | Valid session cookie | HTTP 200; session destroyed | Validates the happy path for logout |
| AUTH-050 | POST /logout returns 401 for unauthenticated request | No session cookie | HTTP 401 | Ensures unauthenticated logout requests are rejected |
| DCR-001 | POST /order returns 200 on success | Valid advice-id and order-cancellation-document | HTTP 200 with `order-cancellation-id` | Validates the POST /order happy path |
| DCR-002 | POST /order returns 404 when despatch not found | Error with statusCode 404 | HTTP 404 | Ensures not-found errors propagate correctly |
| DCR-003 | POST /order returns 400 on validation error | Error with statusCode 400 | HTTP 400 | Covers validation error handling for missing fields |
| DCR-004 | POST /order returns 403 when api key does not match owner | Error with statusCode 403 | HTTP 403 | Verifies ownership enforcement on cancel-order endpoint |
| DCR-005 | POST /order returns detailed XML validation errors | Error with `errors` array | HTTP 400 with `errors` array from error | Ensures error.errors array is forwarded to the client |
| DCR-006 | POST /order returns 500 when error has no statusCode | Generic Error | HTTP 500 | Covers the default 500 fallback path |
| DCR-007 | GET /order returns 200 on success | Valid `id` query param | HTTP 200 with `order-cancellation-id` | Validates GET /order happy path |
| DCR-008 | GET /order returns 404 when cancellation not found | Error with statusCode 404 | HTTP 404 | Ensures not-found errors propagate correctly |
| DCR-009 | GET /order returns 403 when api key does not match owner | Error with statusCode 403 | HTTP 403 | Ownership enforcement on retrieval endpoint |
| DCR-010 | POST /fulfilment returns 200 on success | Valid advice-id and reason | HTTP 200 with `fulfilment-cancellation-id` | Validates POST /fulfilment happy path |
| DCR-011 | POST /fulfilment returns 404 when despatch not found | Error with statusCode 404 | HTTP 404 | Not-found handling for fulfilment cancellation |
| DCR-012 | POST /fulfilment returns 400 on validation error | Error with statusCode 400 | HTTP 400 | Validation error propagation for fulfilment endpoint |
| DCR-013 | POST /fulfilment returns 403 when api key does not match owner | Error with statusCode 403 | HTTP 403 | Ownership enforcement on fulfilment cancellation |
| DCR-014 | GET /fulfilment returns 200 on success | Valid `id` query param | HTTP 200 with `fulfilment-cancellation-id` | Validates GET /fulfilment happy path |
| DCR-015 | GET /fulfilment returns 404 when not found | Error with statusCode 404 | HTTP 404 | Not-found handling for fulfilment retrieval |
| DCR-016 | GET /fulfilment returns 403 when api key does not match owner | Error with statusCode 403 | HTTP 403 | Ownership enforcement on fulfilment retrieval |
| DCR-017 | GET /fulfilment returns 500 and falls back to message when no errors array | Generic Error without errors array | HTTP 500; `errors: ['unexpected crash']` | Validates fallback from `error.message` when `error.errors` is absent |
| DCR-018 | GET /order returns 500 and falls back to message when no errors array | Generic Error without errors array | HTTP 500; `errors: ['db crash']` | Validates fallback from `error.message` on GET /order |
| DCR-019 | POST /fulfilment returns 500 when error has no statusCode or errors array | Generic Error | HTTP 500; `errors: ['crash']` | Default 500 path for POST /fulfilment |
| VDR-001 | POST with empty body returns 400 | Empty body (no Content-Type) | HTTP 400 | Guards the `!req.body` dead-code path in validate-doc route |
| VDR-002 | POST returns 500 when validateXml throws | `validateXml` throws unexpectedly | HTTP 500 | Ensures unhandled validator errors surface as 500 |
| VDR-003 | POST returns empty errors array when validateXml returns success with no errors field | `validateXml` returns `{ success: true }` (no errors field) | HTTP 200 with empty errors array | Validates the `errors ?? []` default when validator omits the field |
| DAS-001 | requestMetadata defaults to empty object when not provided | `getDespatchAdvice` called without requestMetadata | Function executes without error | Covers the `requestMetadata = {}` default parameter branch |
| DAS-002 | Returns the found document | Mock DB returns a despatch document | The document is returned | Validates the happy path for document retrieval |
| DAS-003 | Rethrows database errors | Mock DB throws | Error is rethrown to caller | Ensures DB errors propagate correctly |
| DCF-001 | createFulfilmentCancellation: despatch with no optional XML fields still creates cancellation | DespatchAdvice without OrderReference, Delivery, Supplier | Cancellation created successfully | Validates branch where optional XML sections are absent |
| DCF-002 | createFulfilmentCancellation: despatch with optional XML fields includes them in cancellation | DespatchAdvice with OrderReference, DeliveryCustomerParty, DespatchSupplierParty | Cancellation includes optional fields | Validates branch where all optional XML sections are present |
| DCF-003 | getFulfilmentCancellation with only fulfilmentCancellationId and doc not found throws FulfilmentCancellationNotFoundError | `fulfilmentCancellationId` set, no doc in DB | Throws `FulfilmentCancellationNotFoundError` | Covers the retrieval-by-cancellation-id not-found path |
| DCF-004 | getFulfilmentCancellation with fulfilmentCancellationId and no cancellationXml uses id in error message | Doc found but has no `cancellationXml` | Error message contains cancellation id | Validates the error message construction when XML is missing |
| DCO-001 | getCancellation: returns the found document | Mock DB returns cancellation document | The document is returned | Validates the happy path for order cancellation retrieval |
| DCO-002 | getCancellation: rethrows database errors | Mock DB throws | Error rethrown to caller | Ensures DB errors propagate correctly |
| DCO-003 | cancelDespatchAdvice throws CancellationNotFoundError when doc exists but has no cancellationId | DB document has no `cancellationId` | Throws `CancellationNotFoundError` | Covers the corrupt-document guard |
| DCO-004 | cancelDespatchAdvice throws CancellationNotFoundError using cancellationId in message when adviceId absent | `adviceId` not present, `cancellationId` present | Error message contains `cancellationId` | Validates alternative error message when adviceId is absent |
| DCO-005 | cancelDespatchAdvice throws BasicXmlValidationError when cancellation orderId does not match despatch orderId | Mismatched order IDs | Throws `BasicXmlValidationError` | Enforces order ID consistency check between cancellation and despatch |
| DCO-006 | CancellationNotFoundError uses default message | `new CancellationNotFoundError()` | Default message used | Validates custom error class default message |
| DCO-007 | CancellationForbiddenError uses default message | `new CancellationForbiddenError()` | Default message used | Validates custom error class default message |
| DRH-001 | Missing Content-Type header → contentType: null | Request without Content-Type header | `contentType` is `null` | Validates `requestMetadata` correctly handles absent content-type header |
| FCXV-001 | Valid FulfilmentCancellation XML returns success with extracted fields | Valid mock XML | `{ success: true, id: '00384', issueDate: '2005-06-22', originalOrderId: 'AEG012345' }` | Validates the happy path for fulfilment cancellation XML extraction |
| FCXV-002 | Missing cbc:ID returns validation error | XML with `cbc:ID` element removed | `{ success: false, errors: ['Missing FulfilmentCancellation/cbc:ID element'] }` | Ensures required ID field triggers a validation error |
| FCXV-003 | Missing issue date returns validation error | XML with `cbc:IssueDate` removed | `{ success: false, errors: ['Missing DespatchAdvice/cbc:IssueDate element'] }` | Ensures required issue date triggers a validation error |
| FCXV-004 | Missing cancellation note defaults to 'No reason provided' | XML with `cbc:CancellationNote` removed | `{ success: true, cancellationNote: 'No reason provided' }` | Validates the optional-field default value branch |
| FCXV-005 | Wrong root element returns validation error | XML root changed to `SomeOtherDocument` | `{ success: false, errors: ['Missing FulfilmentCancellation root element'] }` | Ensures wrong root element is detected |
| FCXV-006 | Malformed XML returns invalid content error | `<FulfilmentCancellation><broken></FulfilmentCancellation>` | `{ success: false, errors: ['Invalid XML content'] }` | Ensures parse errors are caught and returned gracefully |
| CSFV-001 | validateBuyerCustomerParty: missing cac:Party returns error | `{}` | `{ success: false, errors: ['...Missing cac:Party...'] }` | Guards against missing Party element in buyer |
| CSFV-002 | validateBuyerCustomerParty: missing cac:PartyName returns error | `{ 'cac:Party': {} }` | `{ success: false, errors: ['...Missing cac:PartyName/cbc:Name...'] }` | Guards against missing PartyName in buyer Party |
| CSFV-003 | validateBuyerCustomerParty: missing cbc:Name returns error | `{ 'cac:Party': { 'cac:PartyName': {} } }` | `{ success: false, errors: ['...Missing cac:PartyName/cbc:Name...'] }` | Guards against missing Name in buyer PartyName |
| CSFV-004 | validateBuyerCustomerParty: all fields present returns success | Full valid buyer party object | `{ success: true }` | Validates the happy path for buyer party validation |
| CSFV-005 | validateSellerSupplierParty: missing cac:Party returns error | `{}` | `{ success: false, errors: ['...Missing cac:Party...'] }` | Guards against missing Party element in seller |
| CSFV-006 | validateSellerSupplierParty: missing cac:PartyName returns error | `{ 'cac:Party': {} }` | `{ success: false, errors: ['...Missing cac:PartyName/cbc:Name...'] }` | Guards against missing PartyName in seller Party |
| CSFV-007 | validateSellerSupplierParty: missing cbc:Name returns error | `{ 'cac:Party': { 'cac:PartyName': {} } }` | `{ success: false, errors: ['...Missing cac:PartyName/cbc:Name...'] }` | Guards against missing Name in seller PartyName |
| CSFV-008 | validateSellerSupplierParty: all fields present returns success | Full valid seller party object | `{ success: true }` | Validates the happy path for seller party validation |
| XSD-001 | Returns success for valid order XML | Valid order mock XML | `{ success: true, errors: [] }` | Validates happy path for order document type |
| XSD-002 | Returns success for valid receipt XML | Valid receipt-advice mock XML | `{ success: true, errors: [] }` | Validates happy path for receipt document type |
| XSD-003 | Returns success for valid despatch XML | Valid despatch-advice mock XML | `{ success: true, errors: [] }` | Validates happy path for despatch document type |
| XSD-004 | Returns success for valid order-cancel XML | Valid order-cancellation mock XML | `{ success: true, errors: [] }` | Validates happy path for order-cancel document type |
| XSD-005 | Returns success for valid order-change XML | Valid order-change mock XML | `{ success: true, errors: [] }` | Validates happy path for order-change document type |
| XSD-006 | Returns success for valid fulfilment-cancel XML | Valid fulfilment-cancellation mock XML | `{ success: true, errors: [] }` | Validates happy path for fulfilment-cancel document type |
| XSD-007 | Returns error for unsupported document type | `documentType: 'unknown-doc'` | `{ success: false, errors: ['Unsupported document type: unknown-doc'] }` | Ensures unknown document types are rejected gracefully |
| XSD-008 | Returns invalid XML error for malformed order XML | `'<Order><broken></Order>'` | `{ success: false, errors: ['Invalid XML content - check your root XML elements...'] }` | Verifies parse errors are caught before schema validation |
| XSD-009 | Surfaces downstream validator errors | Order XML with `cbc:ID` removed | `{ success: false, errors: ['Invalid Order XML: Missing required field cbc:ID'] }` | Ensures field-level validation errors propagate from sub-validators |
| XSD-010 | toValidationResponse returns unknown error when validator returns null | Receipt validator mocked to return `null` | Result has `success` property (does not throw) | Exercises the null-result guard in the validation response builder |
| OXV-001 | Valid parsed Order returns success with extracted IDs | Valid order mock XML, parsed | `{ success: true, id, orderId, salesOrderId, issueDate }` | Validates the full happy path for order XML validation |
| OXV-002 | Invalid UUID format returns validation error | Order XML with `cbc:UUID` set to `'not-a-uuid'` | `{ success: false, errors: ['Invalid UUID format in Order/cbc:UUID - not-a-uuid'] }` | Ensures UUID format is enforced |
| OXV-003 | Missing UUID field still results in success | Parsed order with `cbc:UUID` key deleted | `{ success: true, id: undefined, ... }` | Confirms UUID is optional: absence does not fail validation |
| OXV-004 | Null parsedOrderTree returns missing root error | `null` | `{ success: false, errors: ['Invalid Order XML: Missing Order root element'] }` | Guards against null input to validator |
| OXV-005 | parsedOrderTree without Order key returns missing root error | `{}` | `{ success: false, errors: ['Invalid Order XML: Missing Order root element'] }` | Guards against object missing the root Order key |
| OXV-006 | Missing required field cbc:ID returns error | Parsed order with `cbc:ID` deleted | `{ success: false, errors: ['Invalid Order XML: Missing required field cbc:ID'] }` | Validates the required ID field check |
| OXV-007 | Buyer customer party missing cac:Party returns error | `cac:BuyerCustomerParty = {}` | `{ success: false, errors: ['...Missing cac:Party element in cac:BuyerCustomerParty'] }` | Validates buyer party structure check within order validation |
| OXV-008 | Seller supplier party missing cac:Party returns error | `cac:SellerSupplierParty = {}` | `{ success: false, errors: ['...Missing cac:Party element in cac:SellerSupplierParty'] }` | Validates seller party structure check within order validation |
