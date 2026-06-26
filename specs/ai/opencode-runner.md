# OpenCode Runner Specification

## Purpose
Expose 9Router HTTP API adapter implementation.

## Responsibilities
* Format payload requests targeting the `opencode` model.
* Execute HTTP post calls with authorization headers.

## Dependencies
* External: `axios`.
* Internal: `AppConfig`, `IAiProvider`.

## Configuration
* Send queries using options:
  * Model: `opencode`
  * Temperature: `0.1` (to minimize hallucinations)
  * Response format: `json_object`
* Set HTTP client request timeouts (e.g. 30 seconds).
